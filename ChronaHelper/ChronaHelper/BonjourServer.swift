import Foundation
import Network
import os.log

private let kServiceType        = "_chrona._tcp"
private let kServiceName        = "Chrona Helper"
private let kHeartbeatInterval  : TimeInterval = 10
private let kRestartDelay       : TimeInterval = 3

struct TimerStatePayload {
    let isTracking: Bool
    let projectId: String
    let projectName: String
    let projectColor: String
    let timerTitle: String
    let startTimestamp: String
}

final class BonjourServer {

    // MARK: - Callbacks (called on main queue)

    var onClientConnected:    (() -> Void)?
    var onClientDisconnected: (() -> Void)?
    var onTimerStateReceived: ((TimerStatePayload) -> Void)?

    // MARK: - Private state

    private var listener:       NWListener?
    private var connection:     NWConnection?
    private var heartbeatTimer: Timer?
    private var clientBuffer    = Data()
    private let encoder         = JSONEncoder()
    private let decoder         = JSONDecoder()
    private let log             = Logger(subsystem: "com.chrona.helper", category: "BonjourServer")

    // MARK: - Init / deinit

    init() {
        startListener()
    }

    deinit {
        heartbeatTimer?.invalidate()
        listener?.cancel()
        connection?.cancel()
    }

    // MARK: - Public: send an event

    func send(_ event: ChronaEvent) {
        guard let conn = connection else { return }
        do {
            var data = try encoder.encode(event)
            data.append(0x0A)
            conn.send(content: data, completion: .contentProcessed { [weak self] error in
                if let error {
                    self?.log.warning("send failed: \(error.localizedDescription, privacy: .public)")
                }
            })
        } catch {
            log.error("encode failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Listener lifecycle

    private func startListener() {
        do {
            listener = try NWListener(using: .tcp)
        } catch {
            log.error("NWListener init failed: \(error.localizedDescription, privacy: .public)")
            scheduleRestart()
            return
        }

        listener?.service = NWListener.Service(name: kServiceName, type: kServiceType)

        listener?.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                if let port = self.listener?.port {
                    self.log.info("Bonjour listener ready on port \(port.rawValue, privacy: .public)")
                }
            case .failed(let error):
                self.log.error("Listener failed: \(error.localizedDescription, privacy: .public)")
                self.listener?.cancel()
                self.scheduleRestart()
            default:
                break
            }
        }

        listener?.newConnectionHandler = { [weak self] newConn in
            self?.accept(newConn)
        }

        listener?.start(queue: .main)
    }

    private func scheduleRestart() {
        DispatchQueue.main.asyncAfter(deadline: .now() + kRestartDelay) { [weak self] in
            self?.startListener()
        }
    }

    // MARK: - Connection lifecycle

    private func accept(_ newConn: NWConnection) {
        if let old = connection {
            old.cancel()
            heartbeatTimer?.invalidate()
            heartbeatTimer = nil
        }

        clientBuffer = Data()
        connection = newConn
        log.info("New connection from \(newConn.endpoint.debugDescription, privacy: .public)")

        newConn.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                self.log.info("Client connected")
                self.startHeartbeat()
                self.receiveFromClient()
                self.onClientConnected?()
            case .failed(let error):
                self.log.warning("Connection error: \(error.localizedDescription, privacy: .public)")
                self.handleDisconnect()
            case .cancelled:
                self.handleDisconnect()
            default:
                break
            }
        }

        newConn.start(queue: .main)
    }

    private func handleDisconnect() {
        guard connection != nil else { return }
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        clientBuffer = Data()
        connection = nil
        log.info("Client disconnected — waiting for reconnect")
        onClientDisconnected?()
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: kHeartbeatInterval, repeats: true) { [weak self] _ in
            self?.send(.make(type: .heartbeat))
        }
    }

    // MARK: - Read from client (ping/pong)

    private func receiveFromClient() {
        guard let conn = connection else { return }
        conn.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            if let data, !data.isEmpty {
                self.clientBuffer.append(data)
                self.flushClientBuffer()
            }
            if error != nil || isComplete { return }
            self.receiveFromClient()
        }
    }

    private func flushClientBuffer() {
        while let idx = clientBuffer.firstIndex(of: 0x0A) {
            let line = Data(clientBuffer[clientBuffer.startIndex..<idx])
            clientBuffer.removeSubrange(clientBuffer.startIndex...idx)
            if !line.isEmpty {
                handleClientMessage(line)
            }
        }
    }

    private struct ClientMessage: Decodable {
        let type: String
        let isTracking: Bool?
        let projectId: String?
        let projectName: String?
        let projectColor: String?
        let timerTitle: String?
        let startTimestamp: String?
    }

    private func handleClientMessage(_ data: Data) {
        guard let msg = try? decoder.decode(ClientMessage.self, from: data) else { return }
        switch msg.type {
        case "ping":
            send(.make(type: .pong))
        case "timer_state":
            let payload = TimerStatePayload(
                isTracking: msg.isTracking ?? false,
                projectId: msg.projectId ?? "",
                projectName: msg.projectName ?? "",
                projectColor: msg.projectColor ?? "",
                timerTitle: msg.timerTitle ?? "",
                startTimestamp: msg.startTimestamp ?? ""
            )
            onTimerStateReceived?(payload)
        default:
            break
        }
    }
}
