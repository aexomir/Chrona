# Changelog

All notable changes to Chrona are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-08-13

The release that made Chrona a two-part app. A macOS companion now watches which app is in
front and tells the phone about it, which is what makes automatic tracking and per-app
breakdowns possible.

### Added

- **Chrona Helper**, a macOS menu bar app. Watches the frontmost application and focused
  window title, keeps a durable seven-day ledger on disk, and streams events to the iOS app
  over the local network.
- **Pairing-code authentication.** The helper sends nothing until the client presents the
  six-character code shown in its menu. The code is compared in constant time and stored in
  the iOS Keychain.
- **`chrona-stream`**, a native Expo module doing Bonjour discovery (`_chrona._tcp`),
  newline-delimited JSON over TCP, automatic reconnection with backoff, and clock-offset
  correction between the two devices.
- **Wire protocol v2**, adding the `usage_query` / `usage_result` request-response pair
  alongside the live event stream.
- **Per-app session breakdowns.** Stopping a timer asks the Mac what happened during that
  window and attaches per-app durations, with a coverage breakdown that distinguishes
  observed time from idle, locked, asleep and offline gaps.
- **Usage backfill queue.** Sessions saved while the Mac was unreachable are patched in
  later, retried for up to seven days.
- **Auto-tracking rules** — app name plus optional window-title keywords, mapped to a
  project. More specific rules win. Includes idle timeout, an app-switch grace period, and
  companion-app detection.
- **Untracked-app hints.** Ten minutes in an app with no rule surfaces a quiet suggestion in
  the timer bar rather than tracking it silently.
- **Idle, sleep and screen-lock detection** on the Mac, with a one-tap resume for an
  interrupted session.
- **Home screen widgets and a Live Activity** — today's focus time and current project, plus
  today's session list.
- **App review sheet** for confirming which apps belong to an auto-stopped session.
- **Calendar integration** — map whole calendars to projects, with a one-tap start when a
  mapped event is running.
- **Timeline drag-to-merge** for combining two sessions.
- **Encrypted storage.** MMKV is now AES-256 encrypted with a key held in the iOS Keychain.
- **Sentry crash reporting**, opt-in via `EXPO_PUBLIC_SENTRY_DSN`.
- **Tests and tooling** — Jest suites for stats, timer, auto-track matching and calendar
  helpers; Maestro end-to-end flows; a fastlane screenshot pipeline; EAS build profiles; and
  a CI workflow running typecheck, lint and tests.

### Changed

- App durations now come from the Mac helper's on-disk ledger rather than being accumulated
  on the phone, so they stay correct when the phone is asleep or disconnected.
- Auto-tracking rules and the auto-tracker read from a shared app catalog store.
- Stats, Timeline, Search and Settings all rebuilt.
- The new-timer flow is project-first: pick a project, then name the task.
- Widgets moved from `@bacons/apple-targets` to `expo-widgets`, authored in TypeScript.
- README rewritten, and the wire protocol documentation corrected to v2.

### Removed

- The first-generation Mac tracker and the on-device activity journal.
- ActivityWatch integration.

### Fixed

- Date picker and reconnect toggle in Settings.
- `bun.lock` out of sync with the `expo-crypto` and `expo-secure-store` dependencies.
- Laggy title input caused by a synchronous MMKV write on every keystroke.

## [1.0.0] — 2026-03-26

First tagged version. The iOS app on its own: manual timers, projects, timeline, stats,
search, and the aurora dashboard.

[Unreleased]: https://github.com/aexomir/Chrona/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/aexomir/Chrona/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/aexomir/Chrona/releases/tag/v1.0.0
