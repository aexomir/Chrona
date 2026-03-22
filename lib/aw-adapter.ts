/**
 * ActivityWatch data adapter
 *
 * Exposes a unified API for fetching AW data regardless of transport.
 * Two modes are supported:
 *
 *   "localhost" — queries the AW HTTP API at localhost:5600 (default, development)
 *   "stream"    — reads from a real-time P2P event stream (Step 3 / production)
 *
 * Switch modes by calling configureAdapter() before the app starts polling.
 * All consumers (timer, timer-bar, detectMissedTime, settings) import from
 * this module — they never need to know which transport is active.
 */

import type { AppUsage } from "@/stores/sessions-store";
import {
  checkAwAvailability as _localhostCheckAwAvailability,
  getAppUsage as _localhostGetAppUsage,
  getCurrentApp as _localhostGetCurrentApp,
  getWindowBucketId as _localhostGetWindowBucketId,
} from "./activitywatch";
import type { AwStreamEvent as WireEvent, AwStreamTransport } from "./awStreamTypes";

// ─── Public types ────────────────────────────────────────────────────────────

export type { CurrentApp } from "./activitywatch";
export type { AwStreamTransport } from "./awStreamTypes";

export type AdapterMode = "localhost" | "stream";

export interface AdapterConfig {
  mode: AdapterMode;
  /**
   * Optional P2P transport for stream mode.
   * When omitted, stream mode is active but dormant until a subsequent
   * configureAdapter({ mode: "stream", transport }) call.
   */
  transport?: AwStreamTransport;
}

// ─── Internal state ───────────────────────────────────────────────────────────

let _mode: AdapterMode = "localhost";
let _transport: AwStreamTransport | null = null;
let _streamConnected = false;

// Normalised per-event record buffered from incoming stream batches
interface BufferedEvent {
  timestamp: string;
  duration: number;
  app: string;
  title: string | null;
}

// Rolling 24-hour buffer of records received from the stream transport
const EVENT_BUFFER_TTL_MS = 24 * 60 * 60 * 1000;
const _eventBuffer: BufferedEvent[] = [];

function _pruneBuffer(): void {
  const cutoff = Date.now() - EVENT_BUFFER_TTL_MS;
  let i = 0;
  while (
    i < _eventBuffer.length &&
    new Date(_eventBuffer[i].timestamp).getTime() < cutoff
  ) {
    i++;
  }
  if (i > 0) _eventBuffer.splice(0, i);
}

// Receives raw wire messages from the transport.
// Only EventsEvent batches carry records worth buffering.
function _handleWireEvent(msg: WireEvent): void {
  if (msg.type !== "events") return;
  _pruneBuffer();
  for (const record of msg.payload.records) {
    _eventBuffer.push({
      timestamp: record.ts,
      duration: record.dur,
      app: record.app,
      title: record.title ?? null,
    });
  }
}

// ─── Stream-mode aggregation helpers ─────────────────────────────────────────
// Kept here (rather than sharing with activitywatch.ts) so that module stays
// self-contained and its unit tests remain independent of the adapter.

const _SYSTEM_APP_DENYLIST = new Set([
  "loginwindow",
  "finder",
  "systemuiserver",
  "controlcenter",
  "notificationcenter",
  "dock",
  "windowserver",
  "screensaver",
  "universalaccessd",
  "coreaudiod",
  "spotlight",
  "sharingd",
]);

const _MIN_APP_DURATION_S = 2 * 60;

function _isSystemApp(app: string): boolean {
  if (app.startsWith(".")) return true;
  return _SYSTEM_APP_DENYLIST.has(app.toLowerCase());
}

function _aggregateEvents(events: BufferedEvent[]): AppUsage[] {
  const appMap = new Map<
    string,
    { duration: number; titleMap: Map<string, number> }
  >();

  for (const event of events) {
    if (_isSystemApp(event.app)) continue;
    const entry = appMap.get(event.app) ?? { duration: 0, titleMap: new Map() };
    entry.duration += event.duration;
    if (event.title) {
      entry.titleMap.set(
        event.title,
        (entry.titleMap.get(event.title) ?? 0) + event.duration,
      );
    }
    appMap.set(event.app, entry);
  }

  return Array.from(appMap, ([app, { duration, titleMap }]) => ({
    app,
    duration,
    titles: Array.from(titleMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t),
  }))
    .filter((e) => e.duration >= _MIN_APP_DURATION_S)
    .sort((a, b) => b.duration - a.duration);
}

// ─── Adapter configuration ────────────────────────────────────────────────────

/**
 * Configure the adapter mode and, if streaming, attach the transport.
 *
 * Call once at app startup before any AW queries are made.
 * Safe to call again to hot-switch modes (e.g. after pairing completes).
 *
 * @example
 * // Development (default — no call needed):
 * await configureAdapter({ mode: "localhost" });
 *
 * @example
 * // Production / Step 3:
 * await configureAdapter({ mode: "stream", transport: myP2PTransport });
 */
export async function configureAdapter(config: AdapterConfig): Promise<void> {
  if (_transport && config.mode !== "stream") {
    _transport.disconnect();
    _transport = null;
    _streamConnected = false;
  }

  _mode = config.mode;

  if (config.mode === "stream") {
    if (!config.transport) {
      // Dormant stream mode — data functions return empty until a transport connects
      return;
    }
    _transport = config.transport;
    _transport.onEvent(_handleWireEvent);
    _transport.onStatusChange((connected) => {
      _streamConnected = connected;
    });
    await _transport.connect();
    _streamConnected = _transport.isConnected();
  }
}

export function getAdapterMode(): AdapterMode {
  return _mode;
}

// ─── Unified API ──────────────────────────────────────────────────────────────

/**
 * Returns a non-null string when AW data is reachable, null otherwise.
 * In localhost mode: the AW bucket ID.
 * In stream mode: a synthetic identifier while the transport is connected.
 */
export async function getWindowBucketId(): Promise<string | null> {
  if (_mode === "stream") {
    return _streamConnected ? "stream-transport" : null;
  }
  return _localhostGetWindowBucketId();
}

/** True when the data source is reachable and providing events. */
export async function checkAwAvailability(): Promise<boolean> {
  if (_mode === "stream") {
    return _streamConnected;
  }
  return _localhostCheckAwAvailability();
}

/**
 * Aggregate app usage for a given time window.
 * In stream mode, queries the in-memory event buffer.
 */
export async function getAppUsage(
  startTime: string,
  endTime: string,
): Promise<AppUsage[]> {
  if (_mode === "stream") {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const events = _eventBuffer.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= start && t <= end;
    });
    return _aggregateEvents(events);
  }
  return _localhostGetAppUsage(startTime, endTime);
}

/**
 * Returns the most recently active non-system app within the last 60 seconds.
 * In stream mode, reads from the in-memory buffer.
 */
export async function getCurrentApp(): Promise<{ app: string; title: string | null } | null> {
  if (_mode === "stream") {
    if (!_streamConnected || _eventBuffer.length === 0) return null;
    const cutoff = Date.now() - 60_000;
    const recent = _eventBuffer.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoff && !_isSystemApp(e.app),
    );
    if (recent.length === 0) return null;
    const latest = recent.reduce((a, b) =>
      new Date(a.timestamp).getTime() > new Date(b.timestamp).getTime() ? a : b,
    );
    return { app: latest.app, title: latest.title };
  }
  return _localhostGetCurrentApp();
}
