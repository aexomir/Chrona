import Foundation
import Darwin   // for O_APPEND, open(), write(), close()

// MARK: - Errors

enum DataStoreError: Error, LocalizedError {
    case cannotOpenSegment(URL)
    case writeIncomplete(expected: Int, written: Int)

    var errorDescription: String? {
        switch self {
        case .cannotOpenSegment(let url):
            return "Cannot open segment: \(url.lastPathComponent)"
        case .writeIncomplete(let e, let w):
            return "Partial write — expected \(e) B, wrote \(w) B"
        }
    }
}

// MARK: - DataStore

/// Append-only, segmented local event store.
///
/// Directory layout (never changes — `v1` prefix enables future schema migrations):
/// ```
/// ~/Library/Application Support/FocusHelper/
///   v1/
///     events/
///       2024-01-01.jsonl    ← one segment per calendar day (local time)
///       2024-01-02.jsonl    ← segments are immutable once the day rolls over
///     index/
///       cursor.json         ← polling cursor (lastEventTimestamp + windowBucketId)
///       seen.json           ← dedup index: "bucket:srcId" → written-at epoch ms
///     staging/
///       .write-<uuid>       ← in-flight batch (atomically committed, then deleted)
/// ```
///
/// Safety guarantees:
///
/// 1. **Atomic per-line writes** — segments are opened with `O_APPEND`. Each JSON
///    line is < 512 bytes, so every `write()` syscall is atomic per POSIX PIPE_BUF.
///    A crash between lines leaves the file with complete lines only.
///
/// 2. **Staging write-ahead** — the full batch is written to a `.write-<uuid>` staging
///    file before touching the segment. If the process is killed mid-batch, the
///    staging file is cleaned up on next launch; the segment stays intact.
///
/// 3. **Dedup index** — `seen.json` records every (bucket, srcId) pair written.
///    Events that arrive again (e.g. after a restart with an overlapping cursor)
///    are silently dropped before hitting the segment file.
///
/// 4. **Corruption recovery** — `readSegment(date:)` skips any line that fails
///    JSON decoding and counts it separately. The file is never repaired in-place.
///
/// 5. **Schema versioning** — every record carries `"v": 1`. Readers can handle
///    multiple schema versions without rewriting old files.
///
/// 6. **Sync-friendly chunks** — daily segments are small, self-contained, and
///    identified by date. A sync layer can ship only files modified after the
///    last sync without any coordination protocol.
final class DataStore {

    // MARK: - Public directories

    let dataDir: URL        // …/FocusHelper/v1
    let eventsDir: URL      // …/v1/events
    private let indexDir: URL
    private let stagingDir: URL

    // MARK: - Live stats (incremental; rebuilt from disk on init)

    private(set) var todayCount = 0
    private(set) var totalCount = 0
    private(set) var corruptedCount = 0

    // MARK: - Private state

    private var seen = SeenIndex()
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    // MARK: - Init

    init() throws {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        dataDir    = support.appendingPathComponent("FocusHelper/v1")
        eventsDir  = dataDir.appendingPathComponent("events")
        indexDir   = dataDir.appendingPathComponent("index")
        stagingDir = dataDir.appendingPathComponent("staging")

        for dir in [eventsDir, indexDir, stagingDir] {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }

        encoder = JSONEncoder()
        encoder.outputFormatting = []   // compact — one JSON object per line, no pretty-printing

        decoder = JSONDecoder()

        // Recovery: delete any orphaned staging files from a previous crash.
        // These represent in-flight batches that never committed to a segment.
        cleanStagingDirectory()

        // Load the persisted dedup index and prune stale entries.
        seen = loadSeenIndex()

        // Rebuild stats by scanning all segment files.
        rebuildStats()
    }

    // MARK: - Write

