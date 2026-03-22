import SwiftUI
import os

@main
struct FocusHelperApp: App {

    // MARK: - Instance guard
    //
    // Kept alive for the entire app lifetime so the flock() remains held.
    // Declared as a stored property (not @State) so it outlives scene redraws.
    private let instanceGuard = InstanceGuard()

    // MARK: - Core services

    @StateObject private var poller = ActivityPoller()

    // MARK: - Init

    init() {
        enforceSingleInstance()
        Logger.lifecycle.info("FocusHelper launched — pid=\(ProcessInfo.processInfo.processIdentifier)")
    }

    // MARK: - Scene

    var body: some Scene {
        MenuBarExtra {
            MenuBarView()
                .environmentObject(poller)
        } label: {
            menuBarIcon
        }
        .menuBarExtraStyle(.window)
    }

    // MARK: - Menu bar icon

    /// The icon reflects the aggregate health of the system:
    ///   green  (circle.fill)         — running and healthy
    ///   yellow (exclamationmark.circle.fill) — degraded
    ///   red    (xmark.circle.fill)   — unhealthy or stopped
    @ViewBuilder
    private var menuBarIcon: some View {
        switch iconState {
        case .running:
            Image(systemName: "circle.fill")
                .symbolRenderingMode(.monochrome)
        case .degraded:
            Image(systemName: "exclamationmark.circle.fill")
                .symbolRenderingMode(.monochrome)
                .foregroundStyle(.yellow)
        case .stopped, .unhealthy:
            Image(systemName: "circle.dotted")
                .symbolRenderingMode(.monochrome)
        }
    }

    private enum IconState { case running, degraded, unhealthy, stopped }

    private var iconState: IconState {
        guard poller.isRunning else { return .stopped }
        guard let h = poller.health else { return .running }
        switch h.verdict {
        case .healthy:          return .running
        case .degraded:         return .degraded
        case .unhealthy:        return .unhealthy
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

        let lockDir = support.appendingPathComponent("FocusHelper")

        if !instanceGuard.acquire(in: lockDir) {
            showDuplicateAlert()
        }
    }

    private func showDuplicateAlert() {
        let alert = NSAlert()
        alert.messageText    = "FocusHelper is already running"
        alert.informativeText = "Only one instance of FocusHelper can run at a time. " +
                                "Check the menu bar for the existing instance."
        alert.alertStyle     = .warning
        alert.addButton(withTitle: "OK")
        alert.runModal()
        NSApplication.shared.terminate(nil)
    }
}
