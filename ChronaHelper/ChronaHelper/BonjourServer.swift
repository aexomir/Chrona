// BonjourServer.swift — Chrona Helper
//
// Advertises a TCP service over Bonjour and streams ChronaEvents to exactly one
// connected iOS client at a time.
//
// Discovery (iOS side):
//   let browser = NWBrowser(for: .bonjour(type: "_chrona._tcp", domain: nil), using: .tcp)
//   // Resolve the endpoint and connect with NWConnection.
//
// Connection model:
//   - The listener accepts the first incoming connection.
//   - If a second client connects while one is already active, the old one is cancelled
//     and replaced (single-client design keeps the protocol simple).
//   - If the connection drops, the listener keeps running — the iOS client should
//     re-browse and reconnect.
//
// Framing: each event is written as UTF-8 JSON followed by a single `\n` byte.
//
// Heartbeats: a 30-second timer sends a `heartbeat` event when the app is idle,
// keeping the TCP connection alive through NAT/firewall inactivity timeouts.

import Foundation
import Network
import os.log

private let kServiceType        = "_chrona._tcp"
private let kServiceName        = "Chrona Helper"
private let kHeartbeatInterval  : TimeInterval = 30
private let kRestartDelay       : TimeInterval = 3

final class BonjourServer {

    // MARK: - Callbacks (called on main queue)

    var onClientConnected:    (() -> Void)?
    var onClientDisconnected: (() -> Void)?

    // MARK: - Private state

    private var listener:       NWListener?
    private var connection:     NWConnection?
    private var heartbeatTimer: Timer?
    private let encoder         = JSONEncoder()
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

    /// Encodes `event` as JSON and writes it followed by `\n` to the active connection.
    /// Silently drops the write if no client is connected.
    func send(_ event: ChronaEvent) {
        guard let conn = connection else { return }
        do {
            var data = try encoder.encode(event)
            data.append(0x0A) // '\n'
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

        // Advertise on Bonjour so the iOS app can discover without a hard-coded IP.
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
        // Drop any existing connection — single-client model.
        if let old = connection {
            old.cancel()
            heartbeatTimer?.invalidate()
            heartbeatTimer = nil
        }

        connection = newConn
        log.info("New connection from \(newConn.endpoint.debugDescription, privacy: .public)")

        newConn.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                self.log.info("Client connected")
                self.startHeartbeat()
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
}
