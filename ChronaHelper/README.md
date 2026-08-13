# Chrona Helper — macOS Menu Bar App

A lightweight macOS helper that watches the frontmost application and active window title,
records them to a durable on-disk ledger, and streams them to the Chrona iOS app in real
time over the local network.

## What it does

- Runs silently in the menu bar (no Dock icon)
- Detects the active app via `NSWorkspace` notifications, with a 1 s poll as a backstop
- Reads the focused window title via the macOS Accessibility API
- Notices when you go idle, when the Mac sleeps, and when the screen locks — and records
  those as gaps rather than pretending you were working
- Keeps a 7-day ledger on disk, so the phone can ask "what was I doing between 2pm and
  4pm?" hours later, even if it wasn't connected at the time
- Advertises itself on Bonjour so the iOS app can find it without any IP configuration
- Requires a 6-character pairing code before it sends anything

## Building

1. Open `ChronaHelper.xcodeproj` in Xcode 15 or later.
2. Set your Team under **Signing & Capabilities**.
3. Build and run (⌘R). The helper appears in the menu bar.

For a release build and a distributable disk image:

```bash
bash ChronaHelper/scripts/build.sh   # → ChronaHelper/build/ChronaHelper.dmg
```

`build.sh` compiles Release with signing disabled and hands the result to `make_dmg.sh`,
which builds the disk image with its icon and background.

Both outputs are gitignored. There is no pre-built download in this repository — you build
it yourself. The release build uses `CODE_SIGN_IDENTITY="-"`, so on a machine other than
the one that built it, Gatekeeper will need an explicit right-click → Open on first launch.

### Permissions

Requires macOS 13 (Ventura) or later.

- **Accessibility** — System Settings → Privacy & Security → Accessibility. Without it,
  window titles come through as empty strings; app names still work.
- **Local Network** — prompted on first launch. Without it, the iOS app can't discover the
  helper at all.

No Screen Recording permission is needed. The App Sandbox is deliberately disabled in
`ChronaHelper.entitlements`, because reading another process's window title through
`AXUIElement` is not possible from inside the sandbox.

---

## Wire Protocol

Transport: **TCP** discovered via **Bonjour** service type `_chrona._tcp`
Framing: **newline-delimited JSON** — one UTF-8 JSON object per `\n`
Version: **2**

The listener takes an OS-assigned port and advertises it over Bonjour, so there is no
fixed port number to configure.

### Authentication

The helper sends nothing until the client authenticates. On every connection — including
every reconnect — the client's first message must be:

```json
{"version": 2, "type": "auth", "token": "K7QM2X"}
```

The token is the 6-character pairing code shown in the helper's menu bar menu
(`Pairing.swift`; alphabet excludes `0/O` and `1/I/L`, compared in constant time). The
helper replies with `auth_ok` or `auth_failed`, and closes the connection shortly after
`auth_failed`.

The `timestamp` on `auth_ok` is the Mac's clock. The client stores the difference against
its own clock and uses it to translate window bounds before querying, so a phone with a
skewed clock still asks about the right window.

Regenerating the code on the Mac invalidates every paired device.

### ChronaEvent schema

```json
{
  "version":     2,
  "type":        "app_change",
  "appName":     "Xcode",
  "windowTitle": "AppDelegate.swift — ChronaHelper",
  "bundleId":    "com.apple.dt.Xcode",
  "timestamp":   1711234567.891
}
```

| Field         | Type   | Description                                                          |
|---------------|--------|----------------------------------------------------------------------|
| `version`     | Int    | Protocol version, currently `2`. Ignore lines with a higher version. |
| `type`        | String | See event types below.                                               |
| `appName`     | String | Localised display name of the frontmost app, e.g. `"Safari"`.        |
| `windowTitle` | String | Title of the focused window. Empty if unavailable.                   |
| `bundleId`    | String | Bundle identifier, e.g. `"com.apple.Safari"`.                        |
| `timestamp`   | Double | Mac-clock Unix seconds, millisecond precision.                       |

### Event types

