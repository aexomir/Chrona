import Foundation
import os

// MARK: - HealthReport

/// Point-in-time snapshot of every trackable component.
/// Produced by `HealthMonitor` every `checkInterval` seconds and on demand.
struct HealthReport {

    // MARK: Overall verdict

    enum Verdict: Equatable {
        /// All components are operating within normal parameters.
        case healthy
        /// Something is suboptimal but collection is still running.
        case degraded(String)
        /// A critical component is not functioning; data may be lost.
        case unhealthy(String)
    }

    let checkedAt: Date
    let verdict: Verdict

    // MARK: Per-component flags

    /// The activity source is in `.running` state.
    let sourceRunning: Bool
    /// Seconds since the last successfully stored event; nil if no event yet.
    let eventStaleness: TimeInterval?
    /// The DataStore events directory exists and is writable.
    let storeHealthy: Bool
    /// The WebSocket broadcaster is listening for iOS connections.
    let broadcasterListening: Bool

    // MARK: Derived helpers

    var isHealthy:   Bool { verdict == .healthy }
    var isDegraded:  Bool { if case .degraded  = verdict { return true }; return false }
    var isUnhealthy: Bool { if case .unhealthy = verdict { return true }; return false }

    /// Short human-readable string suitable for the menu bar status row.
    var summary: String {
        switch verdict {
        case .healthy:              return "All systems normal"
        case .degraded(let msg):    return "Degraded: \(msg)"
        case .unhealthy(let msg):   return "Unhealthy: \(msg)"
        }
    }
}

// MARK: - HealthMonitor

/// Runs a periodic background check and publishes a `HealthReport`.
///
/// Checks performed every `checkInterval` seconds:
///   1. Is the activity source in `.running` state?
///   2. How long since the last event? (staleness)
///   3. Can the DataStore events directory be written to?
///   4. Is the WebSocket broadcaster listening?
///
/// Staleness thresholds:
///   - Embedded source: the watcher flushes every 30 s, so > 120 s with no
///     event while supposedly running indicates a stall.
///   - External source: polls a remote server that may be idle; > 600 s is used.
///
/// Consumers observe `report` via Combine or SwiftUI `@Published`.
@MainActor
final class HealthMonitor {

    // MARK: - Published

    @Published private(set) var report: HealthReport?

    // MARK: - Configuration

    /// How often to run the full health check (seconds).
    let checkInterval: TimeInterval

    // MARK: - Inputs (weak to avoid retain cycles)

    private weak var coordinatorRef: ActivityCoordinator?

    // MARK: - Private

    private var monitorTask: Task<Void, Never>?

    // MARK: - Init

    /// Pass `nil` when constructing inside a class `init()` before `self` is complete;
    /// call `configure(coordinator:)` immediately after all stored properties are set.
    init(coordinator: ActivityCoordinator? = nil, checkInterval: TimeInterval = 60) {
        self.coordinatorRef = coordinator
        self.checkInterval  = checkInterval
    }

    /// Attaches the coordinator reference. Must be called before `start()`.
    func configure(coordinator: ActivityCoordinator) {
        coordinatorRef = coordinator
    }

    // MARK: - Lifecycle

    func start() {
        guard monitorTask == nil else { return }
        monitorTask = Task { [weak self] in
            // Run an immediate check on startup, then on the interval.
            await self?.runCheck()
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(self?.checkInterval ?? 60) * 1_000_000_000)
                if Task.isCancelled { break }
                await self?.runCheck()
            }
        }
    }

    func stop() {
        monitorTask?.cancel()
        monitorTask = nil
    }

    /// Runs a check immediately (outside the regular interval).
    /// Safe to call at any time.
    func checkNow() {
        Task { [weak self] in await self?.runCheck() }
    }

    // MARK: - Private – check logic

    private func runCheck() async {
        guard let coordinator = coordinatorRef else { return }

        let sourceRunning = coordinator.isRunning

        // Staleness: how long since the last event arrived.
        let staleness: TimeInterval? = coordinator.lastEventTime.map {
            Date().timeIntervalSince($0)
        }

        // Store health: events directory must be writable.
        let storeHealthy = isStoreWritable()

        // Broadcaster: WebSocket server is listening.
        let broadcasterListening = coordinator.isStreamServerRunning

        // Decide verdict.
        let verdict = evaluate(
            mode:                coordinator.sourceMode,
            sourceRunning:       sourceRunning,
            staleness:           staleness,
            storeHealthy:        storeHealthy,
            broadcasterListening: broadcasterListening
        )

        let r = HealthReport(
            checkedAt:            Date(),
            verdict:              verdict,
            sourceRunning:        sourceRunning,
            eventStaleness:       staleness,
            storeHealthy:         storeHealthy,
            broadcasterListening: broadcasterListening
        )

        report = r
        logReport(r)
    }

    private func evaluate(
        mode: ActivitySourceMode,
        sourceRunning: Bool,
        staleness: TimeInterval?,
        storeHealthy: Bool,
        broadcasterListening: Bool
    ) -> HealthReport.Verdict {

        // Unhealthy conditions — collection or storage is broken.
        if !storeHealthy {
            return .unhealthy("DataStore not writable")
        }
        if !sourceRunning {
            return .unhealthy("Activity source not running")
        }

        // Degraded conditions — collection is running but may have gaps.
        let stalenessLimit: TimeInterval = mode == .embedded ? 120 : 600
        if let age = staleness, age > stalenessLimit {
            let mins = Int(age / 60)
            return .degraded("No event received for \(mins) min")
        }
        if !broadcasterListening {
            return .degraded("iOS stream server not listening")
        }

        return .healthy
    }

    // MARK: - Private – helpers

    private func isStoreWritable() -> Bool {
        guard let support = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: false
        ) else { return false }

        let eventsDir = support
            .appendingPathComponent("FocusHelper/v1/events")
        return FileManager.default.isWritableFile(atPath: eventsDir.path)
    }

    private func logReport(_ r: HealthReport) {
        switch r.verdict {
        case .healthy:
            Logger.health.debug("Health check passed — all systems normal")
        case .degraded(let msg):
            Logger.health.warning("Health degraded: \(msg)")
        case .unhealthy(let msg):
            Logger.health.error("Health unhealthy: \(msg)")
        }
        if let age = r.eventStaleness {
            Logger.health.debug("Last event \(Int(age))s ago | store=\(r.storeHealthy) | broadcast=\(r.broadcasterListening)")
        }
    }
}
