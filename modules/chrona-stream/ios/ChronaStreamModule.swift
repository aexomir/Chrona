import ExpoModulesCore
import Network
import Foundation

private struct ChronaWireEvent: Decodable {
    let version: Int
    let type: String
    let appName: String
    let windowTitle: String
    let bundleId: String
    let timestamp: Double
}

public class ChronaStreamModule: Module {

    private let serviceType = "_chrona._tcp"
    private let kCachedHostKey = "chrona.lastHost"
    private let kCachedPortKey = "chrona.lastPort"

    private var browser: NWBrowser?
    private var connection: NWConnection?
    private var buffer = Data()
    private var reconnectItem: DispatchWorkItem?
    private var watchdogItem: DispatchWorkItem?
    private var directAttemptTimeoutItem: DispatchWorkItem?
    private var pingItem: DispatchWorkItem?
    private var pongTimeoutItem: DispatchWorkItem?
    private var pathMonitor: NWPathMonitor?
    private var isStarted = false
    private var currentPathSatisfied = false
    private var reconnectAttempt = 0

    private let watchdogInterval: TimeInterval = 45
    private let pingInterval: TimeInterval = 15
    private let pongTimeout: TimeInterval = 5
    private let reconnectDelays: [TimeInterval] = [1, 2, 4, 8, 16, 30]

    public func definition() -> ModuleDefinition {
        Name("ChronaStream")

        Events("onStatusChanged", "onEvent")

        Function("start") { [weak self] in
            self?.startStream()
        }

        Function("stop") { [weak self] in
            self?.stopStream()
        }

        Function("clearCachedEndpoint") { [weak self] in
            self?.clearCachedEndpoint()
        }

        OnDestroy {
            self.stopStream()
        }
    }

    // MARK: - Lifecycle

    private func startStream() {
        guard !isStarted else { return }
        isStarted = true
        reconnectAttempt = 0
        startPathMonitor()
        browse()
    }

    private func stopStream() {
        isStarted = false
        reconnectItem?.cancel()
        reconnectItem = nil
        directAttemptTimeoutItem?.cancel()
        directAttemptTimeoutItem = nil
        pathMonitor?.cancel()
        pathMonitor = nil
        browser?.cancel()
        browser = nil
        dropConnection()
        emitStatus("idle")
    }

    // MARK: - Path monitor

    private func startPathMonitor() {
        let monitor = NWPathMonitor()
        pathMonitor = monitor
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                guard let self, self.isStarted else { return }
                let satisfied = path.status == .satisfied
                let prev = self.currentPathSatisfied
                self.currentPathSatisfied = satisfied

                if !satisfied && prev {
                    self.handleDisconnect()
                } else if satisfied && !prev {
                    self.reconnectItem?.cancel()
                    self.reconnectItem = nil
                    self.reconnectAttempt = 0
                    self.attemptReconnect()
                }
            }
        }
        monitor.start(queue: DispatchQueue.global(qos: .utility))
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
            guard let self, self.connection == nil, let result = results.first else { return }
            self.connect(to: result.endpoint)
        }

        browser?.start(queue: .main)
    }

    // MARK: - TCP connection

    private func connect(to endpoint: NWEndpoint, directAttempt: Bool = false) {
        emitStatus("connecting")

        let params = NWParameters.tcp
        params.includePeerToPeer = true

        let conn = NWConnection(to: endpoint, using: params)
        connection = conn

        if directAttempt {
            let timeout = DispatchWorkItem { [weak self] in
                guard let self, self.connection === conn else { return }
                self.dropConnection()
                self.browse()
            }
            directAttemptTimeoutItem = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0, execute: timeout)
        }

        conn.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                self.directAttemptTimeoutItem?.cancel()
                self.directAttemptTimeoutItem = nil
                self.reconnectAttempt = 0
                self.cacheEndpoint(conn.endpoint)
                self.emitStatus("connected")
                self.resetWatchdog()
                self.startPingCycle()
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
        directAttemptTimeoutItem?.cancel()
        directAttemptTimeoutItem = nil
        pingItem?.cancel()
        pingItem = nil
        pongTimeoutItem?.cancel()
        pongTimeoutItem = nil
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

    // MARK: - Ping / pong liveness

    private func startPingCycle() {
        schedulePing()
    }

    private func schedulePing() {
        pingItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.connection != nil else { return }
            self.sendPing()
        }
        pingItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + pingInterval, execute: item)
    }

    private func sendPing() {
        guard let conn = connection else { return }
        let ts = Date().timeIntervalSince1970
        let pingJSON = "{\"version\":1,\"type\":\"ping\",\"appName\":\"\",\"windowTitle\":\"\",\"bundleId\":\"\",\"timestamp\":\(ts)}"
        guard let data = (pingJSON + "\n").data(using: .utf8) else { return }
        conn.send(content: data, completion: .contentProcessed { _ in })

        pongTimeoutItem?.cancel()
        let timeout = DispatchWorkItem { [weak self] in
            guard let self, self.connection != nil else { return }
            self.handleDisconnect()
        }
        pongTimeoutItem = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + pongTimeout, execute: timeout)

        schedulePing()
    }

    private func cancelPongTimeout() {
        pongTimeoutItem?.cancel()
        pongTimeoutItem = nil
    }

    // MARK: - Receive loop

    private func receive() {
        guard let conn = connection else { return }

        conn.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, isComplete, error in
            guard let self else { return }

            if let data, !data.isEmpty {
                self.resetWatchdog()
                self.cancelPongTimeout()
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

    private func scheduleReconnect() {
        guard isStarted else { return }
        guard currentPathSatisfied else { return }

        reconnectItem?.cancel()
        let delay = reconnectDelays[min(reconnectAttempt, reconnectDelays.count - 1)]
        reconnectAttempt += 1
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.isStarted else { return }
            self.attemptReconnect()
        }
        reconnectItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: item)
    }

    private func attemptReconnect() {
        guard isStarted else { return }

        if let cached = cachedEndpoint() {
            connect(to: cached, directAttempt: true)
        } else {
            browse()
        }
    }

    // MARK: - Endpoint cache

    private func cacheEndpoint(_ endpoint: NWEndpoint) {
        if case .hostPort(let host, let port) = endpoint {
            UserDefaults.standard.set("\(host)", forKey: kCachedHostKey)
            UserDefaults.standard.set(Int(port.rawValue), forKey: kCachedPortKey)
        }
    }

    private func cachedEndpoint() -> NWEndpoint? {
        guard let host = UserDefaults.standard.string(forKey: kCachedHostKey),
              let portInt = UserDefaults.standard.object(forKey: kCachedPortKey) as? Int,
              portInt >= 0, portInt <= 65535,
              let port = NWEndpoint.Port(rawValue: UInt16(portInt)) else { return nil }
        return .hostPort(host: NWEndpoint.Host(host), port: port)
    }

    private func clearCachedEndpoint() {
        UserDefaults.standard.removeObject(forKey: kCachedHostKey)
        UserDefaults.standard.removeObject(forKey: kCachedPortKey)
    }

    // MARK: - Helpers

    private func emitStatus(_ status: String) {
        sendEvent("onStatusChanged", [
            "status": status,
            "pathSatisfied": currentPathSatisfied,
        ])
    }
}
