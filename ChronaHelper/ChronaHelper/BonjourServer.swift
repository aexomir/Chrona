import Foundation
import Network
import os.log

private let kServiceType        = "_chrona._tcp"
private let kServiceName        = "Chrona Helper"
private let kHeartbeatInterval  : TimeInterval = 10
private let kRestartDelay       : TimeInterval = 3
private let kAuthTimeout        : TimeInterval = 5
private let kMaxLineBytes       = 8192

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
    private var isAuthenticated = false
    private var authTimeoutItem: DispatchWorkItem?
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
        // Only auth responses are allowed before the client has proven it
        // knows the pairing code — nothing else (including heartbeats) leaks
        // to a connection that hasn't authenticated.
        guard isAuthenticated || event.type == .authOk || event.type == .authFailed else { return }
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
            // Silence the old connection's callbacks first so its async
            // .cancelled state update can't race in later and tear down
            // the new connection we're about to assign below.
            old.stateUpdateHandler = nil
            old.cancel()
        }
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil

        clientBuffer = Data()
        connection = newConn
        isAuthenticated = false
        log.info("New connection from \(newConn.endpoint.debugDescription, privacy: .public)")

        newConn.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                self.log.info("Client connected, awaiting auth")
                self.receiveFromClient(on: newConn)
                self.scheduleAuthTimeout(for: newConn)
            case .failed(let error):
                self.log.warning("Connection error: \(error.localizedDescription, privacy: .public)")
                self.handleDisconnect(newConn)
            case .cancelled:
                self.handleDisconnect(newConn)
            default:
                break
            }
        }

        newConn.start(queue: .main)
    }

    private func scheduleAuthTimeout(for conn: NWConnection) {
        authTimeoutItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.connection === conn, !self.isAuthenticated else { return }
            self.log.info("Client did not authenticate in time — closing")
            conn.cancel()
        }
        authTimeoutItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + kAuthTimeout, execute: item)
    }

    private func handleDisconnect(_ conn: NWConnection) {
        // Defense in depth: even with the stateUpdateHandler cleared above,
        // only ever tear down state if `conn` is still the one we're tracking.
        guard connection === conn else { return }
        authTimeoutItem?.cancel()
        authTimeoutItem = nil
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        clientBuffer = Data()
        connection = nil
        isAuthenticated = false
        log.info("Client disconnected — waiting for reconnect")
        onClientDisconnected?()
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        let timer = Timer.scheduledTimer(withTimeInterval: kHeartbeatInterval, repeats: true) { [weak self] _ in
            self?.send(.make(type: .heartbeat))
        }
        // .common so heartbeats (and thus the client's disconnect watchdog)
        // don't pause while the user has the status-bar menu open.
        RunLoop.main.add(timer, forMode: .common)
        heartbeatTimer = timer
    }

    // MARK: - Read from client (ping/pong)

    private func receiveFromClient(on conn: NWConnection) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] data, _, isComplete, error in
            guard let self, self.connection === conn else { return }
            if let data, !data.isEmpty {
                self.clientBuffer.append(data)
                if self.clientBuffer.count > kMaxLineBytes {
                    // A peer streaming data without ever sending a newline —
                    // malicious or buggy — shouldn't be able to grow this
                    // unboundedly. Close rather than keep buffering forever.
                    self.log.warning("Client buffer exceeded \(kMaxLineBytes, privacy: .public) bytes without a newline — closing")
                    conn.cancel()
                    return
                }
                self.flushClientBuffer()
            }
            if error != nil || isComplete { return }
            self.receiveFromClient(on: conn)
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
        let token: String?
        let isTracking: Bool?
        let projectId: String?
        let projectName: String?
        let projectColor: String?
        let timerTitle: String?
        let startTimestamp: String?
    }

    private func handleClientMessage(_ data: Data) {
        guard let msg = try? decoder.decode(ClientMessage.self, from: data) else { return }

        if msg.type == "auth" {
            handleAuth(msg.token ?? "")
            return
        }

        // Nothing else is processed until the connection has proven it
        // knows the pairing code — this closes off both the read side
        // (window-title/app-name data) and the write side (forged
        // timer_state messages) to unauthenticated peers on the LAN.
        guard isAuthenticated else { return }

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

    private func handleAuth(_ token: String) {
        guard !isAuthenticated else { return }

        guard Pairing.matches(token) else {
            log.info("Auth failed — closing connection")
            send(.make(type: .authFailed))
            if let conn = connection {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    conn.cancel()
                }
            }
            return
        }

        isAuthenticated = true
        authTimeoutItem?.cancel()
        authTimeoutItem = nil
        log.info("Client authenticated")
        send(.make(type: .authOk))
        startHeartbeat()
        onClientConnected?()
    }
}
