import Foundation

// MARK: - MeetingAppDef
//
// Describes one meeting application the detector can recognize.
// To add support for a new app, append an entry to `MeetingAppRegistry.all` —
// no changes to the detection logic in MeetingDetector are required.

struct MeetingAppDef: Identifiable {
    /// Stable, persisted identifier stored in UserDefaults.
    let id: String
    /// Human-readable name shown in the menu bar UI.
    let displayName: String
    /// Exact macOS bundle identifiers — checked first (most reliable).
    let bundleIds: [String]
    /// Case-insensitive substrings matched against the process's localizedName.
    /// Used as a fallback when the bundle ID is unknown or varies between versions.
    let processNamePatterns: [String]
}

// MARK: - Registry

enum MeetingAppRegistry {
    /// The canonical list of supported meeting applications.
    /// Order determines detection priority — first match wins.
    static let all: [MeetingAppDef] = [
        MeetingAppDef(
            id: "zoom",
            displayName: "Zoom",
            bundleIds: ["us.zoom.xos"],
            processNamePatterns: ["zoom"]
        ),
        MeetingAppDef(
            id: "teams",
            displayName: "Microsoft Teams",
            bundleIds: ["com.microsoft.teams", "com.microsoft.teams2"],
            processNamePatterns: ["microsoft teams"]
        ),
        MeetingAppDef(
            id: "meet",
            displayName: "Google Meet",
            bundleIds: ["com.google.Meet"],
            processNamePatterns: ["google meet"]
        ),
        MeetingAppDef(
            id: "webex",
            displayName: "Cisco Webex",
            bundleIds: ["com.cisco.webexmeetings", "Cisco-Systems.Spark"],
            processNamePatterns: ["webex"]
        ),
        MeetingAppDef(
            id: "facetime",
            displayName: "FaceTime",
            bundleIds: ["com.apple.FaceTime"],
            processNamePatterns: []
        ),
        MeetingAppDef(
            id: "around",
            displayName: "Around",
            bundleIds: ["co.around.Around"],
            processNamePatterns: ["around"]
        ),
    ]
}

// MARK: - MeetingState

struct MeetingState: Equatable {
    let isInMeeting: Bool
    let appId: String?
    let appDisplayName: String?

    static let none = MeetingState(isInMeeting: false, appId: nil, appDisplayName: nil)
}