| `type`        | When sent                                                        | Has app fields |
|---------------|------------------------------------------------------------------|----------------|
| `auth_ok`     | The submitted pairing code matched. Streaming starts after this.  | No             |
| `auth_failed` | The pairing code did not match. Connection closes shortly after.  | No             |
| `hello`       | Immediately after a client authenticates — current state.         | Yes            |
| `app_change`  | The frontmost app or the focused window title changed.            | Yes            |
| `heartbeat`   | Every 10 s when nothing has changed.                              | No             |
| `pong`        | Response to a client `ping`, confirming liveness.                 | No             |
| `user_idle`   | No keyboard or mouse input for the idle threshold (default 5 min).| No             |
| `user_active` | Input resumed after a `user_idle`.                                | No             |

### Client → server messages

| `type`        | Payload                                                                                                              | Response                                             |
|---------------|----------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| `auth`        | `{"version":2,"type":"auth","token":"K7QM2X"}`                                                                       | `auth_ok` or `auth_failed`. Required first.           |
| `ping`        | `{"type":"ping"}`                                                                                                    | A `pong` event.                                       |
| `timer_state` | `{"type":"timer_state","isTracking":Bool,"projectId","projectName","projectColor","timerTitle","startTimestamp"}`     | None. Updates the menu bar's live elapsed display.    |
| `usage_query` | `{"version":2,"type":"usage_query","requestId":"…","from":<sec>,"to":<sec>}`                                          | A `usage_result` with the matching `requestId`.       |

---

## The activity ledger

Live events are lossy by design — nothing is buffered while no client is attached, and
nothing needs to be. Per-app durations come from a separate, durable channel.

`ActivityLedger.swift` appends spans and gaps to disk as they happen:

```
~/Library/Application Support/ChronaHelper/spans.ndjson
~/Library/Application Support/ChronaHelper/open-span.json
```

Retention is 7 days. Gaps shorter than 2 seconds are dropped, and at most 20 window titles
are kept per span.

A `usage_query` is answered from this file, so it is correct even if the phone was
disconnected for the entire window being asked about. That is what lets the iOS app attach
an app breakdown to a session it saved while the Mac was asleep.

### `usage_result`

```json
{
  "version":   2,
  "type":      "usage_result",
  "requestId": "3F2A…",
  "from":      1711220000.0,
  "to":        1711227200.0,
  "apps": [
    { "bundleId": "com.apple.dt.Xcode", "appName": "Xcode", "seconds": 3720,
      "titles": ["AuthStore.swift", "KeychainBridge.swift"] }
  ],
  "coverage": {
    "observed": 5400, "idle": 900, "locked": 0,
    "asleep": 600, "offline": 300, "unknown": 0
  }
}
```

`observed` plus every gap reason plus `unknown` sums to the window length. The client shows
what the Mac does *not* know rather than pretending the window was fully tracked.

---

## Menu bar

| Item                            | What it does                                                      |
|---------------------------------|-------------------------------------------------------------------|
| Status                          | Connection state, and the live timer if one is running on iOS.     |
| Pairing Code: `XXXXXX`          | Click to copy.                                                     |
| Regenerate Pairing Code…        | Invalidates every paired device.                                   |
| Idle threshold                  | How long without input counts as idle. Default 5 minutes.           |
| Launch at Login                 | Registers the helper via `SMAppService`.                            |
| Accessibility Settings…         | Opens the relevant System Settings pane.                            |
| Copy Last Hour of Usage         | Dumps the last hour of the ledger to the clipboard.                 |
| Reveal Activity Log in Finder   | Opens the Application Support folder.                               |

---

## File map

```
ChronaHelper/
  main.swift                 Entry point
  AppDelegate.swift          .accessory activation policy, login item, wiring
  AppObserver.swift          NSWorkspace + AXUIElement watcher; emits ChronaEvents
  BonjourServer.swift        NWListener, Bonjour advertisement, TCP streaming, auth
  EventProtocol.swift        ChronaEvent / UsageResult types — the wire-format spec
  ActivityLedger.swift       Durable spans + gaps on disk; serves usage_query
  IdleDetector.swift         CGEventSource idle detection
  SystemStateObserver.swift  Sleep, lock, and fast-user-switch handling
  Pairing.swift              6-character code, constant-time comparison
  StatusBarController.swift  Menu bar item and menu
  Info.plist                 LSUIElement, Bonjour service declaration, usage strings
  ChronaHelper.entitlements  Sandbox disabled (required for cross-process AXUIElement)
```

The iOS side of this connection lives in `modules/chrona-stream/` — see the root
[README](../README.md).
