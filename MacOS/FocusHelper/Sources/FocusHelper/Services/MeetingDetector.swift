import AppKit
import Combine
import os

// MARK: - MeetingDetector
//
// Detects active video-call sessions by inspecting NSWorkspace.shared.runningApplications.
// Detection fires immediately on app launch/termination (via NSWorkspace notifications)
// and polls every 30 seconds as a safety net.
//
// The app does NOT need to be frontmost — any running instance counts as "in a meeting."
//
// Preferences (enabled flag + per-app toggles) are persisted to UserDefaults and
// survive restarts. The list of supported apps lives in MeetingAppRegistry; adding a
// new app there requires no changes here.

@MainActor
final class MeetingDetector: ObservableObject {

    // MARK: - Published state

    @Published private(set) var meetingState: MeetingState = .none

    // MARK: - Preferences
    //
    // Each setter persists to UserDefaults immediately so preferences survive restarts.

    @Published var isEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isEnabled, forKey: Keys.enabled)
            if isEnabled {
                startPolling()
            } else {
                stopPolling()
                meetingState = .none
            }
        }
    }

    @Published var monitoredIds: Set<String> {
        didSet {
            if let data = try? JSONEncoder().encode(Array(monitoredIds)) {
                UserDefaults.standard.set(data, forKey: Keys.monitoredIds)
            }
            if isEnabled { detectNow() }
        }
    }

    // MARK: - Private

    private var pollTimer: Timer?
    private var workspaceObservers: [NSObjectProtocol] = []
    private let pollInterval: TimeInterval = 30

    private enum Keys {
        static let enabled      = "com.focus.meetingDetection.enabled"
        static let monitoredIds = "com.focus.meetingDetection.monitoredIds"
    }

    // MARK: - Init

    init() {
        // Restore persisted preferences.
        // Default: detection off, all known apps monitored.
        let savedEnabled = UserDefaults.standard.bool(forKey: Keys.enabled)
        var savedIds: Set<String> = Set(MeetingAppRegistry.all.map(\.id))
        if let data = UserDefaults.standard.data(forKey: Keys.monitoredIds),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            savedIds = Set(decoded)
        }
        self.isEnabled    = savedEnabled
        self.monitoredIds = savedIds

        subscribeToWorkspaceNotifications()
        if savedEnabled { startPolling() }

        Logger.meetings.info("MeetingDetector ready — enabled=\(savedEnabled), apps=\(savedIds)")
    }

    // MARK: - App toggle

    func toggleApp(_ id: String) {
        if monitoredIds.contains(id) {
            monitoredIds.remove(id)
        } else {
            monitoredIds.insert(id)
        }
    }

    // MARK: - Detection

    private func detectNow() {
        guard isEnabled else { return }
        let runningApps = NSWorkspace.shared.runningApplications
        let activeDefs  = MeetingAppRegistry.all.filter { monitoredIds.contains($0.id) }

        for def in activeDefs {
            // 1. Exact bundle ID match — most reliable; survives app renames.
            let matchedByBundle = def.bundleIds.contains { bundleId in
                runningApps.contains { $0.bundleIdentifier == bundleId }
            }
            if matchedByBundle { return applyMeeting(def) }

            // 2. Process name substring match — fallback for apps with variable bundle IDs.
            let matchedByName = def.processNamePatterns.contains { pattern in
                let lower = pattern.lowercased()
                return runningApps.contains { ($0.localizedName?.lowercased().contains(lower) ?? false) }
            }
            if matchedByName { return applyMeeting(def) }
        }

        applyNoMeeting()
    }

    private func applyMeeting(_ def: MeetingAppDef) {
        let next = MeetingState(isInMeeting: true, appId: def.id, appDisplayName: def.displayName)
        guard meetingState != next else { return }
        meetingState = next
        Logger.meetings.info("Meeting started — app=\(def.displayName)")
    }

    private func applyNoMeeting() {
        guard meetingState != .none else { return }
        Logger.meetings.info("Meeting ended — was=\(self.meetingState.appDisplayName ?? "?")")
        meetingState = .none
    }

    // MARK: - Polling

    private func startPolling() {
        detectNow()
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in self?.detectNow() }
        }
    }

    private func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }

    // MARK: - Workspace notifications
    //
    // Fires detectNow() immediately when any app launches or terminates so the
    // meeting state updates within milliseconds of the user joining or leaving.

    private func subscribeToWorkspaceNotifications() {
        let nc = NSWorkspace.shared.notificationCenter
        let handler: (Notification) -> Void = { [weak self] _ in
            Task { @MainActor [weak self] in self?.detectNow() }
        }
        let launchObs = nc.addObserver(
            forName: NSWorkspace.didLaunchApplicationNotification,
            object: nil, queue: .main, using: handler
        )
        let terminateObs = nc.addObserver(
            forName: NSWorkspace.didTerminateApplicationNotification,
            object: nil, queue: .main, using: handler
        )
        workspaceObservers = [launchObs, terminateObs]
    }
}
