import AppKit
import ApplicationServices
import Combine
import os

// MARK: - AccessibilityPermissionState

/// The three meaningful states of the macOS Accessibility permission for this process.
///
/// macOS does not expose the prompt-history directly, so we use `UserDefaults` to
/// remember whether we have ever shown the system prompt.  That lets us distinguish
/// "never asked" from "asked and denied", which drives the correct action button.
enum AccessibilityPermissionState: Equatable {
    /// `AXIsProcessTrusted()` is true — full window-title tracking is active.
    case granted
    /// We have never shown the system Accessibility prompt.
    /// Correct action: show the system prompt via `AXIsProcessTrustedWithOptions`.
    case notDetermined
    /// We showed the prompt and the user did not grant access
    /// (or later revoked it in System Settings).
    /// Correct action: open System Settings > Privacy & Security > Accessibility.
    case denied

    // MARK: Derived UI helpers

    var isGranted: Bool { self == .granted }

    var actionLabel: String {
        switch self {
        case .granted:        return ""
        case .notDetermined:  return "Enable Access"
        case .denied:         return "Open Settings"
        }
    }

    var explanationText: String {
        switch self {
        case .granted:
            return "Full tracking active — app names and window titles are recorded."
        case .notDetermined:
            return "Grant Accessibility access to record window titles alongside app names. " +
                   "App-name tracking works without it."
        case .denied:
            return "Accessibility access was not granted. Open System Settings to enable it. " +
                   "App-name tracking continues in the meantime."
        }
    }
}

// MARK: - PermissionManager

/// Single source of truth for the Accessibility permission state.
///
/// Responsibilities:
///   - Derives the current `AccessibilityPermissionState` from `AXIsProcessTrusted()`
///     and a UserDefaults flag that records whether we have ever prompted the user.
///   - Polls at **5 s** when permission is not granted so the app recovers quickly
///     when the user enables access in System Settings.
///   - Polls at **60 s** when granted, to detect revocations.
///   - Routes user action to the correct call: system prompt (first time) or
///     direct System Settings deep-link (after denial).
///   - Fires `onGranted` when the state transitions to `.granted` so callers
///     (e.g. `NativeWindowWatcher`) can immediately resume full tracking.
///
/// All methods run on MainActor.
@MainActor
final class PermissionManager: ObservableObject {

    // MARK: - Published state

    @Published private(set) var permissionState: AccessibilityPermissionState

    // MARK: - Recovery callback

    /// Called on MainActor the moment the state transitions **into** `.granted`.
    /// Use this to trigger immediate re-capture of the current window title.
    var onGranted: (() -> Void)?

    // MARK: - Constants

    private let promptedKey       = "com.focus.FocusHelper.accessibilityPrompted"
    private let fastPollInterval:  TimeInterval = 5
    private let slowPollInterval:  TimeInterval = 60

    // MARK: - Private

    private var pollTask: Task<Void, Never>?

    // MARK: - Init

    init() {
        permissionState = Self.evaluate(
            prompted: UserDefaults.standard.bool(forKey: "com.focus.FocusHelper.accessibilityPrompted")
        )
        Logger.watcher.info("PermissionManager init — state=\(String(describing: self.permissionState))")
    }

    // MARK: - Monitoring

    /// Begin polling for permission changes. Safe to call multiple times.
    func startMonitoring() {
        guard pollTask == nil else { return }
        Logger.watcher.debug("PermissionManager: monitoring started")
        schedulePoll()
    }

    func stopMonitoring() {
        pollTask?.cancel()
        pollTask = nil
        Logger.watcher.debug("PermissionManager: monitoring stopped")
    }

    // MARK: - User actions

    /// Called when the user taps the permission action button.
    /// Routes to the system prompt on first request, or System Settings after denial.
    func performAction() {
        switch permissionState {
        case .granted:
            break   // nothing to do
        case .notDetermined:
            showSystemPrompt()
        case .denied:
            openSystemSettings()
        }
    }

    /// Opens System Settings directly at the Accessibility privacy pane.
    func openSystemSettings() {
        let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!
        NSWorkspace.shared.open(url)
        Logger.watcher.info("PermissionManager: opened System Settings > Accessibility")
        // After the user acts in Settings, ramp up polling to catch the change quickly.
        scheduleRapidRecheck(times: 8, interval: 3)
    }

    // MARK: - Private – permission evaluation

    /// Derives the permission state from `AXIsProcessTrusted()` and the prompted flag.
    private static func evaluate(prompted: Bool) -> AccessibilityPermissionState {
        if AXIsProcessTrusted() { return .granted }
        return prompted ? .denied : .notDetermined
    }

    // MARK: - Private – system prompt

    private func showSystemPrompt() {
        // Record that we have shown the prompt so subsequent failures map to .denied.
        UserDefaults.standard.set(true, forKey: promptedKey)

        let options: CFDictionary = [
            kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true
        ] as CFDictionary
        AXIsProcessTrustedWithOptions(options)

        Logger.watcher.info("PermissionManager: system Accessibility prompt presented")
        // Poll quickly to detect the user's response.
        scheduleRapidRecheck(times: 8, interval: 3)
    }

    // MARK: - Private – polling

    private func schedulePoll() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                let interval = await MainActor.run { self?.permissionState == .granted
                    ? self?.slowPollInterval ?? 60
                    : self?.fastPollInterval ?? 5
                }
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                if Task.isCancelled { break }
                await MainActor.run { self?.refresh() }
            }
        }
    }

    /// Fires a burst of rapid checks right after a user action in the prompt or Settings.
    private func scheduleRapidRecheck(times: Int, interval: TimeInterval) {
        Task { [weak self] in
            for _ in 0 ..< times {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                let done = await MainActor.run { () -> Bool in
                    self?.refresh()
                    return self?.permissionState == .granted
                }
                if done { break }
            }
        }
    }

    // MARK: - Private – state refresh

    private func refresh() {
        let prompted    = UserDefaults.standard.bool(forKey: promptedKey)
        let newState    = Self.evaluate(prompted: prompted)
        guard newState != permissionState else { return }

        let previous    = permissionState
        permissionState = newState
        Logger.watcher.info(
            "Permission changed: \(String(describing: previous)) → \(String(describing: newState))"
        )

        if newState == .granted {
            Logger.watcher.info("Accessibility granted — triggering recovery")
            onGranted?()
        }
    }
}
