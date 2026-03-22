import Foundation
import Darwin   // getifaddrs, getnameinfo

// MARK: - EventBroadcaster

/// Sits between the activity poller and the WebSocket server.
///
/// Responsibilities:
///   - Buffer incoming StoredRecords and flush them in controlled batches
///   - Send a `hello` frame to each newly-connected client
///   - Send periodic `status` heartbeats so the iOS side can detect a stale link
///   - Expose connection metadata (IP, hostname, port) for display in the menu bar
///
/// Batching policy:
///   • Hard flush when pending buffer reaches `maxBatchSize`    (threshold)
///   • Timer flush every `flushInterval` seconds               (cadence)
///   • Heartbeat every `heartbeatInterval` even with no data   (keepalive)
///   • No empty flushes — nothing is sent when the buffer is empty

@MainActor
final class EventBroadcaster: ObservableObject {

    // MARK: - Published state (drives MenuBarView)

    @Published private(set) var connectedClients = 0
    @Published private(set) var isServerRunning  = false

    // MARK: - Batching config

    private let maxBatchSize       = 20
    private let flushInterval:     TimeInterval = 5
    private let heartbeatInterval: TimeInterval = 60

    // MARK: - Dependencies

    let server = StreamServer()
    private let encoder: JSONEncoder

    // MARK: - State

    private var pending: [StoredRecord] = []
    private var flushTimer:     Timer?
    private var heartbeatTimer: Timer?
    private var eventsToday = 0
    private var isPolling   = false

    // MARK: - Init

    init() {
        encoder = JSONEncoder()
        encoder.outputFormatting = []

        server.onClientCountChanged = { [weak self] count in
            self?.connectedClients = count
        }
        // Send hello frame to every client when a new one connects.
        // Existing clients receive it too — it's idempotent state refresh.
        server.onClientConnected = { [weak self] in
            self?.sendHello()
        }
    }

    // MARK: - Lifecycle

    func start() throws {
        try server.start()
        scheduleTimers()
        isServerRunning = true
    }

    func stop() {
        server.stop()
        flushTimer?.invalidate()
        heartbeatTimer?.invalidate()
        flushTimer     = nil
        heartbeatTimer = nil
        isServerRunning = false
    }

    // MARK: - Queueing

    /// Called by ActivityPoller after each successful DataStore write.
    /// Buffers records and triggers an immediate flush at the batch threshold.
    func queue(records: [StoredRecord], eventsToday: Int, isPolling: Bool) {
        guard !records.isEmpty else { return }
        self.eventsToday = eventsToday
        self.isPolling   = isPolling
        pending.append(contentsOf: records)
        if pending.count >= maxBatchSize { flush() }
    }

    // MARK: - Private flush

    private func flush() {
        guard !pending.isEmpty else { return }
        let batch  = pending
        pending    = []
        let payload = EventsPayload(
            records:  batch,
            batchId:  UUID().uuidString,
            sentAt:   AWDateFormatter.shared.string(from: Date()),
            count:    batch.count
        )
        broadcast(StreamEnvelope(type: "events", payload: payload))
    }

    private func sendHello() {
        let payload = HelloPayload(
            version:     kProtocolVersion,
            hostname:    localHostname,
            eventsToday: eventsToday
        )
        broadcast(StreamEnvelope(type: "hello", payload: payload))
    }

    private func sendHeartbeat() {
        let payload = StatusPayload(eventsToday: eventsToday, isPolling: isPolling)
        broadcast(StreamEnvelope(type: "status", payload: payload))
    }

    private func broadcast<P: Encodable>(_ envelope: StreamEnvelope<P>) {
        guard connectedClients > 0 else { return }
        guard let data = try? encoder.encode(envelope) else { return }
        server.broadcast(data: data)
    }

    // MARK: - Timers

    private func scheduleTimers() {
        flushTimer = Timer.scheduledTimer(
            withTimeInterval: flushInterval,
            repeats: true
        ) { [weak self] _ in self?.flush() }

        heartbeatTimer = Timer.scheduledTimer(
            withTimeInterval: heartbeatInterval,
            repeats: true
        ) { [weak self] _ in self?.sendHeartbeat() }
    }

    // MARK: - Network info (for menu bar display)

    var localHostname: String { ProcessInfo.processInfo.hostName }

    var localIP: String { localWiFiIP() ?? "IP unavailable" }

    var connectionAddress: String {
        guard isServerRunning else { return "offline" }
        return "\(localIP):\(StreamServer.port)"
    }

    var hostnameAddress: String {
        guard isServerRunning else { return "offline" }
        return "\(localHostname):\(StreamServer.port)"
    }

    /// Returns the primary WiFi (en0) IPv4 address using getifaddrs.
    private func localWiFiIP() -> String? {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let head = ifaddr else { return nil }
        defer { freeifaddrs(head) }

        var ptr: UnsafeMutablePointer<ifaddrs>? = head
        while let current = ptr {
            let name = String(cString: current.pointee.ifa_name)
            let sa   = current.pointee.ifa_addr
            if name == "en0", sa?.pointee.sa_family == UInt8(AF_INET) {
                var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                getnameinfo(
                    sa,
                    socklen_t(sa!.pointee.sa_len),
                    &host, socklen_t(host.count),
                    nil, 0,
                    NI_NUMERICHOST
                )
                return String(cString: host)
            }
            ptr = current.pointee.ifa_next
        }
        return nil
    }
}
