import Foundation
import Darwin   // getifaddrs, getnameinfo

// MARK: - Broadcast record wrapper (title redaction for privacy)

/// Wraps StoredRecord for broadcasting, with optional title redaction.
private struct BroadcastRecord: Encodable {
    let record: StoredRecord
    let redactTitle: Bool

    enum CodingKeys: String, CodingKey {
        case v, id, ts, app, dur, title, bucket, wt
        case srcId = "src_id"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(record.v, forKey: .v)
        try container.encode(record.id, forKey: .id)
        try container.encode(record.ts, forKey: .ts)
        try container.encode(record.app, forKey: .app)
        try container.encode(record.dur, forKey: .dur)
        try container.encodeIfPresent(redactTitle ? nil : record.title, forKey: .title)
        try container.encode(record.bucket, forKey: .bucket)
        try container.encode(record.srcId, forKey: .srcId)
        try container.encode(record.wt, forKey: .wt)
    }
}

/// Broadcast-specific events payload with privacy redaction applied.
private struct EventsPayloadForBroadcast: Encodable {
    let records: [BroadcastRecord]
    let batchId: String
    let sentAt: String
    let count: Int
}

@MainActor
final class EventBroadcaster: ObservableObject {
    @Published private(set) var connectedClients = 0
    @Published private(set) var isServerRunning  = false

    var onNewClientConnected: (() -> Void)?

    private let maxBatchSize       = 20
    private let flushInterval:     TimeInterval = 5
    private let heartbeatInterval: TimeInterval = 60

    private let privacySensitiveApps = Set([
        "Terminal",
        "iTerm2",
        "iTerm",
        "1Password 7 - Password Manager",
        "1Password",
        "Keychain Access",
        "System Preferences",
        "System Settings",
    ])

    let server = StreamServer()
    private let encoder: JSONEncoder

    private var pending: [StoredRecord] = []
    private var flushTimer:     Timer?
    private var heartbeatTimer: Timer?
    private var eventsToday = 0
    private var isPolling   = false

    init() {
        encoder = JSONEncoder()
        encoder.outputFormatting = []

        server.onClientCountChanged = { [weak self] count in
            self?.connectedClients = count
        }
        server.onClientConnected = { [weak self] (clientId: UUID) in
            self?.sendHelloToClient(clientId)
            self?.onNewClientConnected?()
        }
    }

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

    func broadcastMeeting(_ state: MeetingState) {
        let payload = MeetingPayload(
            isInMeeting:    state.isInMeeting,
            appId:          state.appId,
            appDisplayName: state.appDisplayName
        )
        broadcast(StreamEnvelope(type: "meeting", payload: payload))
    }

    func queue(records: [StoredRecord], eventsToday: Int, isPolling: Bool) {
        guard !records.isEmpty else { return }
        self.eventsToday = eventsToday
        self.isPolling   = isPolling
        pending.append(contentsOf: records)
        if pending.count >= maxBatchSize { flush() }
    }

    private func flush() {
        guard !pending.isEmpty else { return }
        let batch  = pending
        pending    = []

        let broadcastRecords = batch.map { record -> BroadcastRecord in
            let shouldRedact = privacySensitiveApps.contains(
                where: { record.app.lowercased().contains($0.lowercased()) }
            )
            return BroadcastRecord(record: record, redactTitle: shouldRedact)
        }

        let payload = EventsPayloadForBroadcast(
            records:  broadcastRecords,
            batchId:  UUID().uuidString,
            sentAt:   ISO8601Formatter.shared.string(from: Date()),
            count:    batch.count
        )
        broadcast(StreamEnvelope(type: "events", payload: payload))
    }

    private func sendHelloToClient(_ clientId: UUID) {
        let payload = HelloPayload(
            version:     kProtocolVersion,
            hostname:    localHostname,
            eventsToday: eventsToday
        )
        guard let data = try? encoder.encode(StreamEnvelope(type: "hello", payload: payload)) else { return }
        server.send(data: data, toClient: clientId)
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
