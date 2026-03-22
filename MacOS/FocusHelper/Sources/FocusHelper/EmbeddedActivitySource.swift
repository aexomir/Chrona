import AppKit
import Combine
import os

// MARK: - EmbeddedActivitySource
//
// Production implementation of `ActivitySource` using only native macOS APIs.
// Owns the `PermissionManager` so permission state outlives source restarts
// (the manager holds the UserDefaults "has prompted" flag and the poll task).

@MainActor
final class EmbeddedActivitySource: ActivitySource {

    // MARK: - ActivitySource identity

    let bucketId = "focus-embedded"

    // MARK: - ActivitySource state

    private(set) var status: ActivitySourceStatus = .idle

    var statusPublisher: AnyPublisher<ActivitySourceStatus, Never> {
        statusSubject.eraseToAnyPublisher()
    }

    var activityPublisher: AnyPublisher<ActivityWindow, Never> {
        activitySubject.eraseToAnyPublisher()
    }

    // MARK: - ActivitySource permissions

    /// The permission manager for this source.
    /// Owned here so it survives source restarts and the UI can always observe it.
    let permissionManager: PermissionManager?   // non-nil for this source

    // MARK: - Private

    private let watcher: NativeWindowWatcher
    private let statusSubject   = CurrentValueSubject<ActivitySourceStatus, Never>(.idle)
    private let activitySubject = PassthroughSubject<ActivityWindow, Never>()
    private var cancellables    = Set<AnyCancellable>()

    // MARK: - Init

    init() {
        let pm = PermissionManager()
        permissionManager = pm
        watcher = NativeWindowWatcher(permissionManager: pm)

        // Forward window events.
        watcher.onEvent = { [weak self] (window: ActivityWindow) in
            self?.activitySubject.send(window)
        }

        // Mirror the watcher's accessibility flag to the source status.
        watcher.$hasAccessibility
            .receive(on: DispatchQueue.main)
            .sink { [weak self] (hasAccess: Bool) in
                guard let self, case .running = self.status else { return }
                let next = ActivitySourceStatus.running(
                    titleAccess: hasAccess ? .available : .unavailable
                )
                self.status = next
                self.statusSubject.send(next)
            }
            .store(in: &cancellables)
    }

    // MARK: - ActivitySource lifecycle

    func start() {
        guard case .idle = status else { return }
        watcher.start()
        let next = ActivitySourceStatus.running(
            titleAccess: watcher.hasAccessibility ? .available : .unavailable
        )
        status = next
        statusSubject.send(next)
        Logger.watcher.info("EmbeddedActivitySource started — titleAccess=\(self.watcher.hasAccessibility)")
    }

    func stop() {
        guard case .running = status else { return }
        watcher.stop()
        status = .stopped
        statusSubject.send(.stopped)
        Logger.watcher.info("EmbeddedActivitySource stopped")
    }

    // MARK: - ActivitySource permissions

    func requestTitleAccess() {
        permissionManager?.performAction()
    }
}
