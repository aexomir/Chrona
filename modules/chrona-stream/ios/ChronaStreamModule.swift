import ExpoModulesCore
import Network
import Foundation

// MARK: - Wire type

/// Mirrors the ChronaEvent struct defined in the macOS helper's EventProtocol.swift.
/// Only used for decoding — never sent back to the helper.
private struct ChronaWireEvent: Decodable {
    let version: Int
    let type: String        // "app_change" | "heartbeat" | "hello"
    let appName: String
    let windowTitle: String
    let bundleId: String
    let timestamp: Double
}

// MARK: - Module

public class ChronaStreamModule: Module {

    private let serviceType = "_chrona._tcp"

    private var browser: NWBrowser?
    private var connection: NWConnection?
    private var buffer = Data()
    private var reconnectItem: DispatchWorkItem?
    private var watchdogItem: DispatchWorkItem?
    private var isStarted = false

    private let watchdogInterval: TimeInterval = 90

    // MARK: - Definition

    public func definition() -> ModuleDefinition {
        Name("ChronaStream")

        Events("onStatusChanged", "onEvent")

        /// Start Bonjour discovery and connect to the first helper found.
        /// Idempotent — calling while already started is a no-op.
        Function("start") { [weak self] in
            self?.startStream()
        }

        /// Tear everything down and emit status "idle".
        Function("stop") { [weak self] in
            self?.stopStream()
        }

        OnDestroy {
            self.stopStream()
        }
    }

    // MARK: - Lifecycle

    private func startStream() {
        guard !isStarted else { return }
        isStarted = true
        browse()
    }

    private func stopStream() {
        isStarted = false
        reconnectItem?.cancel()
        reconnectItem = nil
        browser?.cancel()
        browser = nil
        dropConnection()
        emitStatus("idle")
    }

    // MARK: - Bonjour browsing

    private func browse() {
        guard isStarted else { return }

        browser?.cancel()
        browser = NWBrowser(for: .bonjour(type: serviceType, domain: nil), using: .tcp)

        browser?.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                self?.emitStatus("scanning")
            case .failed:
                self?.scheduleReconnect()
            default:
                break
            }
        }

        browser?.browseResultsChangedHandler = { [weak self] results, _ in
            // Only connect when we have no active connection and a result is available.
            guard let self, self.connection == nil, let result = results.first else { return }
            // Cancel the browser — we found our target; reconnect will re-browse if needed.
            self.browser?.cancel()
            self.browser = nil
            self.connect(to: result.endpoint)
        }

        browser?.start(queue: .main)
    }

    // MARK: - TCP connection

    private func connect(to endpoint: NWEndpoint) {
        emitStatus("connecting")

        let params = NWParameters.tcp
        params.includePeerToPeer = true

        let conn = NWConnection(to: endpoint, using: params)
        connection = conn

        conn.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                self.emitStatus("connected")
                self.resetWatchdog()
                self.receive()
            case .failed, .cancelled:
                self.handleDisconnect()
            default:
                break
            }
        }

        conn.start(queue: .main)
    }

    private func dropConnection() {
        connection?.cancel()
        connection = nil
        buffer = Data()
        watchdogItem?.cancel()
        watchdogItem = nil
    }

    private func resetWatchdog() {
        watchdogItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.connection != nil else { return }
            self.handleDisconnect()
        }
        watchdogItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + watchdogInterval, execute: item)
    }

    private func handleDisconnect() {
        guard connection != nil else { return }
        dropConnection()
        emitStatus("disconnected")
        scheduleReconnect()
    }

    // MARK: - Receive loop

    private func receive() {
        guard let conn = connection else { return }

        conn.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, isComplete, error in
            guard let self else { return }

            if let data, !data.isEmpty {
                self.resetWatchdog()
                self.buffer.append(data)
                self.flush()
            }

            if error != nil || isComplete {
                self.handleDisconnect()
                return
            }

            self.receive()
        }
    }

    // MARK: - Newline-delimited JSON parsing

    /// Split the receive buffer on `\n` and decode each complete line.
    private func flush() {
        while let idx = buffer.firstIndex(of: 0x0A) {
            let line = Data(buffer[buffer.startIndex..<idx])
            buffer.removeSubrange(buffer.startIndex...idx)
            if !line.isEmpty {
                parse(line)
            }
        }
    }

    private func parse(_ data: Data) {
        guard let event = try? JSONDecoder().decode(ChronaWireEvent.self, from: data),
              event.version <= 1 else { return }

        sendEvent("onEvent", [
            "version": event.version,
            "type": event.type,
            "appName": event.appName,
            "windowTitle": event.windowTitle,
            "bundleId": event.bundleId,
            "timestamp": event.timestamp,
        ])
    }

    // MARK: - Reconnection

    /// Re-browses after a 3-second delay. Cancels any pending reconnect first.
    private func scheduleReconnect() {
        guard isStarted else { return }

        reconnectItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.isStarted else { return }
            self.browse()
        }
        reconnectItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0, execute: item)
    }

    // MARK: - Helpers

    private func emitStatus(_ status: String) {
        sendEvent("onStatusChanged", ["status": status])
    }
}
