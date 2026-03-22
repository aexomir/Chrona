import Foundation

enum AWError: Error, LocalizedError {
    case notRunning
    case noWindowBucket
    case badResponse(Int)
    case decodingFailed(Error)

    var errorDescription: String? {
        switch self {
        case .notRunning:       return "ActivityWatch is not running (localhost:5600)"
        case .noWindowBucket:   return "No window-watcher bucket found"
        case .badResponse(let c): return "Unexpected HTTP \(c)"
        case .decodingFailed(let e): return "Decode error: \(e.localizedDescription)"
        }
    }
}

final class ActivityWatchClient {
    private let base = URL(string: "http://localhost:5600/api/0")!
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 15
        session = URLSession(configuration: config)
    }

    // MARK: - Bucket discovery

    /// Returns the bucket ID for the window watcher, or nil if not found.
    func findWindowBucket() async throws -> String {
        let url = base.appendingPathComponent("buckets")
        let data = try await fetch(url)

        // Response is { "bucket-id": { ...bucket object }, ... }
        guard let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw AWError.noWindowBucket
        }

        // The window watcher client is "aw-watcher-window"
        for (id, value) in dict {
            if let obj = value as? [String: Any],
               let client = obj["client"] as? String,
               client.hasPrefix("aw-watcher-window") {
                return id
            }
        }
        throw AWError.noWindowBucket
    }

    // MARK: - Event fetching

    /// Fetch events from a bucket starting at `since` (exclusive).
    /// Returns events sorted by timestamp ascending.
    func fetchEvents(bucketId: String, since: Date) async throws -> [AWEvent] {
        var components = URLComponents(
            url: base.appendingPathComponent("buckets/\(bucketId)/events"),
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
            let events = try JSONDecoder().decode([AWEvent].self, from: data)
            // AW returns newest-first; reverse to get ascending order
            return events.reversed()
        } catch {
            throw AWError.decodingFailed(error)
        }
    }

    // MARK: - Private

    private func fetch(_ url: URL) async throws -> Data {
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else { throw AWError.notRunning }
        guard http.statusCode == 200 else { throw AWError.badResponse(http.statusCode) }
        return data
    }
}
