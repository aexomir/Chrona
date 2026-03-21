import ExpoModulesCore
import WatchConnectivity

public class WatchConnectivityModule: Module {
    private let delegate = WCDelegate()

    public func definition() -> ModuleDefinition {
        Name("WatchConnectivity")

        // Events emitted to JavaScript
        Events("onWatchMessage")

        OnCreate {
            self.delegate.onMessage = { [weak self] message in
                self?.sendEvent("onWatchMessage", message)
            }
            WCDelegate.shared = self.delegate
            if WCSession.isSupported() {
                WCSession.default.delegate = self.delegate
                WCSession.default.activate()
            }
        }

        /// Send a message to the Apple Watch.
        AsyncFunction("sendToWatch") { (message: [String: Any], promise: Promise) in
            guard WCSession.isSupported(),
                  WCSession.default.activationState == .activated,
                  WCSession.default.isPaired,
                  WCSession.default.isWatchAppInstalled else {
                promise.resolve(nil)
                return
            }
            if WCSession.default.isReachable {
                WCSession.default.sendMessage(message, replyHandler: nil) { error in
                    promise.reject(Exception(name: "SendError", description: error.localizedDescription))
                }
            } else {
                // Fall back to application context for non-reachable state
                do {
                    try WCSession.default.updateApplicationContext(message)
                    promise.resolve(nil)
                } catch {
                    promise.reject(Exception(name: "ContextError", description: error.localizedDescription))
                }
            }
            promise.resolve(nil)
        }

        /// Returns whether the paired watch is currently reachable.
        Function("isReachable") {
            guard WCSession.isSupported() else { return false }
            return WCSession.default.isReachable
        }
    }
}

// MARK: - WCSession Delegate

final class WCDelegate: NSObject, WCSessionDelegate {
    var onMessage: (([String: Any]) -> Void)?

    // Shared reference so AppDelegate / other code can set the delegate once.
    static var shared: WCDelegate?

    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    /// Receive messages sent by the watch (e.g. start / stop button presses).
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        onMessage?(message)
    }

    /// Receive application context updates (background state sync from watch).
    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        onMessage?(applicationContext)
    }
}
