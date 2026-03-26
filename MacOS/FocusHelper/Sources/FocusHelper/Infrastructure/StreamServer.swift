import Foundation
import Network

private final class StreamClient {
    let id = UUID()
    let connection: NWConnection
    init(_ connection: NWConnection) { self.connection = connection }
}

/// Low-level WebSocket server built on Network.framework.
@MainActor
final class StreamServer {
    static let port: NWEndpoint.Port = 7_777
    static let bonjourServiceType    = "_chronahelper._tcp"
    static let bonjourServiceName    = "ChronaHelper"

    var onClientConnected:    ((UUID) -> Void)?
    var onClientCountChanged: ((Int) -> Void)?
    var onMessage: ((UUID, Data) -> Void)?

    private(set) var isListening = false
    private var listener: NWListener?
    private var clients: [UUID: StreamClient] = [:]
    private var pendingClients: [UUID: StreamClient] = [:]

    private let listenerQueue = DispatchQueue(
        label: "com.chrona.streamserver",
        qos: .utility
    )

    func start() throws {
        let params  = NWParameters.tcp
        let wsOpts  = NWProtocolWebSocket.Options()
        wsOpts.autoReplyPing = true
        params.defaultProtocolStack.applicationProtocols.insert(wsOpts, at: 0)

        let l = try NWListener(using: params, on: Self.port)
        l.service = NWListener.Service(
            name: Self.bonjourServiceName,
            type: Self.bonjourServiceType
        )
        l.stateUpdateHandler = { [weak self] state in
            DispatchQueue.main.async { self?.handleListenerState(state) }
        }
        l.newConnectionHandler = { [weak self] conn in
            DispatchQueue.main.async { self?.acceptClient(conn) }
        }
        l.start(queue: listenerQueue)
        listener = l
    }

    func stop() {
        listener?.cancel()
        listener = nil
        for c in clients.values { c.connection.cancel() }
        clients.removeAll()
        isListening = false
        onClientCountChanged?(0)
    }

    func broadcast(data: Data) {
        guard !clients.isEmpty else { return }
        for client in clients.values { send(data: data, to: client) }
    }

    func send(data: Data, toClient id: UUID) {
        guard let client = clients[id] else { return }
        send(data: data, to: client)
    }

    var connectedClientIds: [UUID] { Array(clients.keys) }

    private func handleListenerState(_ state: NWListener.State) {
        switch state {
        case .ready:
            isListening = true
        case .failed(let err):
            isListening = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                self?.listener = nil
                try? self?.start()
            }
            print("[StreamServer] Listener failed: \(err) — restarting in 3s")
        case .cancelled:
            isListening = false
        default:
            break
        }
    }

    private func acceptClient(_ raw: NWConnection) {
        let client = StreamClient(raw)
        pendingClients[client.id] = client

        raw.stateUpdateHandler = { [weak self, id = client.id] state in
            DispatchQueue.main.async {
                guard let self else { return }
                switch state {
                case .ready:
                    guard let client = self.pendingClients.removeValue(forKey: id) else { return }
                    self.clients[id] = client
                    self.onClientCountChanged?(self.clients.count)
                    self.onClientConnected?(id)
                    self.receiveNext(from: client)
                case .failed, .cancelled:
                    self.pendingClients.removeValue(forKey: id)
                    self.removeClient(id: id)
                default:
                    break
                }
            }
        }
        raw.start(queue: listenerQueue)
    }

    private func removeClient(id: UUID) {
        guard clients[id] != nil else { return }
        clients.removeValue(forKey: id)
        onClientCountChanged?(clients.count)
    }

    private func receiveNext(from client: StreamClient) {
        client.connection.receive(
            minimumIncompleteLength: 1,
            maximumLength: 65_536
        ) { [weak self, id = client.id] content, _, _, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if error != nil {
                    self.removeClient(id: id)
                    return
                }
                if let content, !content.isEmpty {
                    self.onMessage?(id, content)
                }
                if let c = self.clients[id] { self.receiveNext(from: c) }
            }
        }
    }

    private func send(data: Data, to client: StreamClient) {
        let meta    = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "stream", metadata: [meta])
        client.connection.send(
            content: data,
            contentContext: context,
            isComplete: true,
            completion: .contentProcessed { _ in }
        )
    }
}
