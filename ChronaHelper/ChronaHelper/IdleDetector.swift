// IdleDetector.swift — Chrona Helper
//
// Polls the system's combined input-idle time using CoreGraphics and fires
// `onIdleChanged` whenever the user crosses the configured idle threshold in
// either direction.
//
// The threshold is persisted in UserDefaults so it survives restarts and can
// be changed at runtime from the status bar menu without restarting the timer.
// A stored value of -1 means the feature is disabled.
//
// Check interval: every 10 seconds.

import CoreGraphics
import Foundation

let kIdleThresholdKey     = "chrona.idleThreshold"
let kIdleThresholdDefault = 5.0 * 60  // seconds

let kIdleThresholdOptions: [(label: String, seconds: Double)] = [
    ("Off",        -1),
    ("2 minutes",  2  * 60),
    ("5 minutes",  5  * 60),
    ("10 minutes", 10 * 60),
    ("15 minutes", 15 * 60),
    ("30 minutes", 30 * 60),
]

private let kCheckInterval: TimeInterval = 10

final class IdleDetector {

    var onIdleChanged: ((Bool) -> Void)?

    private var checkTimer: Timer?
    private var isIdle = false

    func start() {
        checkTimer?.invalidate()
        checkTimer = Timer.scheduledTimer(
            withTimeInterval: kCheckInterval,
            repeats: true
        ) { [weak self] _ in
            self?.check()
        }
    }

    func stop() {
        checkTimer?.invalidate()
        checkTimer = nil
    }

    // MARK: - Threshold (readable by menu)

    static var currentThreshold: Double {
        let stored = UserDefaults.standard.object(forKey: kIdleThresholdKey)
        return stored != nil ? UserDefaults.standard.double(forKey: kIdleThresholdKey) : kIdleThresholdDefault
    }

    static func setThreshold(_ seconds: Double) {
        UserDefaults.standard.set(seconds, forKey: kIdleThresholdKey)
    }

    // MARK: - Poll

    private func check() {
        let threshold = IdleDetector.currentThreshold

        if threshold < 0 {
            if isIdle {
                isIdle = false
                onIdleChanged?(false)
            }
            return
        }

        let keyboardIdle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .keyDown)
        let mouseIdle    = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .mouseMoved)
        let idleSeconds  = min(keyboardIdle, mouseIdle)
        let nowIdle      = idleSeconds >= threshold
        guard nowIdle != isIdle else { return }
        isIdle = nowIdle
        onIdleChanged?(isIdle)
    }
}
