// EventProtocol.swift — Chrona Helper
//
// Defines the wire protocol shared between the macOS helper and the iOS app.
//
// Transport: TCP (discovered via Bonjour service type `_chrona._tcp`)
// Framing:   Newline-delimited JSON — one UTF-8 JSON object per line, terminated by `\n`
//
// iOS client algorithm:
//   1. Browse for `_chrona._tcp` on the local network.
//   2. Connect to the resolved endpoint.
//   3. Immediately send `{"type":"auth","token":"<pairing code>"}` as the
//      first message. The server sends nothing except `auth_ok`/`auth_failed`
//      until it receives a valid `auth` message (see Pairing.swift) — this
//      keeps window-title/app-name data from being readable by any device
//      that merely discovers the Bonjour service.
//   4. Split incoming bytes on `\n`, decode each line. Switch on `type` before
//      decoding: most lines are `ChronaEvent`, but `usage_result` has its own
//      shape (see UsageResult below).
//   5. Ignore lines whose `version` field is higher than the client understands.
//   6. Reconnect automatically if the connection drops (the helper will re-advertise);
//      re-send the stored pairing code as `auth` on every reconnect.
//
// Example line:
//   {"version":2,"type":"app_change","appName":"Xcode","windowTitle":"AppDelegate.swift — ChronaHelper","bundleId":"com.apple.dt.Xcode","timestamp":1711234567.891}
//
// Two channels share this connection:
//
//   Live stream (server → client, unsolicited) — `app_change`, `hello`,
//   `heartbeat`, `user_idle`, `user_active`, `pong`. Drives real-time UI and
//   auto-tracking. Lossy by nature: nothing is buffered while no client is
//   attached, and nothing needs to be.
//
//   Usage query (client → server, request/response) — the client sends
//   `{"version":2,"type":"usage_query","requestId":"…","from":<sec>,"to":<sec>}`
//   and the server answers with a matching `usage_result`. This is the
//   authoritative source for per-app durations, served from the on-disk ledger
//   (see ActivityLedger.swift), so it is correct even when the client was
//   disconnected for the whole window being asked about.
//
// Timestamps are always Mac-clock Unix seconds. The client derives its offset
// from the `timestamp` on `auth_ok` and translates its own window bounds into
// Mac time before querying, so a phone with a skewed clock still gets the
// right window.

import Foundation

/// Bump this when the schema changes incompatibly so iOS clients can gate on it.
/// v2 added the `usage_query` / `usage_result` request-response pair.
let kProtocolVersion = 2

/// A single observation streamed from the Mac helper to the iOS client.
struct ChronaEvent: Codable {

    // MARK: - Schema

    /// Protocol version. Clients should ignore events with a version they don't recognise.
    let version: Int

    /// Discriminates the kind of observation.
    let type: EventType

    /// Localised display name of the frontmost application, e.g. `"Safari"`.
    /// Empty string on `heartbeat` events.
    let appName: String

    /// Title of the focused window, e.g. `"New Tab - Google Chrome"`.
    /// Empty string when unavailable (app denied Accessibility, or on `heartbeat`).
    let windowTitle: String

    /// Reverse-DNS bundle identifier, e.g. `"com.apple.Safari"`.
    /// Empty string on `heartbeat` events.
    let bundleId: String

    /// Seconds since Unix epoch, with sub-second precision (millisecond resolution).
    let timestamp: Double

    // MARK: - Event types

    enum EventType: String, Codable {
        /// The frontmost application changed, or the focused window title changed within
        /// the same app. Always carries populated `appName`, `windowTitle`, `bundleId`.
        case appChange = "app_change"

        /// Sent every 10 seconds when no `app_change` has occurred.
        /// All fields except `version`, `type`, and `timestamp` are empty strings.
        case heartbeat = "heartbeat"

        /// First event sent after a client connects.
        /// Carries the current frontmost app snapshot — treat it identically to `app_change`.
        case hello = "hello"

        /// Response to a ping from the iOS client, confirming the connection is alive.
        case pong = "pong"

        /// Sent when the Mac detects no keyboard or mouse input for the idle threshold.
        /// All fields except `version`, `type`, and `timestamp` are empty strings.
        case userIdle = "user_idle"

        /// Sent when the Mac detects user input after a `userIdle` event.
        /// All fields except `version`, `type`, and `timestamp` are empty strings.
        case userActive = "user_active"

        /// Sent in response to a client's `auth` message when the submitted
        /// pairing code matches. All fields except `version`, `type`, and
        /// `timestamp` are empty strings. Only after this does the server
        /// start sending `app_change`/`heartbeat`/etc. on this connection.
        case authOk = "auth_ok"

        /// Sent in response to a client's `auth` message when the submitted
        /// pairing code does not match. The server closes the connection
        /// shortly after sending this.
        case authFailed = "auth_failed"
    }

    // MARK: - Factory

    static func make(
        type: EventType,
        appName: String = "",
        windowTitle: String = "",
        bundleId: String = ""
    ) -> ChronaEvent {
        ChronaEvent(
            version: kProtocolVersion,
            type: type,
            appName: appName,
            windowTitle: windowTitle,
            bundleId: bundleId,
            timestamp: Date().timeIntervalSince1970
        )
    }
}

// MARK: - Usage query response

/// Total time attributed to one app within the queried window.
struct UsageApp: Codable {
    let bundleId: String
    let appName: String
    let seconds: Int
    let titles: [String]
}

/// How the queried window breaks down. `observed` plus every gap reason plus
/// `unknown` sums to the window length, so the client can show what it does
/// *not* know rather than pretending the window was fully tracked.
struct UsageCoverage: Codable {
    let observed: Int
    let idle: Int
    let locked: Int
    let asleep: Int
    /// Time the helper itself was not running.
    let offline: Int
    let unknown: Int
}

/// Answer to a client's `usage_query`, correlated by `requestId`.
struct UsageResult: Codable {
    let version: Int
    let type: String
    let requestId: String
    let from: Double
    let to: Double
    let apps: [UsageApp]
    let coverage: UsageCoverage
}
