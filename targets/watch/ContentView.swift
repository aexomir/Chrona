import SwiftUI
import WatchConnectivity

// MARK: - WCSession delegate / state holder

final class WatchSession: NSObject, WCSessionDelegate, ObservableObject {
    @Published var isTracking = false
    @Published var sessionTitle = ""
    @Published var projectName = ""

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    /// Receive state updates pushed from the iPhone app.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async {
            if let tracking = message["isTracking"] as? Bool {
                self.isTracking = tracking
            }
            if let title = message["title"] as? String {
                self.sessionTitle = title
            }
            if let project = message["projectName"] as? String {
                self.projectName = project
            }
        }
    }

    // MARK: Actions

    /// Send a button-press event to the iPhone app.
    func sendAction(_ action: String) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["action": action], replyHandler: nil, errorHandler: nil)
    }
}

// MARK: - UI

struct ContentView: View {
    @StateObject private var session = WatchSession()

    var body: some View {
        VStack(spacing: 14) {
            // Status label
            if session.isTracking {
                VStack(spacing: 4) {
                    Text(session.projectName.isEmpty ? "Focusing" : session.projectName)
                        .font(.headline)
                        .foregroundStyle(.white)
                    if !session.sessionTitle.isEmpty {
                        Text(session.sessionTitle)
                            .font(.caption2)
                            .foregroundStyle(.gray)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                    }
                }
            } else {
                Text("Focus")
                    .font(.headline)
                    .foregroundStyle(.white)
            }

            // Start / Stop button
            Button {
                session.sendAction(session.isTracking ? "stop" : "start")
            } label: {
                Text(session.isTracking ? "Stop" : "Start")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(session.isTracking ? Color.red.opacity(0.85) : Color.green.opacity(0.85))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
        .padding()
    }
}
