// Types shared between the macOS FocusHelper stream server and the iOS client.
// The wire format is: { "type": "<kind>", "payload": { ... } }
// These definitions mirror StreamProtocol.swift exactly.

// MARK: - Record (mirrors StoredRecord in Swift)

export interface StreamRecord {
  v: number; // schema version (currently 1)
  id: string; // stable UUID assigned on macOS
  ts: string; // ISO8601 UTC — when the activity occurred
  app: string; // application name
  dur: number; // duration in seconds
  title?: string; // window title (optional)
  bucket: string; // AW bucket id (e.g. "aw-watcher-window_hostname")
  src_id: number; // AW source event id
  wt: string; // ISO8601 UTC — when macOS wrote this record
}

// MARK: - Inbound message types

/** Sent once immediately after the WebSocket opens. */
export interface HelloEvent {
  type: "hello";
  payload: {
    version: number; // kProtocolVersion on the macOS side
    hostname: string; // e.g. "MacBook-Pro.local"
    eventsToday: number; // current day's count at connection time
  };
}

/**
 * One batch of activity records.
 * Delivered on a flush — either timer-based (every 5 s) or when the
 * buffer reaches 20 records, whichever comes first.
 */
export interface EventsEvent {
  type: "events";
  payload: {
    records: StreamRecord[];
    batchId: string; // UUID — deduplicate retransmits with this
    sentAt: string; // ISO8601 UTC — when the batch was assembled
    count: number; // == records.length; quick sanity check
  };
}

/** Periodic heartbeat — sent every 60 s even when there is no new activity. */
export interface StatusEvent {
  type: "status";
  payload: {
    eventsToday: number;
    isPolling: boolean;
  };
}

/** Emitted when the user enters or leaves an active video meeting. */
export interface MeetingEvent {
  type: "meeting";
  payload: {
    isInMeeting: boolean;
    appId: string;
    appDisplayName: string;
  };
}

export type AwStreamEvent =
  | HelloEvent
  | EventsEvent
  | StatusEvent
  | MeetingEvent;

// MARK: - Outbound message types (iOS → macOS)

/** Request historical records since a given timestamp. Sent immediately after hello. */
export interface CatchupRequest {
  type: "catchup";
  since: string; // ISO8601 UTC — request records after this timestamp
}

// MARK: - Transport interface (what the macOS P2P bridge must implement)

export interface AwStreamTransport {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: object): void;
  onEvent(handler: (event: AwStreamEvent) => void): void;
  onStatusChange(handler: (connected: boolean) => void): void;
  isConnected(): boolean;
}

// MARK: - Connection metrics (diagnostic info)

export interface ConnectionMetrics {
  connectedSince: number | null; // epoch ms
  lastMessageAt: number | null; // epoch ms
  messagesReceived: number;
  serverHostname: string | null;
}
