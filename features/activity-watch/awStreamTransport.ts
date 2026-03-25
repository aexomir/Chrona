/**
 * awStreamTransport.ts
 *
 * Implements AwStreamTransport over a WebSocket connection to the macOS
 * ChronaHelper app running on the local network.
 *
 * Discovery:
 *   The macOS app registers a Bonjour service (_chronahelper._tcp) and
 *   its hostname is shown in the ChronaHelper menu bar (e.g. "MacBook-Pro.local:7777").
 *   Pass that host + port when constructing MacBridgeTransport.
 *
 * Reconnection:
 *   Uses exponential backoff capped at 30 s.
 *   Resets on every successful open.
 *   Disabled when disconnect() is called explicitly.
 *
 * Batching:
 *   The macOS side already batches — the iOS side just emits whatever arrives.
 *   Duplicate batches are identified by batchId and silently dropped.
 *
 * Usage:
 *   const transport = new MacBridgeTransport('MacBook-Pro.local')
 *   transport.onStatusChange(connected => setConnected(connected))
 *   transport.onEvent(event => {
 *     if (event.type === 'events') processRecords(event.payload.records)
 *   })
 *   await transport.connect()
 */

import type { AwStreamEvent, AwStreamTransport } from "./awStreamTypes";

// MARK: - Constants

const DEFAULT_PORT = 7_777;

/** Backoff delays (ms) for successive failed reconnect attempts. */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

/** Adaptive connection timeout: starts at 8s, increases 2s per retry, caps at 20s */
const getConnectTimeout = (attempt: number): number =>
  Math.min(8_000 + attempt * 2_000, 20_000);

// MARK: - MacBridgeTransport

export class MacBridgeTransport implements AwStreamTransport {
  private readonly host: string;
  private readonly port: number;

  private ws: WebSocket | null = null;
  /** The WebSocket currently being opened (between new WebSocket() and onopen/onclose). */
  private pendingWs: WebSocket | null = null;
  private eventHandlers: Array<(event: AwStreamEvent) => void> = [];
  private statusHandlers: Array<(connected: boolean) => void> = [];
  private reconnectHandlers: Array<
    (state: { attempt: number; delayMs: number } | null) => void
  > = [];

  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private _lastMessageAt = 0;
  private _staleness_timer: ReturnType<typeof setInterval> | null = null;

  /** Tracks batchIds already delivered — prevents double-processing retransmits. */
  private seenBatchIds = new Set<string>();

  constructor(host: string, port = DEFAULT_PORT) {
    this.host = host;
    this.port = port;
  }

  // MARK: - AwStreamTransport implementation

