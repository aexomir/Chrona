import SwiftUI
import os

@main
struct ChronaHelperApp: App {

    // MARK: - Instance guard
    //
    // Kept alive for the entire app lifetime so the flock() remains held.
    // Declared as a stored property (not @State) so it outlives scene redraws.
    private let instanceGuard = InstanceGuard()

    // MARK: - Core services

    @StateObject private var coordinator = ActivityCoordinator()

    // MARK: - Init

    init() {
        enforceSingleInstance()
        Logger.lifecycle.info("ChronaHelper launched — pid=\(ProcessInfo.processInfo.processIdentifier)")
    }

    // MARK: - Scene

    var body: some Scene {
        MenuBarExtra {
            MenuBarView()
                .environmentObject(coordinator)
                .environmentObject(coordinator.meetingDetector)
        } label: {
            menuBarIcon
        }
        .menuBarExtraStyle(.window)
    }

    // MARK: - Menu bar icon
    //
    // Symbol:  waveform          — running & healthy
    //          waveform.badge.exclamationmark — degraded / permission issue
    //          waveform (gray)   — stopped or unhealthy
    //
    // Badge:   green dot         — at least one iOS client connected
    //          (none)            — no client / stopped
    // MARK: - Menu bar icon
    //
    // Symbol:  timer (stopwatch)  — always; color + badge carry the state
    //
    // Color:   .primary  — running & healthy
    //          .yellow   — degraded / permission issue
    //          .secondary — stopped or unhealthy
    //
    // Badge:   green dot — at least one iOS client connected
    //          (none)    — no client / stopped
    @ViewBuilder
    private var menuBarIcon: some View {
        ZStack(alignment: .bottomTrailing) {
            Image(systemName: "timer")
                .font(.system(size: 13, weight: .light))
                .foregroundStyle(iconTint)
                .frame(width: 18, height: 16)

            if coordinator.isRunning && coordinator.connectedClients > 0 {
                Circle()
                    .fill(Color.green)
                    .frame(width: 5, height: 5)
                    .offset(x: 1, y: 1)
            }
        }
    }

    private var iconTint: Color {
        switch iconState {
        case .running:            return .primary
        case .degraded:           return .yellow
        case .stopped, .unhealthy: return .secondary
        }
    }

    private enum IconState { case running, degraded, unhealthy, stopped }

    private var iconState: IconState {
        guard coordinator.isRunning else { return .stopped }
        guard let h = coordinator.health else { return .running }
        switch h.verdict {
        case .healthy:   return .running
        case .degraded:  return .degraded
        case .unhealthy: return .unhealthy
        }
    }

    // MARK: - Single instance enforcement

    private func enforceSingleInstance() {
        guard let support = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ) else { return }

        let lockDir = support.appendingPathComponent("ChronaHelper")

        if !instanceGuard.acquire(in: lockDir) {
            showDuplicateAlert()
        }
    }

    private func showDuplicateAlert() {
        let alert = NSAlert()
        alert.messageText    = "ChronaHelper is already running"
        alert.informativeText = "Only one instance of ChronaHelper can run at a time. " +
                                "Check the menu bar for the existing instance."
        alert.alertStyle     = .warning
        alert.addButton(withTitle: "OK")
        alert.runModal()
        NSApplication.shared.terminate(nil)
    }
}
