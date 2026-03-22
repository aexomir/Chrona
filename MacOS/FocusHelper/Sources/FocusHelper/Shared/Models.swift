import Foundation

// MARK: - Internal event (produced by NativeWindowWatcher, consumed by DataStore)

struct NormalizedEvent {
    let id: String          // client-generated UUID — stable across retries
    let timestamp: String   // ISO8601 UTC — when the activity occurred
    let app: String
    let duration: Double    // seconds
    let title: String?
    let bucket: String
    let sourceEventId: Int  // monotonic counter from NativeWindowWatcher (dedup key within bucket)
}

// MARK: - On-disk record  (one per line in events/YYYY-MM-DD.jsonl)
//
// Compact field names keep each line well under 512 bytes, which is the
// POSIX PIPE_BUF threshold — the guarantee boundary for O_APPEND atomicity.
//
// Field map:
//   v       schema version (migration safety)
//   id      our stable UUID
//   ts      activity start, ISO8601 UTC
//   app     application name
//   dur     duration in seconds
//   title   window title (optional)
//   bucket  watcher bucket id (e.g. "focus-native-watcher")
//   src_id  monotonic event counter (dedup key within bucket)
//   wt      written-at, ISO8601 UTC (sync ordering key)

struct StoredRecord: Codable {
    static let currentVersion = 1

    let v: Int
    let id: String
    let ts: String
    let app: String
    let dur: Double
    let title: String?
    let bucket: String
    let srcId: Int
    let wt: String

    enum CodingKeys: String, CodingKey {
        case v, id, ts, app, dur, title, bucket, wt
        case srcId = "src_id"
    }

    init(from event: NormalizedEvent) {
        v      = Self.currentVersion
        id     = event.id
        ts     = event.timestamp
        app    = event.app
        dur    = event.duration
        title  = event.title
        bucket = event.bucket
        srcId  = event.sourceEventId
        wt     = ISO8601Formatter.shared.string(from: Date())
    }
}

// MARK: - Dedup index  (persisted to index/seen.json)

struct SeenIndex: Codable {
    /// Maps "bucket:srcId" → written-at epoch (milliseconds).
    /// Compact representation: ~50 bytes per entry.
    var entries: [String: Int64] = [:]

    mutating func mark(bucket: String, srcId: Int) {
        entries[key(bucket, srcId)] = Int64(Date().timeIntervalSince1970 * 1000)
    }

    func contains(bucket: String, srcId: Int) -> Bool {
        entries[key(bucket, srcId)] != nil
    }

    /// Drop entries older than `days` days to keep the index small.
    mutating func prune(keepingDays days: Int = 7) {
        let cutoff = Int64(Date().timeIntervalSince1970 * 1000) - Int64(days * 86_400_000)
        entries = entries.filter { $0.value > cutoff }
    }

    private func key(_ bucket: String, _ srcId: Int) -> String { "\(bucket):\(srcId)" }
}

// MARK: - PollingCursor  (tracks polling position across restarts)

struct PollingCursor: Codable {
    var lastEventTimestamp: Date
    var windowBucketId: String?
}

// MARK: - Segment verification report

struct SegmentReport {
    let date: String
    let recordCount: Int
    let corruptedLines: Int
    let sizeBytes: Int64
    let lastModified: Date
}

// MARK: - Shared date formatter

/// ISO8601 date formatter with microsecond precision, used for all event timestamps.
/// Handles both formats: with and without fractional seconds.
final class ISO8601Formatter {
    static let shared = ISO8601Formatter()

    private let fmt: ISO8601DateFormatter

    private init() {
        fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fmt.timeZone = TimeZone(identifier: "UTC")!
    }

    func date(from string: String) -> Date? {
        if let d = fmt.date(from: string) { return d }
        // Fallback: no fractional seconds
        let f2 = ISO8601DateFormatter()
        f2.formatOptions = [.withInternetDateTime]
        return f2.date(from: string)
    }

    func string(from date: Date) -> String { fmt.string(from: date) }
}
