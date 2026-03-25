import AppKit
import ApplicationServices
import Combine
import os

@MainActor
final class NativeWindowWatcher: ObservableObject {
    @Published private(set) var hasAccessibility = false

    var onEvent: ((ActivityWindow) -> Void)?

    let permissionManager: PermissionManager

    private let flushInterval: TimeInterval = 30
    private let minDuration:   TimeInterval = 1

    private var currentApp:   String?
    private var currentTitle: String?
    private var sessionStart: Date?
    private var activationToken: NSObjectProtocol?
    private var flushTimer: Timer?
    private var permissionCancellable: AnyCancellable?

    init(permissionManager: PermissionManager) {
        self.permissionManager = permissionManager
        self.hasAccessibility  = permissionManager.permissionState.isGranted
    }

    func start() {
        hasAccessibility = permissionManager.permissionState.isGranted

        // React to permission changes while the watcher is running.
        permissionCancellable = permissionManager.$permissionState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handlePermissionChange(state)
            }

        // Wire the PermissionManager recovery callback.
        permissionManager.onGranted = { [weak self] in
            self?.recoverAfterGrant()
        }

        permissionManager.startMonitoring()
        subscribeToAppActivation()
        startFlushTimer()
        captureCurrentWindow()

        Logger.watcher.info("NativeWindowWatcher started — accessibility=\(self.hasAccessibility)")
    }

    func stop() {
        flushTimer?.invalidate()
        flushTimer = nil
        permissionCancellable?.cancel()
        permissionCancellable = nil
        permissionManager.onGranted = nil
        permissionManager.stopMonitoring()

        if let token = activationToken {
            NSWorkspace.shared.notificationCenter.removeObserver(token)
            activationToken = nil
        }
        emitCurrentSession()
        currentApp   = nil
        currentTitle = nil
        sessionStart = nil
        Logger.watcher.info("NativeWindowWatcher stopped")
    }

    private func handlePermissionChange(_ state: AccessibilityPermissionState) {
        let newValue = state.isGranted
        guard newValue != hasAccessibility else { return }
        hasAccessibility = newValue
        Logger.watcher.info("Watcher accessibility updated: \(newValue)")
    }

    private func recoverAfterGrant() {
        Logger.watcher.info("Recovery after accessibility grant — restarting watcher")
        stop()
        start()
    }

    private func subscribeToAppActivation() {
        activationToken = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in self.handleAppSwitch() }
        }
    }

    private func handleAppSwitch() {
        emitCurrentSession()
        captureCurrentWindow()
    }

    private func captureCurrentWindow() {
        guard let app = NSWorkspace.shared.frontmostApplication else { return }
        currentApp   = app.localizedName ?? app.bundleIdentifier ?? "Unknown"
        currentTitle = hasAccessibility ? windowTitle(for: app) : nil
        sessionStart = Date()
    }

    // MARK: - On-demand flush

    func triggerImmediateFlush() {
        emitCurrentSession(resetStart: true)
    }

    private func startFlushTimer() {
        flushTimer = Timer.scheduledTimer(
            withTimeInterval: flushInterval,
            repeats: true
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                self.emitCurrentSession(resetStart: true)
                if self.hasAccessibility,
                   let app = NSWorkspace.shared.frontmostApplication {
                    self.currentTitle = self.windowTitle(for: app)
                }
            }
        }
    }

    private func emitCurrentSession(resetStart: Bool = false) {
        guard let app = currentApp, let start = sessionStart else { return }
        let duration = Date().timeIntervalSince(start)
        guard duration >= minDuration else { return }

        let window = ActivityWindow(
            id:        UUID(),
            app:       app,
            title:     currentTitle,
            startedAt: start,
            duration:  duration
        )
        onEvent?(window)
        if resetStart { sessionStart = Date() }
    }

    private func windowTitle(for app: NSRunningApplication) -> String? {
        let axApp = AXUIElementCreateApplication(app.processIdentifier)

        var rawWindow: CFTypeRef?
        guard AXUIElementCopyAttributeValue(
            axApp, kAXFocusedWindowAttribute as CFString, &rawWindow
        ) == .success, let rawWindow else { return nil }

        let windowElement = rawWindow as! AXUIElement

        var rawTitle: CFTypeRef?
        guard AXUIElementCopyAttributeValue(
            windowElement, kAXTitleAttribute as CFString, &rawTitle
        ) == .success else { return nil }

        return rawTitle as? String
    }
}
