import Foundation
import os

struct HealthReport {
    enum Verdict: Equatable {
        
        case healthy
        case degraded(String)
        
        case unhealthy(String)
    }

    let checkedAt: Date
    let verdict: Verdict

    let sourceRunning: Bool
    let eventStaleness: TimeInterval?
    let storeHealthy: Bool
    let broadcasterListening: Bool

    var isHealthy:   Bool { verdict == .healthy }
    var isDegraded:  Bool { if case .degraded  = verdict { return true }; return false }
    var isUnhealthy: Bool { if case .unhealthy = verdict { return true }; return false }

    var summary: String {
        switch verdict {
        case .healthy:              return "All systems normal"
        case .degraded(let msg):    return "Degraded: \(msg)"
        case .unhealthy(let msg):   return "Unhealthy: \(msg)"
        }
    }
}

@MainActor
final class HealthMonitor {
    @Published private(set) var report: HealthReport?

    /// How often to run the full health check (seconds).
    let checkInterval: TimeInterval

    /// Maximum time without an event before reporting degraded health.
    /// Embedded source (NativeWindowWatcher flushes every 30s): 120s = 4x flush interval.
    /// External source (REST polling every 30s): 600s = 20x poll interval (conservative for idle periods).
    let stalenessThreshold: (embedded: TimeInterval, external: TimeInterval)

    private weak var coordinatorRef: ActivityCoordinator?
    private var monitorTask: Task<Void, Never>?

    init(
        coordinator: ActivityCoordinator? = nil,
        checkInterval: TimeInterval = 60,
        stalenessThreshold: (embedded: TimeInterval, external: TimeInterval) = (120, 600)
    ) {
        self.coordinatorRef = coordinator
        self.checkInterval = checkInterval
        self.stalenessThreshold = stalenessThreshold
    }

    func configure(coordinator: ActivityCoordinator) {
        coordinatorRef = coordinator
    }

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

    func checkNow() {
        Task { [weak self] in await self?.runCheck() }
    }

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
        let stalenessLimit: TimeInterval = mode == .embedded ? stalenessThreshold.embedded : stalenessThreshold.external
        if let age = staleness, age > stalenessLimit {
            let mins = Int(age / 60)
            return .degraded("No event received for \(mins) min")
        }
        if !broadcasterListening {
            return .degraded("iOS stream server not listening")
        }

        return .healthy
    }

    private func isStoreWritable() -> Bool {
        guard let support = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: false
        ) else { return false }

        let eventsDir = support
            .appendingPathComponent("ChronaHelper/v1/events")
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
