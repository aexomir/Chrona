import Combine

// MARK: - ActivitySource protocol
//
// The single seam between ActivityPoller and any activity-collection backend.
// ActivityPoller only ever talks to this interface — it has no import of AppKit,
// ApplicationServices, or any ActivityWatch REST types.
//
// Replacing the backend (new watcher technology, cloud-based sync, test double)
// means implementing this protocol and updating ActivitySourceFactory. Nothing
// else in the app needs to change.

protocol ActivitySource: AnyObject {

    // MARK: Identity

    /// Stable string that identifies the storage namespace for events produced
    /// by this source. Written into every `StoredRecord` as the `bucket` field.
    /// Must be unique across sources to keep the dedup index clean.
    var bucketId: String { get }

    // MARK: Observable state

    /// The current lifecycle and capability status of this source.
    var status: ActivitySourceStatus { get }

    /// A publisher that emits every time `status` changes.
    /// Guaranteed to emit on the main thread.
    var statusPublisher: AnyPublisher<ActivitySourceStatus, Never> { get }

    // MARK: Activity stream

    /// Publishes a completed `ActivityWindow` each time an attention span ends.
    /// Guaranteed to emit on the main thread.
    var activityPublisher: AnyPublisher<ActivityWindow, Never> { get }

    // MARK: Lifecycle

    /// Begin collecting activity data.
    /// Calling `start()` when already running is a no-op.
    func start()

    /// Stop collecting and flush any in-progress session to `activityPublisher`.
    /// Calling `stop()` when already stopped is a no-op.
    func stop()

    // MARK: Permissions

    /// The permission manager for this source, or nil if the source has no
    /// platform permission requirements (e.g. the external REST source).
    /// Consumers use this to show permission UI without knowing the source type.
    var permissionManager: PermissionManager? { get }

    /// Request elevated access that improves data quality (e.g. window titles).
    /// For sources that do not need extra permissions this is a no-op.
    /// Must be called from a user-initiated action.
    func requestTitleAccess()
}
