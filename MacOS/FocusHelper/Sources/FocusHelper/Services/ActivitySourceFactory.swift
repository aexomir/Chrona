import Foundation

// MARK: - ActivitySourceFactory
//
// Single point of construction for `ActivitySource` implementations.
// The chosen mode is persisted in UserDefaults so it survives app restarts.
// `ActivityCoordinator` uses this factory; nothing else needs to know it exists.

enum ActivitySourceFactory {

    // MARK: - UserDefaults keys

    private static let modeKey        = "com.chrona.activitySourceMode"
    private static let externalURLKey = "com.chrona.externalAWServerURL"

    // MARK: - Persisted configuration

    /// The active source mode, persisted across launches.
    static var currentMode: ActivitySourceMode {
        get {
            guard
                let raw = UserDefaults.standard.string(forKey: modeKey),
                let mode = ActivitySourceMode(rawValue: raw)
            else { return .embedded }
            return mode
        }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: modeKey) }
    }

    /// URL for the external ActivityWatch server (used when `currentMode == .external`).
    /// Defaults to the standard local ActivityWatch installation.
    static var externalServerURL: URL {
        get {
            guard
                let raw = UserDefaults.standard.string(forKey: externalURLKey),
                let url = URL(string: raw)
            else { return URL(string: "http://localhost:5600/api/0")! }
            return url
        }
        set { UserDefaults.standard.set(newValue.absoluteString, forKey: externalURLKey) }
    }

    // MARK: - Factory

    /// Constructs and returns the `ActivitySource` for the currently configured mode.
    @MainActor
    static func make() -> any ActivitySource {
        make(mode: currentMode)
    }

    /// Constructs and returns an `ActivitySource` for the given mode.
    /// The external URL is read from `externalServerURL`.
    @MainActor
    static func make(mode: ActivitySourceMode) -> any ActivitySource {
        switch mode {
        case .embedded:
            return EmbeddedActivitySource()
        case .external:
            return ExternalActivitySource(serverURL: externalServerURL)
        }
    }
}
