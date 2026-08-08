// StatusBarController.swift — Chrona Helper
//
// Manages the menu bar status item. The app intentionally has no dock icon
// (set via LSUIElement in Info.plist and NSApp.setActivationPolicy(.accessory)
// in AppDelegate), so the status item is the only user-visible surface.

import Cocoa
import ServiceManagement
import os.log

final class StatusBarController {

    // MARK: - Private state

    private let statusItem: NSStatusItem
    private var isConnected = false
    private var timerState: TimerStatePayload?
    private var startDate: Date?
    private var elapsedTimer: Timer?
    private let log = Logger(subsystem: "com.chrona.helper", category: "StatusBarController")

    // MARK: - Init

    init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        updateButton()
        rebuildMenu()
    }

    // MARK: - Public

    func setConnected(_ connected: Bool) {
        guard connected != isConnected else { return }
        isConnected = connected
        if !connected {
            timerState = nil
            startDate = nil
            stopElapsedTimer()
        }
        updateButton()
        rebuildMenu()
    }

    func setTimerState(_ payload: TimerStatePayload) {
        timerState = payload
        if payload.isTracking, !payload.startTimestamp.isEmpty {
            let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        startDate = fmt.date(from: payload.startTimestamp)
        } else {
            startDate = nil
        }
        updateButton()
        rebuildMenu()
        startOrStopElapsedTimer()
    }

    // MARK: - Button

    private func updateButton() {
        guard let button = statusItem.button else { return }

        if let state = timerState, state.isTracking {
            let elapsed = formatElapsed()
            let attrStr = NSMutableAttributedString()

            if !state.projectColor.isEmpty, let color = NSColor.fromHex(state.projectColor) {
                attrStr.append(NSAttributedString(
                    string: "● ",
                    attributes: [.foregroundColor: color]
                ))
            }

            let label = state.projectName.isEmpty ? elapsed : "\(state.projectName)  \(elapsed)"
            attrStr.append(NSAttributedString(
                string: label,
                attributes: [.foregroundColor: NSColor.labelColor]
            ))

            button.image = nil
            button.attributedTitle = attrStr
        } else {
            button.attributedTitle = NSAttributedString(string: "")
            if let image = NSImage(systemSymbolName: "timer", accessibilityDescription: "Chrona Helper") {
                image.isTemplate = true
                button.image = image
            } else {
                button.attributedTitle = NSAttributedString(string: "⏱")
            }
        }

        button.toolTip = "Chrona Helper"
    }

    // MARK: - Elapsed timer

    private func startOrStopElapsedTimer() {
        stopElapsedTimer()
        guard timerState?.isTracking == true else { return }
        let timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.updateButton()
        }
        // .common so the elapsed-time label keeps ticking while the status-bar
        // menu is open, instead of freezing at the moment the user opens it.
        RunLoop.main.add(timer, forMode: .common)
        elapsedTimer = timer
    }

    private func stopElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = nil
    }

    private func formatElapsed() -> String {
        guard let start = startDate else { return "0:00" }
        let total = max(0, Int(Date().timeIntervalSince(start)))
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        } else {
            return String(format: "%d:%02d", m, s)
        }
    }

    // MARK: - Menu

    private func rebuildMenu() {
        let menu = NSMenu()

        let titleItem = NSMenuItem(title: "Chrona Helper", action: nil, keyEquivalent: "")
        titleItem.isEnabled = false
        titleItem.attributedTitle = NSAttributedString(
            string: "Chrona Helper",
            attributes: [.font: NSFont.systemFont(ofSize: 12, weight: .semibold)]
        )
        menu.addItem(titleItem)

        menu.addItem(.separator())

        if let state = timerState, state.isTracking {
            let sessionLabel = state.timerTitle.isEmpty ? "Session" : state.timerTitle
            let projectSuffix = state.projectName.isEmpty ? "" : " · \(state.projectName)"
            let sessionItem = NSMenuItem(title: "\(sessionLabel)\(projectSuffix)", action: nil, keyEquivalent: "")
            sessionItem.isEnabled = false
            menu.addItem(sessionItem)
            menu.addItem(.separator())
        }

        let statusTitle = isConnected ? "● Connected to iOS" : "○ Waiting for iOS…"
        let statusItem  = NSMenuItem(title: statusTitle, action: nil, keyEquivalent: "")
        statusItem.isEnabled = false
        menu.addItem(statusItem)

        menu.addItem(.separator())

        let codeItem = NSMenuItem(
            title: "Pairing Code: \(Pairing.currentCode)  (click to copy)",
            action: #selector(copyPairingCode),
            keyEquivalent: ""
        )
        codeItem.target = self
        menu.addItem(codeItem)

        let regenItem = NSMenuItem(
            title: "Regenerate Pairing Code…",
            action: #selector(regeneratePairingCode),
            keyEquivalent: ""
        )
        regenItem.target = self
        menu.addItem(regenItem)

        menu.addItem(.separator())

        let idleMenu = NSMenu()
        let currentThreshold = IdleDetector.currentThreshold
        for option in kIdleThresholdOptions {
            let item = NSMenuItem(
                title: option.label,
                action: #selector(setIdleThreshold(_:)),
                keyEquivalent: ""
            )
            item.target = self
            item.representedObject = option.seconds
            item.state = (option.seconds == currentThreshold ||
                          (option.seconds == kIdleThresholdDefault &&
                           UserDefaults.standard.object(forKey: kIdleThresholdKey) == nil)) ? .on : .off
            idleMenu.addItem(item)
        }
        let idleItem = NSMenuItem(title: "Idle Detection", action: nil, keyEquivalent: "")
        idleItem.submenu = idleMenu
        menu.addItem(idleItem)

        menu.addItem(.separator())

        let launchItem = NSMenuItem(
            title: "Launch at Login",
            action: #selector(toggleLaunchAtLogin),
            keyEquivalent: ""
        )
        launchItem.target = self
        launchItem.state = (SMAppService.mainApp.status == .enabled) ? .on : .off
        menu.addItem(launchItem)

        menu.addItem(.separator())

        let accessItem = NSMenuItem(
            title: "Accessibility Settings…",
            action: #selector(openAccessibilitySettings),
            keyEquivalent: ""
        )
        accessItem.target = self
        menu.addItem(accessItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(
            title: "Quit Chrona Helper",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        menu.addItem(quitItem)

        self.statusItem.menu = menu
    }

    // MARK: - Actions

    @objc private func setIdleThreshold(_ sender: NSMenuItem) {
        guard let seconds = sender.representedObject as? Double else { return }
        IdleDetector.setThreshold(seconds)
        rebuildMenu()
    }

    @objc private func copyPairingCode() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(Pairing.currentCode, forType: .string)
    }

    @objc private func regeneratePairingCode() {
        let alert = NSAlert()
        alert.messageText = "Regenerate Pairing Code?"
        alert.informativeText = "Your iOS app will need to enter the new code to reconnect."
        alert.addButton(withTitle: "Regenerate")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        Pairing.regenerate()
        rebuildMenu()
    }

    @objc private func openAccessibilitySettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc private func toggleLaunchAtLogin() {
        let service = SMAppService.mainApp
        do {
            if service.status == .enabled {
                try service.unregister()
            } else {
                try service.register()
            }
        } catch {
            log.error("SMAppService toggle failed: \(error.localizedDescription, privacy: .public)")
        }
        rebuildMenu()
    }
}

// MARK: - NSColor hex helper

private extension NSColor {
    static func fromHex(_ hex: String) -> NSColor? {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let rgb = UInt64(s, radix: 16) else { return nil }
        let r = CGFloat((rgb >> 16) & 0xFF) / 255
        let g = CGFloat((rgb >> 8) & 0xFF) / 255
        let b = CGFloat(rgb & 0xFF) / 255
        return NSColor(calibratedRed: r, green: g, blue: b, alpha: 1.0)
    }
}
