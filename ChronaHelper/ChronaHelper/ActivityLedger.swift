// ActivityLedger.swift — Chrona Helper
//
// The durable record of what this Mac was doing, and the reason app-usage
// accounting no longer depends on the iOS app being connected at the time.
//
// Previously the helper emitted point-in-time transitions and computed nothing;
// anything observed while no client was attached was dropped forever. Since the
// iOS app is suspended by the OS the moment it leaves the foreground, that meant
// almost every session lost almost all of its data.
//
// Now the Mac owns the timeline. It writes closed *spans* — one contiguous
// stretch of a single app being frontmost — to an append-only NDJSON file, and
// answers `usage_query` requests from whatever window the client asks about.
// The client can be offline for the entire session and still get a correct
// breakdown afterwards.
//
// Storage: ~/Library/Application Support/ChronaHelper/spans.ndjson
//          ~/Library/Application Support/ChronaHelper/open-span.json
//
// Time that belongs to no app (idle, display locked, system asleep, helper not
// running) is recorded explicitly as a gap rather than silently credited to
// whatever happened to be frontmost. Queries report those gaps back as coverage,
// so the client can honestly say "42m tracked, 18m idle" instead of inflating
// an app's total.

import Foundation
import os.log

private let kRetentionSeconds: TimeInterval = 7 * 24 * 60 * 60
private let kMaxTitles = 20
/// Below this, a helper_off gap is just launch jitter and not worth recording.
private let kMinGapSeconds: TimeInterval = 2

// MARK: - Ledger records

/// One contiguous stretch of a single app being frontmost.
struct AppSpan: Codable {
    let bundleId: String
    let appName: String
    var titles: [String]
    let start: Double
    var end: Double
}

/// A stretch of time deliberately attributed to no app.
enum GapReason: String {
    case idle
    case locked
    case asleep
    case helperOff = "helper_off"
}

/// Flat on-disk shape for both record kinds — one JSON object per line, kept
/// greppable so the log can be inspected with `cat` during debugging.
private struct LedgerRecord: Codable {
    let kind: String  // "span" | "gap"
    var bundleId: String?
    var appName: String?
    var titles: [String]?
    var reason: String?
    var start: Double
    var end: Double

    static func span(_ s: AppSpan) -> LedgerRecord {
        LedgerRecord(
            kind: "span", bundleId: s.bundleId, appName: s.appName,
            titles: s.titles, reason: nil, start: s.start, end: s.end
        )
    }

    static func gap(_ reason: String, _ start: Double, _ end: Double) -> LedgerRecord {
        LedgerRecord(
            kind: "gap", bundleId: nil, appName: nil,
            titles: nil, reason: reason, start: start, end: end
        )
    }

    var asSpan: AppSpan? {
        guard kind == "span", let bundleId else { return nil }
        return AppSpan(
            bundleId: bundleId, appName: appName ?? "",
            titles: titles ?? [], start: start, end: end
        )
    }
}

// MARK: - Ledger

final class ActivityLedger {

    private var records: [LedgerRecord] = []
    private var handle: FileHandle?
    private var pruneTimer: Timer?

    private let directory: URL
    private let spansURL: URL
    private let openSpanURL: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let log = Logger(subsystem: "com.chrona.helper", category: "ActivityLedger")

    // MARK: Init

    /// `directory` is injectable so tests can point at a scratch location —
    /// `applicationSupportDirectory` resolves through the user record and
    /// ignores `HOME`, so there is no way to isolate it from the environment.
    init(directory: URL? = nil) {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support")
        let resolved = directory ?? base.appendingPathComponent("ChronaHelper", isDirectory: true)
        self.directory = resolved
        spansURL = resolved.appendingPathComponent("spans.ndjson")
        openSpanURL = resolved.appendingPathComponent("open-span.json")

        try? FileManager.default.createDirectory(at: resolved, withIntermediateDirectories: true)

        load()
        startPruneTimer()
    }

    deinit {
        pruneTimer?.invalidate()
        try? handle?.close()
    }

    /// Path shown in the debug menu so the log can be revealed in Finder.
    var logDirectory: URL { directory }

