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

import Cocoa
import ApplicationServices

final class AppObserver {

    // MARK: - Public interface

    /// Called on the main queue whenever the app or window title changes.
    var onEvent: ((ChronaEvent) -> Void)?

    // MARK: - Private state

    private var lastAppName     = ""
    private var lastWindowTitle = ""
    private var lastBundleId    = ""
    private var pollTimer: Timer?

    /// Accessibility calls are synchronous cross-process IPC and can block for
    /// multiple seconds if the frontmost app is hung. Run them off the main
    /// queue so a hung app can't freeze the listener/heartbeat/status-bar menu.
    private let axQueue = DispatchQueue(label: "com.chrona.helper.ax", qos: .userInitiated)

    // MARK: - Init / deinit

    init() {
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(activeAppChanged),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )

        pollTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.sample()
        }
        // Default run-loop mode doesn't fire while the status-bar menu is
        // open (AppKit switches to NSEventTrackingRunLoopMode during menu
        // tracking) — add to .common so polling doesn't pause mid-menu.
        if let pollTimer {
            RunLoop.main.add(pollTimer, forMode: .common)
        }
    }

    deinit {
        pollTimer?.invalidate()
        NSWorkspace.shared.notificationCenter.removeObserver(self)
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
        guard appName != lastAppName || windowTitle != lastWindowTitle else { return }

        lastAppName     = appName
        lastWindowTitle = windowTitle
        lastBundleId    = bundleId

        let event = ChronaEvent.make(
            type: .appChange,
            appName: appName,
            windowTitle: windowTitle,
            bundleId: bundleId
        )
        onEvent?(event)
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

        guard let axWindow = windowValue else { return "" }

        var titleValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(
            axWindow as! AXUIElement, kAXTitleAttribute as CFString, &titleValue
        ) == .success else { return "" }

        return (titleValue as? String) ?? ""
    }
}
