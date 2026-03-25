import AppKit
import Foundation
import Combine
import os

@MainActor
final class ActivityCoordinator: ObservableObject {
    @Published var isRunning             = false
    @Published var sourceStatus          = ActivitySourceStatus.idle
    @Published var lastEventTime: Date?
    @Published var statusMessage         = "Idle"
    @Published var sourceMode            = ActivitySourceFactory.currentMode
    @Published var eventsLoggedToday     = 0
    @Published var totalEvents           = 0
    @Published var corruptedLines        = 0
    @Published var connectedClients      = 0
    @Published var isStreamServerRunning = false
    @Published var health: HealthReport?

    var hasTitleAccess: Bool {
        if case .running(let ta) = sourceStatus { return ta == .available }
        return false
    }

    var streamConnectionAddress: String { broadcaster.connectionAddress }
    var streamHostnameAddress: String    { broadcaster.hostnameAddress }

    var storeSummary: String {
        guard let store else { return "—" }
        return "\(store.segmentCount) files · \(store.totalSizeString)"
    }

    func openDataFolder() {
        guard let store else { return }
        NSWorkspace.shared.open(store.eventsDir)
    }

    var permissionManager: PermissionManager? {
        source.permissionManager
    }

    let healthMonitor: HealthMonitor
    let meetingDetector = MeetingDetector()

    private let broadcaster = EventBroadcaster()
    private var source:  any ActivitySource
    private var store:   DataStore?
    private var eventCounter = 0
    private var infraCancellables  = Set<AnyCancellable>()
    private var sourceCancellables = Set<AnyCancellable>()

    private var restartAttempts = 0
    private var restartTask: Task<Void, Never>?
    private let resetAfter: TimeInterval = 120
    private var resetTask: Task<Void, Never>?

    init() {
        source        = ActivitySourceFactory.make()
        sourceMode    = ActivitySourceFactory.currentMode
        healthMonitor = HealthMonitor()    // coordinator reference set below once self is ready

        // Wire coordinator reference into the health monitor now that all stored properties
        // have been initialised (Swift's two-phase init requirement).
        healthMonitor.configure(coordinator: self)

        setUpInfrastructure()
        subscribeToSource()

        try? broadcaster.start()
        registerShutdownHandler()

        start()
        Logger.poller.info("ActivityCoordinator initialised, mode=\(self.sourceMode.rawValue)")
    }

    func start() {
        guard !isRunning, store != nil else { return }
        isRunning = true
        source.start()
        healthMonitor.start()
        Logger.poller.info("Activity collection started")
    }

    func stop() {
        restartTask?.cancel()
        resetTask?.cancel()
        source.stop()
        isRunning     = false
        statusMessage = "Stopped"
        Logger.poller.info("Activity collection stopped")
    }

    func switchMode(to mode: ActivitySourceMode) {
        Logger.poller.info("Switching source mode: \(self.sourceMode.rawValue) → \(mode.rawValue)")
        stop()
        sourceCancellables.removeAll()
        restartAttempts = 0       // manual mode switch resets backoff

        ActivitySourceFactory.currentMode = mode
        sourceMode = mode
        source     = ActivitySourceFactory.make(mode: mode)

        subscribeToSource()
        start()
    }

    func requestTitleAccess() {
        source.requestTitleAccess()
    }

    /// Called by HealthMonitor to expose the latest report into the UI.
    func applyHealthReport(_ report: HealthReport) {
        health = report
    }