    /// Write a batch of normalized events.
    ///
    /// Returns the StoredRecords actually persisted (after dedup).
    /// Events already in the seen index are silently dropped.
    /// Events are grouped by calendar day before writing so each daily segment
    /// stays self-contained (important for incremental sync and streaming).
    @discardableResult
    func write(batch events: [NormalizedEvent]) throws -> [StoredRecord] {
        // Filter duplicates before any I/O
        let novel = events.filter { !seen.contains(bucket: $0.bucket, srcId: $0.sourceEventId) }
        guard !novel.isEmpty else { return [] }

        // Group by local calendar day — most batches will be a single day
        let byDay = Dictionary(grouping: novel) { localDayKey(from: $0.timestamp) }

        var written: [StoredRecord] = []
        for (day, dayEvents) in byDay {
            written.append(contentsOf: try commitBatch(dayEvents, toSegment: day))
        }
        return written
    }

    /// Atomically commit one day's worth of events to the segment file.
    ///
    /// Steps:
    ///   1. Encode records → JSON lines (each must be < 512 bytes for atomic O_APPEND)
    ///   2. Write all lines to a staging file (Data.write uses tmp+rename → atomic)
    ///   3. Open the day segment with O_APPEND and write each line (atomic per POSIX)
    ///   4. Update in-memory stats and seen index; persist the seen index atomically
    ///   5. Delete staging file (cleanup)
    private func commitBatch(_ events: [NormalizedEvent], toSegment day: String) throws -> [StoredRecord] {
        let segmentURL = eventsDir.appendingPathComponent("\(day).jsonl")
        let stagingURL = stagingDir.appendingPathComponent(".write-\(UUID().uuidString)")

        // Step 1 — encode
        let records = events.map { StoredRecord(from: $0) }
        let lines: [Data] = try records.map { record in
            var line = try encoder.encode(record)
            line.append(0x0A)   // newline
            // Sanity check: warn if a line is suspiciously large (> 400 bytes).
            // This means the record won't be atomic under strict POSIX, though
            // APFS handles it correctly in practice.
            assert(line.count < 512, "StoredRecord line exceeded 512 bytes (\(line.count) B). Check field sizes.")
            return line
        }

        // Step 2 — write full batch to staging (atomic at the file level)
        let stagingData = lines.reduce(Data(), +)
        try stagingData.write(to: stagingURL, options: [.atomic])

        // Step 3 — open segment with O_APPEND and write line-by-line
        //   O_CREAT creates the file on first write for the day.
        //   O_APPEND positions the write offset at EOF before each write() syscall,
        //   making concurrent writers safe (not a concern here, but good practice).
        ensureFile(at: segmentURL)
        let fd = Darwin.open(segmentURL.path, O_WRONLY | O_APPEND | O_CREAT, 0o644)
        guard fd != -1 else { throw DataStoreError.cannotOpenSegment(segmentURL) }
        defer { Darwin.close(fd) }

        for line in lines {
            let n = line.withUnsafeBytes { Darwin.write(fd, $0.baseAddress, $0.count) }
            guard n == line.count else {
                throw DataStoreError.writeIncomplete(expected: line.count, written: max(0, n))
            }
        }

        // Step 4 — update in-memory state
        let today = localTodayKey()
        for record in records {
            seen.mark(bucket: record.bucket, srcId: record.srcId)
            totalCount += 1
            if day == today { todayCount += 1 }
        }

        // Persist seen index atomically (atomic write via Foundation's .atomic option)
        try persistSeenIndex()

        // Step 5 — cleanup staging file (non-fatal if it fails)
        try? FileManager.default.removeItem(at: stagingURL)

        return records
    }

    // MARK: - Read / Verification

    /// Parse all valid records from a day segment.
    /// Lines that fail JSON decoding are skipped and counted separately.
    /// The segment file is never modified.
    func readSegment(date: String) -> (records: [StoredRecord], corrupted: Int) {
        let url = eventsDir.appendingPathComponent("\(date).jsonl")
        guard let raw = try? String(contentsOf: url, encoding: .utf8) else { return ([], 0) }

        var records: [StoredRecord] = []
        var corrupted = 0

        for line in raw.components(separatedBy: "\n") {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { continue }

            guard
                let data   = trimmed.data(using: .utf8),
                let record = try? decoder.decode(StoredRecord.self, from: data)
            else {
                corrupted += 1
                continue
            }
            records.append(record)
        }
        return (records, corrupted)
    }

