// AppDelegate.swift — Chrona Helper
//
// Entry point. Sets up the components:
//   - ActivityLedger       — durable on-disk record of app spans and gaps
//   - StatusBarController  — the menu bar item
//   - BonjourServer        — Bonjour-advertised TCP server
//   - AppObserver          — NSWorkspace + Accessibility watcher
//   - IdleDetector         — input-idle transitions
//   - SystemStateObserver  — sleep / lock / user switch
//
// Observations flow two ways. Live events go AppObserver → BonjourServer → iOS
// and are dropped if nobody is listening. Durations go AppObserver →
// ActivityLedger → disk, and are answered on demand via `usage_query`, which is
// why a session tracks correctly even if the iOS app was never connected.

import Cocoa
import ApplicationServices
import ServiceManagement
import os.log

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var ledger:       ActivityLedger!
    private var statusBar:    StatusBarController!
    private var server:       BonjourServer!
    private var observer:     AppObserver!
    private var idleDetector: IdleDetector!
    private var systemState:  SystemStateObserver!
    private let log = Logger(subsystem: "com.chrona.helper", category: "AppDelegate")

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Remove from the Dock — this app lives exclusively in the menu bar.
        NSApp.setActivationPolicy(.accessory)

        registerAsLoginItemIfNeeded()

        ledger       = ActivityLedger()
        statusBar    = StatusBarController()
        server       = BonjourServer()
        observer     = AppObserver(ledger: ledger)
        idleDetector = IdleDetector()
        systemState  = SystemStateObserver()

        // Request Accessibility permission after the run loop is settled.
        // - takeUnretainedValue() is correct for CF constants (we don't own the +1 ref).
        // - The short delay avoids the prompt being swallowed during app launch on Sequoia.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
            AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
        }

        // Server → StatusBar
        server.onClientConnected = { [weak self] in
            self?.statusBar.setConnected(true)
            // Send the current app state immediately so the iOS app is never in the dark.
            if let snapshot = self?.observer.currentSnapshot() {
                self?.server.send(snapshot)
            }
        }
        server.onClientDisconnected = { [weak self] in
            self?.statusBar.setConnected(false)
        }
        server.onTimerStateReceived = { [weak self] payload in
            self?.statusBar.setTimerState(payload)
        }
        server.onUsageQuery = { [weak self] requestId, from, to in
            guard let self else { return }
            let result = self.ledger.query(
                requestId: requestId, from: from, to: to,
                openSpan: self.observer.openSpan()
            )
            self.server.sendUsageResult(result)
        }

        // Observer → Server
        observer.onEvent = { [weak self] event in
            self?.server.send(event)
        }
        observer.start()

        // IdleDetector → Observer (stop attributing time) + Server (live event)
        idleDetector.onIdleChanged = { [weak self] isIdle, idleSeconds in
            guard let self else { return }
            if isIdle {
                self.observer.suspend(
                    reason: .idle,
                    backdatedTo: Date().timeIntervalSince1970 - idleSeconds
                )
            } else {
                self.observer.resume(reason: .idle)
            }
            self.server.send(.make(type: isIdle ? .userIdle : .userActive))
        }
        idleDetector.start()

        // SystemStateObserver → Observer
        systemState.onSuspend = { [weak self] reason in
            // No back-dating here: unlike idle, these transitions are delivered
            // at the moment they happen.
            self?.observer.suspend(reason: reason, backdatedTo: Date().timeIntervalSince1970)
        }
        systemState.onResume = { [weak self] reason in
            self?.observer.resume(reason: reason)
            // The user may have walked away while the machine slept — re-check
            // now rather than crediting up to 10 s to whatever is frontmost.
            self?.idleDetector.refresh()
        }
        systemState.start()

        statusBar.usageSnapshotProvider = { [weak self] in
            guard let self else { return nil }
            return self.ledger.query(
                requestId: "debug",
                from: Date().timeIntervalSince1970 - 3600,
                to: Date().timeIntervalSince1970,
                openSpan: self.observer.openSpan()
            )
        }
        statusBar.logDirectoryProvider = { [weak self] in self?.ledger.logDirectory }
    }

    // MARK: - Lifecycle

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Never quit when a window closes — there are no windows.
        false
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Close and persist the span in progress, so a clean quit doesn't lose
        // the stretch since the last checkpoint.
        observer?.flush()
    }

    // MARK: - Login item

    /// Registers this app to launch at login. Best-effort — a failure here
    /// should never block launch or surface an alert; the user can still
    /// toggle it manually from the menu bar (see StatusBarController).
    private func registerAsLoginItemIfNeeded() {
        let service = SMAppService.mainApp
        guard service.status != .enabled else { return }
        do {
            try service.register()
        } catch {
            log.error("SMAppService registration failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