    private func setUpInfrastructure() {
        broadcaster.onNewClientConnected = { [weak self] in
            self?.source.emitCurrentState()
        }

        broadcaster.$connectedClients
            .assign(to: \.connectedClients, on: self)
            .store(in: &infraCancellables)

        broadcaster.$isServerRunning
            .assign(to: \.isStreamServerRunning, on: self)
            .store(in: &infraCancellables)

        healthMonitor.$report
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] r in self?.health = r }
            .store(in: &infraCancellables)

        meetingDetector.$meetingState
            .dropFirst()    // skip the initial .none published at init
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard let self else { return }
                self.broadcaster.broadcastMeeting(state)
                Logger.meetings.info("Meeting state broadcast — inMeeting=\(state.isInMeeting)")
            }
            .store(in: &infraCancellables)

        do {
            let s = try DataStore()
            store = s
            syncStats(from: s)
            Logger.poller.info("DataStore ready — \(s.totalCount) total events on disk")
        } catch {
            Logger.poller.fault("DataStore init failed: \(error.localizedDescription)")
            statusMessage = "Storage error: \(error.localizedDescription)"
        }
    }

    private func subscribeToSource() {
        source.statusPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] (s: ActivitySourceStatus) in self?.apply(status: s) }
            .store(in: &sourceCancellables)

        source.activityPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] (w: ActivityWindow) in self?.ingest(w) }
            .store(in: &sourceCancellables)
    }

    private func registerShutdownHandler() {
        NotificationCenter.default.addObserver(
            forName: NSApplication.willTerminateNotification,
            object:  nil,
            queue:   .main
        ) { [weak self] _ in
            // The notification arrives on the main thread; bridging to MainActor is safe.
            Task { @MainActor [weak self] in
                self?.shutDown()
            }
        }
    }

    private func shutDown() {
        Logger.lifecycle.info("App terminating — flushing in-progress session…")
        healthMonitor.stop()
        stop()
        broadcaster.stop()
        Logger.lifecycle.info("Clean shutdown complete")
    }

    private func apply(status: ActivitySourceStatus) {
        let previous = sourceStatus
        sourceStatus = status

        switch status {
        case .idle:
            statusMessage = "Idle"
        case .running(let ta):
            statusMessage = ta == .available ? "Watching…" : "Watching (app names only)"
            if case .failed = previous { scheduleBackoffReset() }
            Logger.poller.info("Source running — titleAccess=\(ta == .available)")
        case .failed(let msg):
            isRunning = false
            statusMessage = "Error: \(msg)"
            Logger.poller.error("Source failed: \(msg) — scheduling restart")
            scheduleRestart()
        case .stopped:
            isRunning = false
            Logger.poller.info("Source stopped")
        }
    }

    private func scheduleRestart() {
        let delay = min(5.0 * pow(2.0, Double(restartAttempts)), 300.0)
        restartAttempts += 1

        Logger.poller.warning(
            "Restart scheduled in \(Int(delay))s (attempt \(self.restartAttempts))"
        )

        restartTask?.cancel()
        restartTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard !Task.isCancelled else { return }
            await MainActor.run { self?.executeRestart() }
        }
    }

    private func executeRestart() {
        guard case .failed = sourceStatus else { return }   // guard: may have recovered

        Logger.poller.info("Executing restart (attempt \(self.restartAttempts))…")

        sourceCancellables.removeAll()
        source = ActivitySourceFactory.make(mode: sourceMode)
        subscribeToSource()
        isRunning = true
        source.start()
    }

    private func scheduleBackoffReset() {
        resetTask?.cancel()
        resetTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64((self?.resetAfter ?? 120) * 1_000_000_000))
            guard !Task.isCancelled else { return }
            await MainActor.run { [weak self] in
                guard let self, case .running = self.sourceStatus else { return }
                let old = self.restartAttempts
                self.restartAttempts = 0
                if old > 0 {
                    Logger.poller.info("Backoff counter reset after stable run (was \(old))")
                }
            }
        }
    }

    private func ingest(_ window: ActivityWindow) {
        guard let store else { return }

        eventCounter += 1
        let event = window.normalized(bucket: source.bucketId, counter: eventCounter)

        do {
            let written = try store.write(batch: [event])
            lastEventTime = Date()
            syncStats(from: store)

            if !written.isEmpty {
                broadcaster.queue(
                    records:     written,
                    eventsToday: store.todayCount,
                    isPolling:   isRunning
                )
                statusMessage = "Logged \(written.count) event\(written.count == 1 ? "" : "s")"
                Logger.poller.debug(
                    "Stored \(written.count) event(s): app=\(window.app) dur=\(Int(window.duration))s"
                )
            }
        } catch {
            Logger.poller.error("Store write failed: \(error.localizedDescription)")
            statusMessage = error.localizedDescription
        }
    }

    private func syncStats(from store: DataStore) {
        eventsLoggedToday = store.todayCount
        totalEvents       = store.totalCount
        corruptedLines    = store.corruptedCount
    }
}
