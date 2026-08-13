// AppObserver.swift — Chrona Helper
//
// Watches for changes to the frontmost application and its focused window title
// using two complementary mechanisms:
//
//   1. NSWorkspace.didActivateApplicationNotification — fires immediately when the
//      user switches apps. Fast and reliable for app changes.
//
//   2. A 1-second poll timer — required because window title changes (e.g. switching
//      tabs in Safari, or opening a new file in Xcode) don't trigger any system
//      notification. Polling at 1 s gives sub-2-second latency with negligible CPU cost.
//
// Window titles are read via the macOS Accessibility API (AXUIElement). The app must
// be listed under System Settings → Privacy & Security → Accessibility. If access is
// not granted, window titles fall back to an empty string — app names still work.
//
// Two things come out of every observation:
//
//   - A live `app_change` event, pushed to whatever client is attached right now.
//     Lossy and best-effort; drives real-time UI and auto-tracking.
//
//   - A *span* in the ActivityLedger — one contiguous stretch of a single app being
//     frontmost, closed and written to disk when the user moves on. This is the
//     authoritative record, and it is written whether or not anyone is listening.
//
// While the user is idle, the display is locked, or the machine is asleep, the
// observer is suspended: the open span is closed and the elapsed time is recorded
// as a gap instead of being credited to whichever app happened to be frontmost.

import Cocoa
import ApplicationServices

/// How often the in-progress span is mirrored to disk. Bounds what a crash or
/// power loss can cost to a single interval.
private let kCheckpointInterval: TimeInterval = 60
private let kMaxTitles = 20

final class AppObserver {

    // MARK: - Public interface

    /// Called on the main queue whenever the app or window title changes.
    var onEvent: ((ChronaEvent) -> Void)?

    // MARK: - Private state

    private let ledger: ActivityLedger

    private var lastAppName     = ""
    private var lastWindowTitle = ""
    private var lastBundleId    = ""

    private var currentSpan: AppSpan?

    /// Reasons the observer is currently suspended. A set rather than a flag
    /// because they overlap: going idle and then having the machine sleep must
    /// not let the wake-up resume tracking while the user is still away.
    private var suspensions: Set<String> = []
    private var suspendedAt: Double?
    private var suspendedReason: GapReason?

    /// The most recent instant already accounted for by a span or a gap.
    /// Back-dating can never reach behind this, or two records would claim the
    /// same stretch and every query would double-count it.
    private var lastBoundaryAt: Double = 0

    private var pollTimer: Timer?
    private var checkpointTimer: Timer?

    /// Accessibility calls are synchronous cross-process IPC and can block for
    /// multiple seconds if the frontmost app is hung. Run them off the main
    /// queue so a hung app can't freeze the listener/heartbeat/status-bar menu.
    private let axQueue = DispatchQueue(label: "com.chrona.helper.ax", qos: .userInitiated)

    // MARK: - Init / deinit

    init(ledger: ActivityLedger) {
        self.ledger = ledger
    }

    deinit {
        pollTimer?.invalidate()
        checkpointTimer?.invalidate()
        NSWorkspace.shared.notificationCenter.removeObserver(self)
    }

    /// Starts observing. Separate from `init` so the caller can wire `onEvent`
    /// before the first sample fires.
    func start() {
        // Anything before launch is already covered by the ledger's helper_off
        // gap; an idle transition noticed seconds from now must not reach back
        // into it.
        lastBoundaryAt = Date().timeIntervalSince1970

        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(activeAppChanged),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )

