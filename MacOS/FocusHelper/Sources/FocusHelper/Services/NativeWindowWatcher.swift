import AppKit
import ApplicationServices
import Combine
import os

/// Low-level macOS window observer used by `EmbeddedActivitySource`.
///
/// Tracks the frontmost application via NSWorkspace notifications.
/// Window titles are captured via the AXUIElement API only when
/// `permissionManager.permissionState == .granted`.
///
/// Permission logic is fully delegated to `PermissionManager`.
/// This class only observes `permissionManager.permissionState` and reacts:
///   - `.granted`  → immediate re-capture of the current window with title
///   - other       → window titles remain nil; app-name tracking continues
@MainActor
final class NativeWindowWatcher: ObservableObject {

    // MARK: - Public state

    /// True when Accessibility is granted and window titles are being captured.
    @Published private(set) var hasAccessibility = false

    /// Called on MainActor whenever a completed attention span is ready.
    var onEvent: ((ActivityWindow) -> Void)?

    // MARK: - Dependencies

    let permissionManager: PermissionManager

    // MARK: - Tunables

    private let flushInterval: TimeInterval = 30
    private let minDuration:   TimeInterval = 1

    // MARK: - Private state

    private var currentApp:   String?
    private var currentTitle: String?
    private var sessionStart: Date?
    private var activationToken: NSObjectProtocol?
    private var flushTimer: Timer?
    private var permissionCancellable: AnyCancellable?

    // MARK: - Init

    init(permissionManager: PermissionManager) {
        self.permissionManager = permissionManager
        self.hasAccessibility  = permissionManager.permissionState.isGranted
    }

    // MARK: - Lifecycle

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

    // MARK: - Private – permission change handling

    private func handlePermissionChange(_ state: AccessibilityPermissionState) {
        let newValue = state.isGranted
        guard newValue != hasAccessibility else { return }
        hasAccessibility = newValue
        Logger.watcher.info("Watcher accessibility updated: \(newValue)")
    }

    /// Called by PermissionManager when state transitions to .granted.
    /// Performs a full stop/start cycle so the watcher comes up cleanly with
    /// `hasAccessibility = true` and a fresh NSWorkspace observer and flush timer.
    /// This is safer than patching the live state because:
    ///   - `frontmostApplication` can be nil at the exact moment permission is detected
    ///     (System Settings is closing), which would leave `currentApp`/`sessionStart` nil
    ///     and permanently silence event emission.
    ///   - The flush timer and observer retain their correct state after the restart.
    private func recoverAfterGrant() {
        Logger.watcher.info("Recovery after accessibility grant — restarting watcher")
        stop()   // flushes current session, clears state, removes old observers
        start()  // re-registers everything with hasAccessibility = true
    }

    // MARK: - Private – observation

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

    // MARK: - Private – periodic flush

    private func startFlushTimer() {
        flushTimer = Timer.scheduledTimer(
            withTimeInterval: flushInterval,
            repeats: true
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                self.emitCurrentSession(resetStart: true)
                // Re-sample title in case it changed (e.g. new browser tab).
                if self.hasAccessibility,
                   let app = NSWorkspace.shared.frontmostApplication {
                    self.currentTitle = self.windowTitle(for: app)
                }
            }
        }
    }

    // MARK: - Private – event emission

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

    // MARK: - Private – Accessibility API

    private func windowTitle(for app: NSRunningApplication) -> String? {
        let axApp = AXUIElementCreateApplication(app.processIdentifier)

        var rawWindow: CFTypeRef?
        guard AXUIElementCopyAttributeValue(
            axApp, kAXFocusedWindowAttribute as CFString, &rawWindow
        ) == .success, let rawWindow else { return nil }

        // swiftlint:disable:next force_cast
        let windowElement = rawWindow as! AXUIElement

        var rawTitle: CFTypeRef?
        guard AXUIElementCopyAttributeValue(
            windowElement, kAXTitleAttribute as CFString, &rawTitle
        ) == .success else { return nil }

        return rawTitle as? String
    }
}
