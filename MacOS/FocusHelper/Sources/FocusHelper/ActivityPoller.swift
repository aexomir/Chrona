import Foundation
import Combine

/// Drives the polling loop, owns the data store, and owns the event broadcaster.
/// Runs on MainActor so @Published properties update the SwiftUI view automatically.
@MainActor
final class ActivityPoller: ObservableObject {

    // MARK: - Published state (drives MenuBarView)

    @Published var isConnected = false
    @Published var isPolling   = false
    @Published var lastPollTime: Date?
    @Published var statusMessage = "Idle"
    @Published var eventsLoggedToday = 0
    @Published var totalEvents = 0
    @Published var corruptedLines = 0
    @Published var connectedClients = 0   // forwarded from broadcaster

    // MARK: - Sub-systems

    let broadcaster = EventBroadcaster()   // owns the WebSocket server

    // MARK: - Private

    private let client = ActivityWatchClient()
    private var store: DataStore?
    private var pollingTask: Task<Void, Never>?
    private var windowBucketId: String?
    private var lastEventTime: Date = Calendar.current.startOfDay(for: Date())
    private var cancellables = Set<AnyCancellable>()

    static let pollInterval: TimeInterval = 30

    // MARK: - Init

    init() {
        // Forward broadcaster's client count into our own @Published
        broadcaster.$connectedClients
            .assign(to: \.connectedClients, on: self)
            .store(in: &cancellables)

        do {
            let s = try DataStore()
            store = s
            if let cursor = s.loadCursor() {
                lastEventTime  = cursor.lastEventTimestamp
                windowBucketId = cursor.windowBucketId
            } else {
                lastEventTime = Calendar.current.startOfDay(for: Date())
            }
            syncStats(from: s)
        } catch {
            statusMessage = "Storage error: \(error.localizedDescription)"
        }

        // Start the WebSocket server
        try? broadcaster.start()

        // Auto-start polling
        start()
    }

    // MARK: - Control

    func start() {
        guard !isPolling, store != nil else { return }
        isPolling = true
        statusMessage = "Starting…"
        pollingTask = Task { [weak self] in await self?.runLoop() }
    }

    func stop() {
        pollingTask?.cancel()
        pollingTask = nil
        isPolling   = false
        isConnected = false
        statusMessage = "Stopped"
    }

    // MARK: - Polling loop

    private func runLoop() async {
        while !Task.isCancelled {
            await poll()
            for _ in 0..<Int(Self.pollInterval) {
                if Task.isCancelled { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }

    private func poll() async {
        guard let store else { return }

        do {
            if windowBucketId == nil {
                windowBucketId = try await client.findWindowBucket()
                var cursor = store.loadCursor() ?? Cursor(lastEventTimestamp: lastEventTime)
                cursor.windowBucketId = windowBucketId
                store.saveCursor(cursor)
            }

            guard let bucketId = windowBucketId else { return }

            let fetchFrom  = lastEventTime.addingTimeInterval(0.001)
            let rawEvents  = try await client.fetchEvents(bucketId: bucketId, since: fetchFrom)

            isConnected  = true
            lastPollTime = Date()

            // normalize → write (dedup happens inside DataStore)
            let normalized = rawEvents.compactMap { $0.normalize(bucket: bucketId) }
            let written    = try store.write(batch: normalized)   // returns [StoredRecord]

            // Advance cursor
            if let latest = rawEvents.last, let ts = latest.parsedTimestamp, ts > lastEventTime {
                lastEventTime = ts
                store.saveCursor(Cursor(lastEventTimestamp: ts, windowBucketId: bucketId))
            }

            syncStats(from: store)

            // Stream new records to connected iOS clients (non-blocking — broadcaster buffers)
            if !written.isEmpty {
                broadcaster.queue(
                    records:     written,
                    eventsToday: store.todayCount,
                    isPolling:   isPolling
                )
            }

            statusMessage = written.isEmpty
                ? "No new activity"
                : "Logged \(written.count) event\(written.count == 1 ? "" : "s")"

        } catch let err as AWError {
            isConnected = false
            if case .notRunning     = err { windowBucketId = nil }
            if case .noWindowBucket = err { windowBucketId = nil }
            statusMessage = err.localizedDescription ?? "Unknown error"
        } catch {
            isConnected   = false
            statusMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func syncStats(from store: DataStore) {
        eventsLoggedToday = store.todayCount
        totalEvents       = store.totalCount
        corruptedLines    = store.corruptedCount
    }
}