  /**
   * Opens the WebSocket connection.
   * Resolves when the socket is open and the hello frame has been received.
   * Rejects after adaptive timeout if the connection cannot be established.
   * After rejection, the automatic reconnect loop takes over via onclose.
   */
  connect(): Promise<void> {
    this.intentionalDisconnect = false;

    // Idempotent — already connected
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const connectTimeout = getConnectTimeout(this.reconnectAttempt);
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `[ChronaHelper] Connection timed out after ${connectTimeout}ms`,
          ),
        );
        // Close the pending socket so its onclose fires and schedules the reconnect.
        // Do NOT call scheduleReconnect() here — onclose handles it, and calling both
        // would double-increment reconnectAttempt and cancel the first backoff timer.
        this.pendingWs?.close();
      }, connectTimeout);

      this.openSocket(
        () => {
          clearTimeout(timeout);
          resolve();
        },
        (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      );
    });
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.cancelReconnect();
    this.stopStalenessCheck();
    this.ws?.close();
    this.ws = null;
    this.notifyStatus(false);
  }

  onEvent(handler: (event: AwStreamEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  onStatusChange(handler: (connected: boolean) => void): void {
    this.statusHandlers.push(handler);
  }

  onReconnectStateChange(
    handler: (state: { attempt: number; delayMs: number } | null) => void,
  ): void {
    this.reconnectHandlers.push(handler);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  isReconnecting(): boolean {
    return this.reconnectTimer !== null || this.pendingWs !== null;
  }

  // MARK: - Private — socket lifecycle

  private openSocket(
    onOpen?: () => void,
    onError?: (err: Error) => void,
  ): void {
    const url = `ws://${this.host}:${this.port}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
      this.pendingWs = ws;
    } catch (err) {
      this.pendingWs = null;
      onError?.(err instanceof Error ? err : new Error(String(err)));
      this.scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      this.pendingWs = null;
      this.ws = ws;
      this._lastMessageAt = Date.now();
      this.reconnectAttempt = 0;
      this.startStalenessCheck();
      this.notifyReconnectStateChange(null); // Clear reconnecting state
      this.notifyStatus(true);
      onOpen?.();
    };

    ws.onmessage = (event) => {
      this._lastMessageAt = Date.now();
      this.handleMessage(event.data);
    };

    ws.onerror = () => {
      // onerror fires before onclose — let onclose handle reconnect
      onError?.(new Error("[ChronaHelper] WebSocket error"));
    };

    ws.onclose = (evt) => {
      if (this.pendingWs === ws) this.pendingWs = null;
      const wasClean = evt.wasClean;
      this.ws = null;
      this.stopStalenessCheck();
      this.notifyStatus(false);
      if (!this.intentionalDisconnect) {
        if (!wasClean) {
          console.warn("[ChronaHelper] Unclean disconnect — reconnecting");
        }
        this.scheduleReconnect();
      }
    };
  }

  // MARK: - Private — message handling

  private handleMessage(raw: string): void {
    let msg: AwStreamEvent;
    try {
      msg = JSON.parse(raw) as AwStreamEvent;
    } catch {
      console.warn("[ChronaHelper] Received unparseable message — skipping");
      return;
    }

    // Deduplicate event batches by batchId
    if (msg.type === "events") {
      const { batchId } = msg.payload;
      if (this.seenBatchIds.has(batchId)) return;
      this.seenBatchIds.add(batchId);
      // Bound the dedup set — keep last 500 batchIds
      if (this.seenBatchIds.size > 500) {
        const oldest = this.seenBatchIds.values().next().value;
        if (oldest !== undefined) this.seenBatchIds.delete(oldest);
      }
    }

    for (const handler of this.eventHandlers) {
      try {
        handler(msg);
      } catch (err) {
        console.error("[ChronaHelper] onEvent handler threw:", err);
      }
    }
  }

  // MARK: - Private — reconnection

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) return;
    this.cancelReconnect();

    const delay =
      BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)];
    this.reconnectAttempt++;

    console.log(
      `[ChronaHelper] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})…`,
    );

    this.notifyReconnectStateChange({
      attempt: this.reconnectAttempt,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionalDisconnect) this.openSocket();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // MARK: - Private — staleness detection

  private startStalenessCheck(): void {
    this.stopStalenessCheck();
    this._staleness_timer = setInterval(() => {
      if (
        this._lastMessageAt > 0 &&
        Date.now() - this._lastMessageAt > 90_000
      ) {
        console.warn("[ChronaHelper] No message in 90s — forcing reconnect");
        this.ws?.close(); // triggers onclose → scheduleReconnect
      }
    }, 30_000);
  }

  private stopStalenessCheck(): void {
    if (this._staleness_timer !== null) {
      clearInterval(this._staleness_timer);
      this._staleness_timer = null;
    }
  }

  // MARK: - Private — status

  private notifyStatus(connected: boolean): void {
    for (const handler of this.statusHandlers) {
      try {
        handler(connected);
      } catch (err) {
        console.error("[ChronaHelper] onStatusChange handler threw:", err);
      }
    }
  }

  private notifyReconnectStateChange(
    state: { attempt: number; delayMs: number } | null,
  ): void {
    for (const handler of this.reconnectHandlers) {
      try {
        handler(state);
      } catch (err) {
        console.error(
          "[ChronaHelper] onReconnectStateChange handler threw:",
          err,
        );
      }
    }
  }
}

// MARK: - Factory helper

/**
 * Create a transport pre-configured from stored settings.
 *
 * `host` should be the value the user copied from the ChronaHelper menu bar,
 * e.g. "192.168.1.42" or "MacBook-Pro.local".
 * Store it in MMKV under the key "chronahelper_host".
 */
export function createMacBridgeTransport(
  host: string,
  port?: number,
): MacBridgeTransport {
  return new MacBridgeTransport(host, port);
}
