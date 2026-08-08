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
//   4. Split incoming bytes on `\n`, decode each line as `ChronaEvent`.
//   5. Ignore lines whose `version` field is higher than the client understands.
//   6. Reconnect automatically if the connection drops (the helper will re-advertise);
//      re-send the stored pairing code as `auth` on every reconnect.
//
// Example line:
//   {"version":1,"type":"app_change","appName":"Xcode","windowTitle":"AppDelegate.swift — ChronaHelper","bundleId":"com.apple.dt.Xcode","timestamp":1711234567.891}

import Foundation

/// Bump this when the schema changes incompatibly so iOS clients can gate on it.
let kProtocolVersion = 1

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
