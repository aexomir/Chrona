import os

// MARK: - Centralised os.Logger instances
//
// One logger per logical subsystem. All entries appear in Console.app under
// subsystem "com.focus.FocusHelper" and can be filtered by category.
//
// Usage:
//   Logger.lifecycle.info("App launched")
//   Logger.watcher.error("Watcher stalled: \(reason)")

extension Logger {
    private static let subsystem = "com.focus.FocusHelper"

    /// App and process lifecycle events (launch, terminate, instance guard).
    static let lifecycle = Logger(subsystem: subsystem, category: "Lifecycle")

    /// ActivityCoordinator orchestration — source selection, restart, event ingestion.
    static let poller    = Logger(subsystem: subsystem, category: "ActivityCoordinator")

    /// NativeWindowWatcher — NSWorkspace notifications, AX API calls.
    static let watcher   = Logger(subsystem: subsystem, category: "NativeWatcher")

    /// ExternalActivitySource — REST polling, AW connectivity.
    static let external  = Logger(subsystem: subsystem, category: "ExternalSource")

    /// DataStore — segment writes, dedup, cursor updates.
    static let store     = Logger(subsystem: subsystem, category: "DataStore")

    /// EventBroadcaster / StreamServer — WebSocket clients, Bonjour.
    static let broadcast = Logger(subsystem: subsystem, category: "Broadcaster")

    /// HealthMonitor — periodic checks, staleness, component verdicts.
    static let health    = Logger(subsystem: subsystem, category: "HealthMonitor")
}
