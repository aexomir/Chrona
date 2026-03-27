// StatusBarController.swift — Chrona Helper
//
// Manages the menu bar status item. The app intentionally has no dock icon
// (set via LSUIElement in Info.plist and NSApp.setActivationPolicy(.accessory)
// in AppDelegate), so the status item is the only user-visible surface.

import Cocoa

final class StatusBarController {

    // MARK: - Private state

    private let statusItem: NSStatusItem
    private var isConnected = false

    // MARK: - Init

    init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        configureButton()
        rebuildMenu()
    }

    // MARK: - Public

    /// Updates the connection indicator in the menu.
    func setConnected(_ connected: Bool) {
        guard connected != isConnected else { return }
        isConnected = connected
        rebuildMenu()
    }

    // MARK: - Button

    private func configureButton() {
        guard let button = statusItem.button else { return }

        // SF Symbols clock icon — isTemplate makes it adapt to light/dark menu bars.
        if let image = NSImage(systemSymbolName: "timer", accessibilityDescription: "Chrona Helper") {
            image.isTemplate = true
            button.image = image
        } else {
            button.title = "⏱"
        }

        button.toolTip = "Chrona Helper"
    }

    // MARK: - Menu

    private func rebuildMenu() {
        let menu = NSMenu()

        // App title (non-interactive header)
        let titleItem = NSMenuItem(title: "Chrona Helper", action: nil, keyEquivalent: "")
        titleItem.isEnabled = false
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .semibold)
        ]
        titleItem.attributedTitle = NSAttributedString(string: "Chrona Helper", attributes: attrs)
        menu.addItem(titleItem)

        menu.addItem(.separator())

        // Connection status
        let statusTitle = isConnected ? "● Connected to iOS" : "○ Waiting for iOS…"
        let statusItem  = NSMenuItem(title: statusTitle, action: nil, keyEquivalent: "")
        statusItem.isEnabled = false
        menu.addItem(statusItem)

        menu.addItem(.separator())

        // Shortcut to open Accessibility settings
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

    @objc private func openAccessibilitySettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }
}
