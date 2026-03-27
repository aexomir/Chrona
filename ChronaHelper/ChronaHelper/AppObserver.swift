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
            windowTitle: windowTitle(for: app),
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

        let appName     = app.localizedName ?? ""
        let bundleId    = app.bundleIdentifier ?? ""
        let windowTitle = windowTitle(for: app)

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

    /// Reads the focused window title of `app` via the AXUIElement API.
    /// Returns an empty string if Accessibility access has not been granted or
    /// the app does not expose a window title.
    private func windowTitle(for app: NSRunningApplication) -> String {
        guard AXIsProcessTrusted() else { return "" }

        let axApp = AXUIElementCreateApplication(app.processIdentifier)

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
