import Foundation
import Combine

/// Drives the polling loop and owns the ActivityWatch client + data store.
/// Runs on MainActor so @Published properties update the SwiftUI view automatically.
@MainActor
final class ActivityPoller: ObservableObject {

    // MARK: - Published state (drives MenuBarView)

    @Published var isConnected = false
    @Published var isPolling = false
    @Published var lastPollTime: Date?
    @Published var statusMessage = "Idle"
    @Published var eventsLoggedToday = 0
    @Published var totalEvents = 0
    @Published var corruptedLines = 0

    // MARK: - Private

    private let client = ActivityWatchClient()
    private var store: DataStore?
    private var pollingTask: Task<Void, Never>?
    private var windowBucketId: String?
    private var lastEventTime: Date = Calendar.current.startOfDay(for: Date())

    static let pollInterval: TimeInterval = 30

    // MARK: - Init

    init() {
        do {
            let s = try DataStore()
            store = s

            // Resume from the last persisted cursor
            if let cursor = s.loadCursor() {
                lastEventTime  = cursor.lastEventTimestamp
                windowBucketId = cursor.windowBucketId
            } else {
                // First run: start from beginning of today
                lastEventTime = Calendar.current.startOfDay(for: Date())
            }

            syncStats(from: s)
        } catch {
            statusMessage = "Storage error: \(error.localizedDescription)"
        }

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
            // Sleep in 1s ticks so cancellation responds promptly
            for _ in 0..<Int(Self.pollInterval) {
                if Task.isCancelled { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }

    private func poll() async {
        guard let store else { return }

        do {
            // Discover the window-watcher bucket once per session
            if windowBucketId == nil {
                windowBucketId = try await client.findWindowBucket()
                // Persist bucket id in cursor immediately
                var cursor = store.loadCursor() ?? Cursor(lastEventTimestamp: lastEventTime)
                cursor.windowBucketId = windowBucketId
                store.saveCursor(cursor)
            }

            guard let bucketId = windowBucketId else { return }

            // Fetch events strictly after the last known timestamp.
            // The 1 ms offset avoids re-fetching the exact last seen event.
            let fetchFrom   = lastEventTime.addingTimeInterval(0.001)
            let rawEvents   = try await client.fetchEvents(bucketId: bucketId, since: fetchFrom)

            isConnected  = true
            lastPollTime = Date()

            // Normalize → deduplicate → write in one batch
            let normalized = rawEvents.compactMap { $0.normalize(bucket: bucketId) }
            let newCount   = try store.write(batch: normalized)

            // Advance cursor to the latest event's timestamp
            if let latest = rawEvents.last, let ts = latest.parsedTimestamp, ts > lastEventTime {
                lastEventTime = ts
                store.saveCursor(Cursor(lastEventTimestamp: ts, windowBucketId: bucketId))
            }

            syncStats(from: store)

            statusMessage = newCount > 0
                ? "Logged \(newCount) event\(newCount == 1 ? "" : "s")"
                : "No new activity"

        } catch let err as AWError {
            isConnected = false
            // Reset bucket so we rediscover on the next poll after a reconnect
            if case .notRunning      = err { windowBucketId = nil }
            if case .noWindowBucket  = err { windowBucketId = nil }
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