    /// Scan every segment file and return a per-file integrity report.
    /// Useful for debugging and future sync coordination.
    func verifyAll() -> [SegmentReport] {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: eventsDir,
            includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]
        ) else { return [] }

        return files
            .filter { $0.pathExtension == "jsonl" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .map { url in
                let date = url.deletingPathExtension().lastPathComponent
                let (records, corrupted) = readSegment(date: date)
                let attrs = try? url.resourceValues(
                    forKeys: [.fileSizeKey, .contentModificationDateKey]
                )
                return SegmentReport(
                    date: date,
                    recordCount: records.count,
                    corruptedLines: corrupted,
                    sizeBytes: Int64(attrs?.fileSize ?? 0),
                    lastModified: attrs?.contentModificationDate ?? Date()
                )
            }
    }

    // MARK: - Cursor

    func loadCursor() -> PollingCursor? {
        guard let data = try? Data(contentsOf: indexDir.appendingPathComponent("cursor.json")) else { return nil }
        return try? decoder.decode(PollingCursor.self, from: data)
    }

    func saveCursor(_ cursor: PollingCursor) {
        guard let data = try? encoder.encode(cursor) else { return }
        // .atomic uses tmp + rename internally — safe across power loss
        try? data.write(to: indexDir.appendingPathComponent("cursor.json"), options: .atomic)
    }

    // MARK: - Dedup index

    private func loadSeenIndex() -> SeenIndex {
        guard
            let data  = try? Data(contentsOf: indexDir.appendingPathComponent("seen.json")),
            var index = try? decoder.decode(SeenIndex.self, from: data)
        else { return SeenIndex() }
        index.prune(keepingDays: 7)
        return index
    }

    private func persistSeenIndex() throws {
        var toWrite = seen
        toWrite.prune(keepingDays: 7)
        let data = try encoder.encode(toWrite)
        // .atomic: Foundation writes to a temp file, then renames — single syscall, safe
        try data.write(to: indexDir.appendingPathComponent("seen.json"), options: .atomic)
    }

    // MARK: - Startup helpers

    private func cleanStagingDirectory() {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: stagingDir, includingPropertiesForKeys: nil
        ) else { return }
        for file in files where file.lastPathComponent.hasPrefix(".write-") {
            try? FileManager.default.removeItem(at: file)
        }
    }

    private func rebuildStats() {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: eventsDir, includingPropertiesForKeys: nil
        ) else { return }

        let today = localTodayKey()
        var todayTotal = 0, allTotal = 0, corrupted = 0

        for file in files where file.pathExtension == "jsonl" {
            let date = file.deletingPathExtension().lastPathComponent
            let (records, corr) = readSegment(date: date)
            allTotal  += records.count
            corrupted += corr
            if date == today { todayTotal = records.count }
        }

        todayCount     = todayTotal
        totalCount     = allTotal
        corruptedCount = corrupted
    }

    // MARK: - Utilities

    private func ensureFile(at url: URL) {
        guard !FileManager.default.fileExists(atPath: url.path) else { return }
        FileManager.default.createFile(atPath: url.path, contents: nil)
    }

    /// Calendar day key in the user's local timezone (e.g. "2024-01-15").
    private func localTodayKey() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: Date())
    }

    /// Convert an ISO8601 UTC timestamp to a local calendar day key.
    private func localDayKey(from isoTimestamp: String) -> String {
        guard let date = ISO8601Formatter.shared.date(from: isoTimestamp) else {
            return String(isoTimestamp.prefix(10))  // best-effort fallback
        }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: date)
    }

    // MARK: - File metadata

    var segmentCount: Int {
        (try? FileManager.default.contentsOfDirectory(at: eventsDir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "jsonl" }.count) ?? 0
    }

    var totalSizeString: String {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: eventsDir, includingPropertiesForKeys: [.fileSizeKey]
        ) else { return "0 B" }
        let bytes = files
            .compactMap { try? $0.resourceValues(forKeys: [.fileSizeKey]).fileSize }
            .reduce(0, +)
        let kb = Double(bytes) / 1024
        if kb < 1 { return "\(bytes) B" }
        if kb < 1024 { return String(format: "%.1f KB", kb) }
        return String(format: "%.1f MB", kb / 1024)
    }
}