    // MARK: Load / prune

    private func load() {
        records = readRecords().filter { $0.end >= Date().timeIntervalSince1970 - kRetentionSeconds }

        // A span left open by a crash or a hard power loss. Its `end` is the
        // last checkpoint, so at most one checkpoint interval is lost.
        if let orphan = readOpenSpan(), orphan.end > orphan.start {
            records.append(.span(orphan))
        }
        clearOpenSpan()

        records.sort { $0.start < $1.start }
        rewrite()

        // Everything between the last thing we saw and this launch is time the
        // helper was not running — unattributable, and worth saying so.
        //
        // The bound has to be the largest `end`, not the last record in start
        // order: a gap written by a previous launch can outlast a span that
        // starts after it, and starting from the wrong point would emit a gap
        // overlapping existing records, double-counting that stretch in every
        // later query.
        if let lastEnd = records.map({ $0.end }).max() {
            let now = Date().timeIntervalSince1970
            if now - lastEnd > kMinGapSeconds {
                append(.gap(GapReason.helperOff.rawValue, lastEnd, now))
            }
        }
    }

    private func readRecords() -> [LedgerRecord] {
        guard let data = try? Data(contentsOf: spansURL) else { return [] }
        var out: [LedgerRecord] = []
        for line in data.split(separator: 0x0A) where !line.isEmpty {
            if let record = try? decoder.decode(LedgerRecord.self, from: Data(line)) {
                out.append(record)
            }
        }
        return out
    }

    private func startPruneTimer() {
        let timer = Timer.scheduledTimer(withTimeInterval: 6 * 60 * 60, repeats: true) { [weak self] _ in
            self?.prune()
        }
        RunLoop.main.add(timer, forMode: .common)
        pruneTimer = timer
    }

    private func prune() {
        let cutoff = Date().timeIntervalSince1970 - kRetentionSeconds
        let before = records.count
        records.removeAll { $0.end < cutoff }
        guard records.count != before else { return }
        rewrite()
    }

    // MARK: Writing

    /// Records a completed span. Zero- or negative-length spans are dropped —
    /// they carry no information and would only skew the timeline.
    func recordSpan(_ span: AppSpan) {
        guard span.end > span.start else { return }
        append(.span(span))
    }

    func recordGap(reason: GapReason, start: Double, end: Double) {
        guard end - start > 0 else { return }
        append(.gap(reason.rawValue, start, end))
    }

    private func append(_ record: LedgerRecord) {
        records.append(record)
        guard let line = try? encoder.encode(record) else {
            log.error("ledger encode failed")
            return
        }
        if handle == nil { openHandle() }
        do {
            try handle?.write(contentsOf: line + Data([0x0A]))
        } catch {
            log.error("ledger write failed: \(error.localizedDescription, privacy: .public)")
            // The handle may be stale (file replaced out from under us) — drop
            // it so the next append reopens rather than failing forever.
            handle = nil
        }
    }

    private func openHandle() {
        if !FileManager.default.fileExists(atPath: spansURL.path) {
            // 0600: this file contains window titles.
            FileManager.default.createFile(
                atPath: spansURL.path, contents: nil,
                attributes: [.posixPermissions: 0o600]
            )
        }
        handle = try? FileHandle(forWritingTo: spansURL)
        _ = try? handle?.seekToEnd()
    }

    private func rewrite() {
        try? handle?.close()
        handle = nil

        var data = Data()
        for record in records {
            guard let line = try? encoder.encode(record) else { continue }
            data.append(line)
            data.append(0x0A)
        }
        do {
            try data.write(to: spansURL, options: .atomic)
            try? FileManager.default.setAttributes(
                [.posixPermissions: 0o600], ofItemAtPath: spansURL.path
            )
        } catch {
            log.error("ledger rewrite failed: \(error.localizedDescription, privacy: .public)")
        }
        openHandle()
    }

    // MARK: Open-span checkpoint

