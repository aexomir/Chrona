import Foundation
import Network

// MARK: - Connected client handle

private final class StreamClient {
    let id = UUID()
    let connection: NWConnection
    init(_ connection: NWConnection) { self.connection = connection }
}

// MARK: - StreamServer

/// Low-level WebSocket server built on Network.framework.
///
/// Responsibilities:
///   - Listen for incoming connections on a fixed port
///   - Advertise via Bonjour so iOS can discover without manual IP entry
///   - Accept and track connected clients (added only when .ready)
///   - Broadcast raw Data frames to all connected clients
///   - Auto-restart on listener failure (network interface changes, etc.)
///   - Pump each connection's receive loop to detect client-side closes
@MainActor
final class StreamServer {

    // MARK: - Configuration

    static let port: NWEndpoint.Port = 7_777
    static let bonjourServiceType    = "_focushelper._tcp"
    static let bonjourServiceName    = "FocusHelper"

    // MARK: - Callbacks

    /// Called on the main actor whenever the connected-client count changes.
    var onClientConnected:    (() -> Void)?
    var onClientCountChanged: ((Int) -> Void)?

    // MARK: - State

    private(set) var isListening = false
    private var listener: NWListener?
    private var clients: [UUID: StreamClient] = [:]
    /// Holds a strong reference to clients between acceptClient() and .ready.
    /// Without this, the StreamClient is deallocated before the state fires.
    private var pendingClients: [UUID: StreamClient] = [:]

    private let listenerQueue = DispatchQueue(
        label: "com.focus.streamserver",
        qos: .utility
    )

    // MARK: - Lifecycle

    func start() throws {
        // Build WebSocket-over-TCP parameters
        let params  = NWParameters.tcp
        let wsOpts  = NWProtocolWebSocket.Options()
        wsOpts.autoReplyPing = true   // the server handles pings; iOS client needn't
        params.defaultProtocolStack.applicationProtocols.insert(wsOpts, at: 0)

        let l = try NWListener(using: params, on: Self.port)

        // Bonjour registration — resolves to this machine's .local hostname
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

    // MARK: - Broadcasting

    /// Send encoded JSON to every currently-connected client.
    /// Silently drops the send if no clients are present.
    func broadcast(data: Data) {
        guard !clients.isEmpty else { return }
        for client in clients.values { send(data: data, to: client) }
    }

    /// Send to one specific client by UUID (used for targeted hello messages).
    func send(data: Data, toClient id: UUID) {
        guard let client = clients[id] else { return }
        send(data: data, to: client)
    }

    var connectedClientIds: [UUID] { Array(clients.keys) }

    // MARK: - Listener state

    private func handleListenerState(_ state: NWListener.State) {
        switch state {
        case .ready:
            isListening = true
        case .failed(let err):
            isListening = false
            // Restart after a short pause — covers wifi hand-off, sleep/wake, etc.
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

    // MARK: - Connection management

    private func acceptClient(_ raw: NWConnection) {
        let client = StreamClient(raw)
        // Keep a strong reference in pendingClients until .ready fires.
        // The local `client` var goes out of scope when this function returns;
        // if we captured it [weak] in the closure it would be deallocated
        // before the state handler ever fires — causing a silent no-op.
        pendingClients[client.id] = client

        raw.stateUpdateHandler = { [weak self, id = client.id] state in
            DispatchQueue.main.async {
                guard let self else { return }
                switch state {
                case .ready:
                    // Promote from pending → active broadcast pool
                    guard let client = self.pendingClients.removeValue(forKey: id) else { return }
                    self.clients[id] = client
                    self.onClientCountChanged?(self.clients.count)
                    self.onClientConnected?()
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

    // MARK: - Receive pump
    //
    // We're server-push only — we don't act on incoming messages.
    // But we MUST keep receiving to get notified when the client
    // closes the connection (otherwise stale entries accumulate).

    private func receiveNext(from client: StreamClient) {
        client.connection.receive(
            minimumIncompleteLength: 1,
            maximumLength: 65_536
        ) { [weak self, id = client.id] _, _, _, error in
            // Always hop back to the main actor — clients dict is main-actor-isolated
            DispatchQueue.main.async {
                guard let self else { return }
                if error != nil {
                    self.removeClient(id: id)
                    return
                }
                // Loop: keep receiving until an error fires
                if let c = self.clients[id] { self.receiveNext(from: c) }
            }
        }
    }

    // MARK: - Send

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
