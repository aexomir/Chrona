import Foundation

// MARK: - ActivityWindow
//
// The single clean domain type that crosses the adapter boundary.
// No ActivityWatch concepts (buckets, srcId, JSON field names) appear here.

/// A completed period of user attention on one application and window.
///
/// Produced by any `ActivitySource` implementation and consumed by `ActivityCoordinator`
/// for storage and broadcasting. The type is intentionally value-like and free of
/// persistence concerns — all storage details are added downstream.
struct ActivityWindow {
    /// Stable identifier for this attention span.
    let id: UUID
    /// Localised application name (e.g. "Xcode", "Safari").
    let app: String
    /// Window or document title; nil when title access is unavailable.
    let title: String?
    /// When this attention span began.
    let startedAt: Date
    /// How long the attention span lasted, in seconds.
    let duration: TimeInterval
}

// MARK: - ActivitySourceStatus

/// Lifecycle and capability state of an `ActivitySource`.
enum ActivitySourceStatus: Equatable {
    /// The source has been created but `start()` has not been called.
    case idle
    /// The source is actively observing.
    case running(titleAccess: TitleAccess)
    /// The source encountered an unrecoverable error.
    case failed(String)
    /// `stop()` was called.
    case stopped

    /// Describes what level of detail the source can currently provide.
    enum TitleAccess: Equatable {
        /// App name and window title are both available.
        case available
        /// Only app names are available (Accessibility permission not granted).
        case unavailable
    }
}

// MARK: - ActivitySourceMode

/// Selects which `ActivitySource` implementation is used at runtime.
enum ActivitySourceMode: String, CaseIterable {
    /// Built-in native watcher — no external processes or ports.
    case embedded
    /// Connects to an ActivityWatch REST server for development or debugging.
    case external

    var displayName: String {
        switch self {
        case .embedded: return "Native (embedded)"
        case .external: return "ActivityWatch (external)"
        }
    }
}

// MARK: - Internal conversion helper
//
// Bridges the clean domain type into the storage layer's NormalizedEvent.
// Lives here so neither ActivityCoordinator nor ActivitySource ever import each other's
// implementation details — each only needs this one file and Models.swift.

extension ActivityWindow {
    /// Converts an `ActivityWindow` to the internal `NormalizedEvent` required by
    /// `DataStore`. This is the only place where the clean domain type is aware of
    /// storage concepts, and it is intentionally package-private (not public API).
    ///
    /// - Parameters:
    ///   - bucket: The storage namespace for this source (e.g. `"focus-embedded"`).
    ///   - counter: Monotonically incrementing integer used as the dedup key.
    func normalized(bucket: String, counter: Int) -> NormalizedEvent {
        NormalizedEvent(
            id:            id.uuidString,
            timestamp:     ISO8601Formatter.shared.string(from: startedAt),
            app:           app,
            duration:      duration,
            title:         title,
            bucket:        bucket,
            sourceEventId: counter
        )
    }
}
