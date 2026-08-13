// SystemStateObserver.swift — Chrona Helper
//
// Watches the coarse machine-level states in which no app should be accruing
// time: the display locked, the user session switched away, or the machine
// asleep.
//
// Without this, a Mac asleep for three hours is indistinguishable from three
// hours spent in whichever app was frontmost at bedtime — the frontmost app
// simply never changes, so no observation ever contradicts it. Idle detection
// alone doesn't cover it either: `secondsSinceLastEventType` keeps counting
// across sleep, but the transition only fires once and the wake side needs an
// explicit signal to re-evaluate.

import Cocoa

final class SystemStateObserver {

    /// Fired when time should stop being attributed to any app.
    var onSuspend: ((GapReason) -> Void)?
    /// Fired when the machine is usable again. The matching reason is passed so
    /// overlapping suspensions (idle *and* asleep) unwind independently.
    var onResume: ((GapReason) -> Void)?

    private var observers: [NSObjectProtocol] = []

    func start() {
        let workspace = NSWorkspace.shared.notificationCenter

        observe(workspace, NSWorkspace.willSleepNotification) { [weak self] in
            self?.onSuspend?(.asleep)
        }
        observe(workspace, NSWorkspace.didWakeNotification) { [weak self] in
            self?.onResume?(.asleep)
        }

        // Fast user switching — the session is no longer ours to observe.
        observe(workspace, NSWorkspace.sessionDidResignActiveNotification) { [weak self] in
            self?.onSuspend?(.locked)
        }
        observe(workspace, NSWorkspace.sessionDidBecomeActiveNotification) { [weak self] in
            self?.onResume?(.locked)
        }

        // Screen lock has no NSWorkspace equivalent; these are the long-standing
        // distributed notifications loginwindow posts.
        let distributed = DistributedNotificationCenter.default()
        observe(distributed, Notification.Name("com.apple.screenIsLocked")) { [weak self] in
            self?.onSuspend?(.locked)
        }
        observe(distributed, Notification.Name("com.apple.screenIsUnlocked")) { [weak self] in
            self?.onResume?(.locked)
        }
    }

    func stop() {
        for observer in observers {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
            DistributedNotificationCenter.default().removeObserver(observer)
        }
        observers = []
    }

    deinit {
        stop()
    }

    private func observe(_ center: NotificationCenter, _ name: Notification.Name, _ handler: @escaping () -> Void) {
        let token = center.addObserver(forName: name, object: nil, queue: .main) { _ in
            handler()
        }
        observers.append(token)
    }
}
