import Foundation

// MARK: - Protocol version
let kProtocolVersion = 1

// MARK: - Message envelope
//
// All macOS → iOS messages share the same wire format:
//   { "type": "<kind>", "payload": { ... } }
//
// Keeping it in a generic envelope lets the iOS side
// switch on "type" before decoding the payload.

struct StreamEnvelope<P: Encodable>: Encodable {
    let type: String
    let payload: P
}

// MARK: - Payload types

/// Sent once immediately after a client connects.
/// Lets the iOS app orient itself without waiting for the next poll cycle.
struct HelloPayload: Encodable {
    let version: Int        // protocol version (kProtocolVersion)
    let hostname: String    // e.g. "MacBook-Pro.local" — shown in iOS settings
    let eventsToday: Int    // current day's count at connection time
}

/// Carries one batch of activity records.
/// Delivered on a flush — either timer-based or threshold-based.
struct EventsPayload: Encodable {
    let records: [StoredRecord]
    let batchId: String     // UUID — lets iOS deduplicate retransmits
    let sentAt: String      // ISO8601 UTC — when the batch was assembled
    let count: Int          // == records.count; redundant but useful for quick checks
}

/// Periodic heartbeat sent even when there's no new activity.
/// Lets the iOS app detect a stale connection and trigger reconnect.
struct StatusPayload: Encodable {
    let eventsToday: Int
    let isPolling: Bool
}
