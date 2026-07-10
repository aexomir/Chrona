# Chrona Helper — macOS Menu Bar App

A lightweight macOS helper that watches the frontmost application and active window title,
then streams that information to the Chrona iOS app in real time over the local network.

## What it does

- Runs silently in the menu bar (no Dock icon)
- Detects the active app via `NSWorkspace` notifications
- Reads the focused window title via the macOS Accessibility API
- Advertises itself on Bonjour so the iOS app can discover it without IP configuration
- Streams events as newline-delimited JSON over a TCP connection
- Sends heartbeats every 30 s to keep the connection alive
- Reconnects automatically on both sides if the connection drops

## Building

1. Open `ChronaHelper.xcodeproj` in Xcode 15+.
2. Set your Team under **Signing & Capabilities**.
3. Build and run (⌘R). The helper appears in the menu bar.

**First launch:** macOS will prompt you to grant Accessibility access. Approve it in
System Settings → Privacy & Security → Accessibility. Without it, window titles fall
back to empty strings; app names still work.

---

## Wire Protocol

Transport: **TCP** discovered via **Bonjour** service type `_chrona._tcp`
Framing: **newline-delimited JSON** — one UTF-8 JSON object per `\n`

### ChronaEvent schema

```json
{
  "version":     1,
  "type":        "app_change",
  "appName":     "Xcode",
  "windowTitle": "AppDelegate.swift — ChronaHelper",
  "bundleId":    "com.apple.dt.Xcode",
  "timestamp":   1711234567.891
}
```

| Field         | Type    | Description                                                        |
|---------------|---------|--------------------------------------------------------------------|
| `version`     | Int     | Protocol version. Currently `1`. Ignore events with unknown versions. |
| `type`        | String  | See event types below.                                             |
| `appName`     | String  | Localised display name of the frontmost app, e.g. `"Safari"`.     |
| `windowTitle` | String  | Title of the focused window. Empty if unavailable or on heartbeat. |
| `bundleId`    | String  | Bundle identifier, e.g. `"com.apple.Safari"`. Empty on heartbeat. |
| `timestamp`   | Double  | Unix seconds with millisecond precision.                           |

### Event types

| `type`       | When sent                                               | Has app fields |
|--------------|---------------------------------------------------------|----------------|
| `hello`      | Immediately after iOS client connects — current state.  | Yes            |
| `app_change` | When frontmost app or window title changes.             | Yes            |
| `heartbeat`  | Every 30 s when nothing has changed.                    | No (empty)     |

---

## iOS integration guide

### 1 — Discovery

```swift
import Network

let browser = NWBrowser(
    for: .bonjour(type: "_chrona._tcp", domain: nil),
    using: .tcp
)
browser.browseResultsChangedHandler = { results, changes in
    if let result = results.first {
        // resolve and connect
        connectTo(result.endpoint)
    }
}
browser.start(queue: .main)
```

### 2 — Connecting

```swift
let conn = NWConnection(to: endpoint, using: .tcp)
conn.start(queue: .main)
```

### 3 — Reading events

Accumulate received bytes into a buffer; split on `\n`; decode each line:

```swift
var buffer = Data()

func receive(on conn: NWConnection) {
    conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, error in
        if let data {
            buffer.append(data)
            while let newline = buffer.firstIndex(of: 0x0A) {
                let line = buffer[..<newline]
                buffer = buffer[buffer.index(after: newline)...]
                if let event = try? JSONDecoder().decode(ChronaEvent.self, from: line) {
                    handle(event)
                }
            }
        }
        if error == nil { receive(on: conn) }  // keep reading
    }
}
```

### 4 — Handling events

```swift
func handle(_ event: ChronaEvent) {
    guard event.version == 1 else { return }  // forward-compat guard
    switch event.type {
    case .hello, .appChange:
        // update UI / session tracker
        print("\(event.appName) — \(event.windowTitle)")
    case .heartbeat:
        break  // just a keep-alive, nothing to do
    }
}
```

### 5 — Reconnection

If `NWConnection.stateUpdateHandler` reports `.failed` or `.cancelled`, re-browse
Bonjour and reconnect. The helper keeps its listener running indefinitely.

---

## File map

```
ChronaHelper/
  AppDelegate.swift         Entry point; wires the three components together
  AppObserver.swift         NSWorkspace + AXUIElement watcher; emits ChronaEvents
  BonjourServer.swift       NWListener; Bonjour advertisement; TCP streaming
  EventProtocol.swift       ChronaEvent type + wire-format docs
  StatusBarController.swift Menu bar item (clock icon, connection status, Quit)
  Info.plist                LSUIElement=true, Bonjour service declaration
  ChronaHelper.entitlements Sandbox disabled (required for AXUIElement cross-process)
```