        let poll = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.sample()
        }
        // Default run-loop mode doesn't fire while the status-bar menu is
        // open (AppKit switches to NSEventTrackingRunLoopMode during menu
        // tracking) — add to .common so polling doesn't pause mid-menu.
        RunLoop.main.add(poll, forMode: .common)
        pollTimer = poll

        let checkpoint = Timer.scheduledTimer(withTimeInterval: kCheckpointInterval, repeats: true) { [weak self] _ in
            self?.checkpoint()
        }
        RunLoop.main.add(checkpoint, forMode: .common)
        checkpointTimer = checkpoint

        sample()
    }

    // MARK: - Public helpers

    /// Returns an immediate snapshot of the current frontmost app as a `hello` event,
    /// or `nil` if there is no frontmost application.
    func currentSnapshot() -> ChronaEvent? {
        guard let app = NSWorkspace.shared.frontmostApplication else { return nil }
        return ChronaEvent.make(
            type: .hello,
            appName: app.localizedName ?? "",
            windowTitle: windowTitle(forPID: app.processIdentifier),
            bundleId: app.bundleIdentifier ?? ""
        )
    }

    /// The stretch still in progress, which by definition has not been written
    /// to the ledger yet. Queries must fold this in or the current app appears
    /// to have had no time at all — the single biggest symptom of the old design.
    func openSpan() -> AppSpan? { currentSpan }

    /// Closes and persists whatever is in flight. Called on termination.
    func flush() {
        closeSpan(at: Date().timeIntervalSince1970)
        ledger.setOpenSpan(nil)
    }

    // MARK: - Suspend / resume

    /// Stops attributing time to any app. `backdatedTo` lets an idle transition
    /// name the moment input actually stopped rather than the moment the 10 s
    /// poll noticed — without it every idle period would credit up to a full
    /// idle threshold to the last app used.
    func suspend(reason: GapReason, backdatedTo time: Double) {
        let alreadySuspended = !suspensions.isEmpty
        suspensions.insert(reason.rawValue)
        guard !alreadySuspended else { return }

        var boundary = min(time, Date().timeIntervalSince1970)
        // Never back-date into a stretch that is already accounted for. Two
        // cases matter: the span being closed (back-dating past its start drops
        // it and leaves a hole), and the previous suspension's end — a wake
        // re-opens the span asynchronously, so an idle transition arriving
        // first would otherwise back-date across the sleep gap.
        boundary = max(boundary, lastBoundaryAt)
        if let span = currentSpan { boundary = max(boundary, span.start) }

        closeSpan(at: boundary)
        ledger.setOpenSpan(nil)
        suspendedAt = boundary
        suspendedReason = reason
    }

    func resume(reason: GapReason) {
        suspensions.remove(reason.rawValue)
        guard suspensions.isEmpty else { return }

        let now = Date().timeIntervalSince1970
        if let start = suspendedAt, let gapReason = suspendedReason {
            ledger.recordGap(reason: gapReason, start: start, end: now)
        }
        lastBoundaryAt = now
        suspendedAt = nil
        suspendedReason = nil

        // Force the next sample through the dedupe guard so a span reopens even
        // if the frontmost app never changed while the user was away.
        lastAppName = ""
        lastWindowTitle = ""
        lastBundleId = ""
        sample()
    }

    // MARK: - Notification handler

    @objc private func activeAppChanged(_ notification: Notification) {
        sample()
    }

    // MARK: - Core sampling

    private func sample() {
        guard let app = NSWorkspace.shared.frontmostApplication else { return }

        let appName  = app.localizedName ?? ""
        let bundleId = app.bundleIdentifier ?? ""
        let pid      = app.processIdentifier

        axQueue.async { [weak self] in
            let windowTitle = self?.windowTitle(forPID: pid) ?? ""
            DispatchQueue.main.async {
                self?.handleSample(appName: appName, bundleId: bundleId, windowTitle: windowTitle)
            }
        }
    }

    private func handleSample(appName: String, bundleId: String, windowTitle: String) {
        guard appName != lastAppName
            || windowTitle != lastWindowTitle
            || bundleId != lastBundleId else { return }

        lastAppName     = appName
        lastWindowTitle = windowTitle
        lastBundleId    = bundleId

        updateSpan(bundleId: bundleId, appName: appName, title: windowTitle)

        let event = ChronaEvent.make(
            type: .appChange,
            appName: appName,
            windowTitle: windowTitle,
            bundleId: bundleId
        )
        onEvent?(event)
    }

    // MARK: - Span bookkeeping

    private func updateSpan(bundleId: String, appName: String, title: String) {
        guard suspensions.isEmpty else { return }
        let now = Date().timeIntervalSince1970

        // Nothing to attribute time to — close out rather than guess.
        guard !bundleId.isEmpty else {
            closeSpan(at: now)
            ledger.setOpenSpan(nil)
            return
        }

        // Same app, new window title: the stretch continues. Splitting here
        // would fragment a single focused stretch into dozens of spans just
        // because the user switched browser tabs.
        if var span = currentSpan, span.bundleId == bundleId {
            addTitle(title, to: &span)
            span.end = now
            currentSpan = span
            return
        }

        closeSpan(at: now)
        var span = AppSpan(bundleId: bundleId, appName: appName, titles: [], start: now, end: now)
        addTitle(title, to: &span)
        currentSpan = span
        ledger.setOpenSpan(span)
    }

    private func closeSpan(at time: Double) {
        guard var span = currentSpan else { return }
        currentSpan = nil
        span.end = time
        ledger.recordSpan(span)
    }

    private func checkpoint() {
        guard var span = currentSpan else { return }
        span.end = Date().timeIntervalSince1970
        currentSpan = span
        ledger.setOpenSpan(span)
    }

    private func addTitle(_ title: String, to span: inout AppSpan) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, span.titles.count < kMaxTitles else { return }
        guard !span.titles.contains(trimmed) else { return }
        span.titles.append(trimmed)
    }

    // MARK: - Accessibility window title

    /// Reads the focused window title of the app with the given PID via the
    /// AXUIElement API. Returns an empty string if Accessibility access has
    /// not been granted or the app does not expose a window title.
    /// Safe to call off the main queue — this is a synchronous cross-process
    /// call, which is exactly why callers should not run it on the main queue.
    private func windowTitle(forPID pid: pid_t) -> String {
        guard AXIsProcessTrusted() else { return "" }

        let axApp = AXUIElementCreateApplication(pid)

        // Prefer the focused window; fall back to the main window.
        var windowValue: CFTypeRef?
        let focusedResult = AXUIElementCopyAttributeValue(
            axApp, kAXFocusedWindowAttribute as CFString, &windowValue
        )

        if focusedResult != .success {
            AXUIElementCopyAttributeValue(axApp, kAXMainWindowAttribute as CFString, &windowValue)
        }

        guard let windowValue, CFGetTypeID(windowValue) == AXUIElementGetTypeID() else { return "" }
        let axWindow = windowValue as! AXUIElement

        var titleValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(
            axWindow, kAXTitleAttribute as CFString, &titleValue
        ) == .success else { return "" }

        return (titleValue as? String) ?? ""
    }
}