    /// Mirrors the span currently in progress to disk so a crash loses at most
    /// one checkpoint interval instead of the whole stretch. Deliberately a
    /// separate file: writing provisional spans into the main log would make
    /// back-dating an idle boundary impossible without retracting them.
    func setOpenSpan(_ span: AppSpan?) {
        guard let span else {
            clearOpenSpan()
            return
        }
        guard let data = try? encoder.encode(span) else { return }
        try? data.write(to: openSpanURL, options: .atomic)
        try? FileManager.default.setAttributes(
            [.posixPermissions: 0o600], ofItemAtPath: openSpanURL.path
        )
    }

    private func readOpenSpan() -> AppSpan? {
        guard let data = try? Data(contentsOf: openSpanURL) else { return nil }
        return try? decoder.decode(AppSpan.self, from: data)
    }

    private func clearOpenSpan() {
        try? FileManager.default.removeItem(at: openSpanURL)
    }

    // MARK: Query

    /// Aggregates per-app seconds over `[from, to]`, clipping every span to the
    /// window so a span that merely overlaps contributes only its overlap.
    /// `openSpan` is the stretch still in progress, which by definition has not
    /// been written to the log yet.
    func query(requestId: String, from: Double, to: Double, openSpan: AppSpan?) -> UsageResult {
        let now = Date().timeIntervalSince1970
        let lo = from
        // Never report the future: a client whose clock runs fast would
        // otherwise get an inflated window and a bogus `unknown` remainder.
        let hi = min(to, now)

        guard hi > lo else {
            return UsageResult(
                version: kProtocolVersion, type: "usage_result", requestId: requestId,
                from: lo, to: hi, apps: [],
                coverage: UsageCoverage(observed: 0, idle: 0, locked: 0, asleep: 0, offline: 0, unknown: 0)
            )
        }

        var seconds: [String: Double] = [:]
        var names: [String: String] = [:]
        var titles: [String: [String]] = [:]
        var gaps: [String: Double] = [:]

        func absorb(_ span: AppSpan) {
            let slice = overlap(span.start, span.end, lo, hi)
            guard slice > 0 else { return }
            seconds[span.bundleId, default: 0] += slice
            if names[span.bundleId] == nil, !span.appName.isEmpty {
                names[span.bundleId] = span.appName
            }
            var seen = titles[span.bundleId] ?? []
            for title in span.titles where !title.isEmpty {
                guard seen.count < kMaxTitles else { break }
                if !seen.contains(title) { seen.append(title) }
            }
            titles[span.bundleId] = seen
        }

        for record in records {
            if let span = record.asSpan {
                absorb(span)
            } else if record.kind == "gap" {
                let slice = overlap(record.start, record.end, lo, hi)
                if slice > 0 { gaps[record.reason ?? "unknown", default: 0] += slice }
            }
        }

        if var open = openSpan {
            open.end = now
            absorb(open)
        }

        let apps = seconds
            .map { bundleId, total in
                UsageApp(
                    bundleId: bundleId,
                    appName: names[bundleId] ?? bundleId,
                    seconds: Int(total.rounded()),
                    titles: titles[bundleId] ?? []
                )
            }
            .filter { $0.seconds > 0 }
            .sorted { $0.seconds > $1.seconds }

        let observed = seconds.values.reduce(0, +)
        let idle = gaps[GapReason.idle.rawValue] ?? 0
        let locked = gaps[GapReason.locked.rawValue] ?? 0
        let asleep = gaps[GapReason.asleep.rawValue] ?? 0
        let offline = gaps[GapReason.helperOff.rawValue] ?? 0
        let unknown = max(0, (hi - lo) - observed - idle - locked - asleep - offline)

        return UsageResult(
            version: kProtocolVersion,
            type: "usage_result",
            requestId: requestId,
            from: lo,
            to: hi,
            apps: apps,
            coverage: UsageCoverage(
                observed: Int(observed.rounded()),
                idle: Int(idle.rounded()),
                locked: Int(locked.rounded()),
                asleep: Int(asleep.rounded()),
                offline: Int(offline.rounded()),
                unknown: Int(unknown.rounded())
            )
        )
    }

    private func overlap(_ aStart: Double, _ aEnd: Double, _ bStart: Double, _ bEnd: Double) -> Double {
        max(0, min(aEnd, bEnd) - max(aStart, bStart))
    }
}
