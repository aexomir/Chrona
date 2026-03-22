import Foundation
import Combine
import os

// MARK: - ExternalActivitySource
//
// Development / debug implementation of `ActivitySource` that polls a running
// ActivityWatch REST server. Use this when you want to verify the downstream
// pipeline with real ActivityWatch data, replay historical buckets, or compare
// output against the embedded watcher.
//
// The ActivityWatch REST types (AWEvent, bucket discovery) are entirely contained
// within this file and never leak into the rest of the app.

final class ExternalActivitySource: ActivitySource {

    // MARK: - ActivitySource identity

    let bucketId = "focus-external-aw"

    // MARK: - ActivitySource state

    private(set) var status: ActivitySourceStatus = .idle

    var statusPublisher: AnyPublisher<ActivitySourceStatus, Never> {
        statusSubject.eraseToAnyPublisher()
    }

    var activityPublisher: AnyPublisher<ActivityWindow, Never> {
        activitySubject.eraseToAnyPublisher()
    }

    // MARK: - Configuration

    /// URL of the ActivityWatch REST API root (e.g. `http://localhost:5600/api/0`).
    let serverURL: URL

    /// How often to poll for new events.
    let pollInterval: TimeInterval

    // MARK: - Private

    private let statusSubject   = CurrentValueSubject<ActivitySourceStatus, Never>(.idle)
    private let activitySubject = PassthroughSubject<ActivityWindow, Never>()
    private var pollingTask: Task<Void, Never>?

    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest  = 10
        cfg.timeoutIntervalForResource = 15
        return URLSession(configuration: cfg)
    }()

    // Polling cursor — events strictly after this timestamp are fetched each cycle.
    private var cursor: Date = Calendar.current.startOfDay(for: .now)
    // Discovered bucket ID cached across poll cycles.
    private var windowBucketId: String?

    // MARK: - Init

    /// - Parameters:
    ///   - serverURL: ActivityWatch API root. Defaults to the standard local installation.
    ///   - pollInterval: Seconds between polls. Defaults to 30 s.
    init(
        serverURL: URL = URL(string: "http://localhost:5600/api/0")!,
        pollInterval: TimeInterval = 30
    ) {
        self.serverURL    = serverURL
        self.pollInterval = pollInterval
    }

    // MARK: - ActivitySource lifecycle

    func start() {
        guard case .idle = status else { return }
        setStatus(.running(titleAccess: .available))   // AW always provides titles
        pollingTask = Task { [weak self] in await self?.runLoop() }
        Logger.external.info("ExternalActivitySource started — server=\(self.serverURL.absoluteString)")
    }

    func stop() {
        pollingTask?.cancel()
        pollingTask = nil
        windowBucketId = nil
        setStatus(.stopped)
        Logger.external.info("ExternalActivitySource stopped")
    }

    /// External source has no platform permission requirements.
    var permissionManager: PermissionManager? { nil }

    /// No-op: the external AW server always provides window titles.
    func requestTitleAccess() {}

    // MARK: - Private – polling loop

    private func runLoop() async {
        while !Task.isCancelled {
            await poll()
            // Sleep in 1-second ticks so cancellation is detected promptly.
            for _ in 0 ..< Int(pollInterval) {
                if Task.isCancelled { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }

    private func poll() async {
        do {
            // Discover the window bucket on first run or after a reconnect.
            if windowBucketId == nil {
                windowBucketId = try await findWindowBucket()
                Logger.external.info("Discovered AW window bucket: \(self.windowBucketId ?? "nil")")
            }
            guard let bucketId = windowBucketId else { return }

            let rawEvents = try await fetchEvents(bucketId: bucketId, since: cursor)

            // Translate AW events into clean domain windows.
            let windows = rawEvents.compactMap { $0.toActivityWindow() }

            await MainActor.run {
                setStatus(.running(titleAccess: .available))
                if !windows.isEmpty {
                    Logger.external.debug("Poll returned \(windows.count) event(s)")
                }
                for w in windows { activitySubject.send(w) }

                // Advance cursor past the latest event we've consumed.
                if let lastTimestamp = rawEvents.last?.parsedTimestamp {
                    cursor = lastTimestamp
                }
            }

        } catch let err as AWRestError {
            await MainActor.run {
                Logger.external.error("Poll error: \(err.localizedDescription ?? "unknown")")
                if case .notRunning = err { windowBucketId = nil }
                if case .noWindowBucket = err { windowBucketId = nil }
                setStatus(.failed(err.localizedDescription ?? "ActivityWatch unreachable"))
            }
        } catch {
            await MainActor.run {
                setStatus(.failed(error.localizedDescription))
            }
        }
    }

    // MARK: - Private – state helper

    private func setStatus(_ next: ActivitySourceStatus) {
        status = next
        statusSubject.send(next)
    }

    // MARK: - Private – ActivityWatch REST client
    //
    // These types and methods are entirely private to this file. They translate
    // ActivityWatch's API contract into the clean `ActivityWindow` domain type and
    // are never visible outside this source.

    private enum AWRestError: Error, LocalizedError {
        case notRunning
        case noWindowBucket
        case badResponse(Int)
        case decodingFailed(Error)

        var errorDescription: String? {
            switch self {
            case .notRunning:             return "ActivityWatch is not running"
            case .noWindowBucket:         return "No window-watcher bucket found"
            case .badResponse(let code):  return "HTTP \(code)"
            case .decodingFailed(let e):  return "Decode error: \(e.localizedDescription)"
            }
        }
    }

    /// Raw event shape returned by the ActivityWatch REST API.
    private struct AWEvent: Decodable {
        let id: Int
        let timestamp: String     // ISO8601 with fractional seconds
        let duration: Double      // seconds
        let data: Data

        struct Data: Decodable {
            let app: String
            let title: String?
        }

        var parsedTimestamp: Date? {
            AWDateFormatter.shared.date(from: timestamp)
        }

        /// Translates the raw AW event into the clean domain type.
        func toActivityWindow() -> ActivityWindow? {
            guard let date = parsedTimestamp else { return nil }
            return ActivityWindow(
                id:        UUID(),
                app:       data.app,
                title:     data.title,
                startedAt: date,
                duration:  duration
            )
        }
    }

    private func findWindowBucket() async throws -> String {
        let url  = serverURL.appendingPathComponent("buckets")
        let data = try await fetch(url)

        guard let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw AWRestError.noWindowBucket
        }
        for (id, value) in dict {
            if let obj    = value as? [String: Any],
               let client = obj["client"] as? String,
               client.hasPrefix("aw-watcher-window") {
                return id
            }
        }
        throw AWRestError.noWindowBucket
    }

    private func fetchEvents(bucketId: String, since: Date) async throws -> [AWEvent] {
        var components = URLComponents(
            url: serverURL.appendingPathComponent("buckets/\(bucketId)/events"),
            resolvingAgainstBaseURL: false
        )!
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        components.queryItems = [
            URLQueryItem(name: "start", value: formatter.string(from: since)),
            URLQueryItem(name: "limit",  value: "2000"),
        ]
        guard let url = components.url else { return [] }

        let data = try await fetch(url)
        do {
            // AW returns newest-first; reverse to chronological order.
            return try JSONDecoder().decode([AWEvent].self, from: data).reversed()
        } catch {
            throw AWRestError.decodingFailed(error)
        }
    }

    private func fetch(_ url: URL) async throws -> Data {
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else { throw AWRestError.notRunning }
        guard http.statusCode == 200 else { throw AWRestError.badResponse(http.statusCode) }
        return data
    }
}
