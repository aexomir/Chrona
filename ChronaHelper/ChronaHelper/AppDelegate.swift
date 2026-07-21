// AppDelegate.swift — Chrona Helper
//
// Entry point. Sets up the three main components:
//   - StatusBarController  — the menu bar item
//   - BonjourServer        — Bonjour-advertised TCP server
//   - AppObserver          — NSWorkspace + Accessibility watcher
//
// Wires them together so every observation flows: AppObserver → BonjourServer → iOS.

import Cocoa
import ApplicationServices
import ServiceManagement
import os.log

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var statusBar:    StatusBarController!
    private var server:       BonjourServer!
    private var observer:     AppObserver!
    private var idleDetector: IdleDetector!
    private let log = Logger(subsystem: "com.chrona.helper", category: "AppDelegate")

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Remove from the Dock — this app lives exclusively in the menu bar.
        NSApp.setActivationPolicy(.accessory)

        registerAsLoginItemIfNeeded()

        statusBar    = StatusBarController()
        server       = BonjourServer()
        observer     = AppObserver()
        idleDetector = IdleDetector()

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

        // Observer → Server
        observer.onEvent = { [weak self] event in
            self?.server.send(event)
        }

        // IdleDetector → Server
        idleDetector.onIdleChanged = { [weak self] isIdle in
            self?.server.send(.make(type: isIdle ? .userIdle : .userActive))
        }
        idleDetector.start()
    }

    // MARK: - Lifecycle

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Never quit when a window closes — there are no windows.
        false
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
