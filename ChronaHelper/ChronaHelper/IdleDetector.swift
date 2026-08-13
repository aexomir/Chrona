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

    /// `(isIdle, idleSeconds)` — the second value is how long input had already
    /// been absent at the moment the transition was noticed. Callers use it to
    /// back-date the idle boundary to when input actually stopped, since the
    /// 10 s poll can only ever notice late.
    var onIdleChanged: ((Bool, TimeInterval) -> Void)?

    private var checkTimer: Timer?
    private var isIdle = false

    func start() {
        checkTimer?.invalidate()
        let timer = Timer.scheduledTimer(
            withTimeInterval: kCheckInterval,
            repeats: true
        ) { [weak self] _ in
            self?.check()
        }
        // .common so idle checks keep running while the status-bar menu is open.
        RunLoop.main.add(timer, forMode: .common)
        checkTimer = timer
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

    /// Re-evaluates immediately instead of waiting for the next tick. Called on
    /// wake and unlock, where the answer has usually just changed and waiting up
    /// to 10 s would mean crediting that time to an app the user isn't using.
    func refresh() {
        check()
    }

    // MARK: - Poll

    private func check() {
        let threshold = IdleDetector.currentThreshold

        if threshold < 0 {
            if isIdle {
                isIdle = false
                onIdleChanged?(false, 0)
            }
            return
        }

        let keyboardIdle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .keyDown)
        let mouseIdle    = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .mouseMoved)
        let idleSeconds  = min(keyboardIdle, mouseIdle)
        let nowIdle      = idleSeconds >= threshold
        guard nowIdle != isIdle else { return }
        isIdle = nowIdle
        onIdleChanged?(isIdle, idleSeconds)
    }
}
