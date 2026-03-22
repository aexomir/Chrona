import SwiftUI
import Combine

struct MenuBarView: View {
    @EnvironmentObject var poller: ActivityPoller

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            activityHeader
            Divider().padding(.horizontal, 8)
            activityStats
            Divider().padding(.horizontal, 8)
            streamSection
            Divider().padding(.horizontal, 8)
            sourceSection
            Divider().padding(.horizontal, 8)
            controls
            Divider().padding(.horizontal, 8).padding(.vertical, 2)
            MenuButton(label: "Quit FocusHelper", systemImage: "power") {
                NSApplication.shared.terminate(nil)
            }
            .padding(.bottom, 4)
        }
        .frame(width: 280)
        .background(Color(NSColor.windowBackgroundColor))
    }

    // MARK: - Sections

    private var activityHeader: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(poller.isConnected ? Color.green : Color.red.opacity(0.8))
                .frame(width: 8, height: 8)
            Text(poller.isConnected ? "Watching activity" : "Watcher stopped")
                .font(.system(size: 12, weight: .medium))
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, poller.hasTitleAccess ? 8 : 4)
    }

    private var activityStats: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Permission banner — shown for the embedded source when permission is non-granted.
            if let pm = poller.permissionManager {
                PermissionBannerView(manager: pm)
                    .padding(.horizontal, 14)
                    .padding(.bottom, 4)
            }

            StatRow(label: "Today",    value: "\(poller.eventsLoggedToday) events")
            StatRow(label: "All time", value: "\(poller.totalEvents) events · \(segmentInfo)")
            if poller.corruptedLines > 0 {
                StatRow(
                    label: "Corrupted",
                    value: "\(poller.corruptedLines) lines skipped",
                    valueColor: .orange
                )
            }
            if let last = poller.lastEventTime {
                StatRow(label: "Last event", value: relativeTime(last))
            }
            StatRow(label: "Status", value: poller.statusMessage)

            // Health row — only shown when something is non-nominal.
            if let h = poller.health, !h.isHealthy {
                StatRow(
                    label: "Health",
                    value: h.summary,
                    valueColor: h.isDegraded ? .orange : .red
                )
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var streamSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Circle()
                    .fill(poller.broadcaster.isServerRunning ? Color.blue : Color.gray)
                    .frame(width: 6, height: 6)
                Text("iOS Stream")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if poller.connectedClients > 0 {
                    Text("\(poller.connectedClients) connected")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.blue)
                }
            }

            let addr = poller.broadcaster.connectionAddress
            if addr != "offline" {
                StatRow(label: "IP",   value: poller.broadcaster.connectionAddress)
                StatRow(label: "Host", value: poller.broadcaster.hostnameAddress)
            } else {
                StatRow(label: "Stream", value: "Server offline", valueColor: .secondary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    /// Source mode toggle — switches between embedded (native) and external (AW server).
    private var sourceSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                Text("Data source")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                Spacer()
            }
            HStack(spacing: 8) {
                sourceModeButton(for: .embedded,  label: "Native")
                sourceModeButton(for: .external,  label: "ActivityWatch")
                Spacer()
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private func sourceModeButton(for mode: ActivitySourceMode, label: String) -> some View {
        let isActive = poller.sourceMode == mode
        return Button { if !isActive { poller.switchMode(to: mode) } } label: {
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(isActive ? Color.accentColor : Color.secondary.opacity(0.15))
                .foregroundStyle(isActive ? Color.white : Color.primary)
                .cornerRadius(4)
        }
        .buttonStyle(.plain)
    }

    private var controls: some View {
        Group {
            if poller.isPolling {
                MenuButton(label: "Pause Watching", systemImage: "pause.circle") {
                    poller.stop()
                }
            } else {
                MenuButton(label: "Start Watching", systemImage: "play.circle.fill") {
                    poller.start()
                }
            }

            MenuButton(label: "Open Data Folder", systemImage: "folder") {
                if let store = try? DataStore() {
                    NSWorkspace.shared.open(store.eventsDir)
                }
            }
        }
    }

    // MARK: - Helpers

    private var segmentInfo: String {
        if let store = try? DataStore() {
            return "\(store.segmentCount) files · \(store.totalSizeString)"
        }
        return "—"
    }

    private func relativeTime(_ date: Date) -> String {
        let secs = Int(-date.timeIntervalSinceNow)
        if secs < 60 { return "\(secs)s ago" }
        return "\(secs / 60)m ago"
    }
}

// MARK: - Sub-components

private struct StatRow: View {
    let label: String
    let value: String
    var valueColor: Color = .primary

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(valueColor)
        }
    }
}

private struct MenuButton: View {
    let label: String
    let systemImage: String
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .frame(width: 16)
                Text(label)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(isHovered ? Color.accentColor.opacity(0.15) : Color.clear)
        .cornerRadius(4)
        .padding(.horizontal, 4)
        .onHover { isHovered = $0 }
    }
}

// MARK: - PermissionBannerView
//
// State-aware permission banner for the Accessibility permission.
// Hidden when permission is granted. Shows explanation + correct action button otherwise.

private struct PermissionBannerView: View {
    @ObservedObject var manager: PermissionManager

    var body: some View {
        // Hidden completely when permission is already granted.
        if manager.permissionState != .granted {
            permissionRow
        }
    }

    private var permissionRow: some View {
        VStack(alignment: .leading, spacing: 5) {
            // Icon + headline
            HStack(spacing: 5) {
                Image(systemName: iconName)
                    .font(.system(size: 10))
                    .foregroundStyle(iconColor)
                Text(headline)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(iconColor)
                Spacer()
                actionButton
            }
            // Explanation — concise, honest about degraded mode
            Text(manager.permissionState.explanationText)
                .font(.system(size: 9.5))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(1.5)
        }
        .padding(8)
        .background(bannerBackground)
        .cornerRadius(6)
    }

    private var headline: String {
        switch manager.permissionState {
        case .notDetermined: return "Window title tracking is available"
        case .denied:        return "Accessibility access needed"
        case .granted:       return ""
        }
    }

    private var iconName: String {
        switch manager.permissionState {
        case .notDetermined: return "lock.open"
        case .denied:        return "lock.shield"
        case .granted:       return ""
        }
    }

    private var iconColor: Color {
        manager.permissionState == .denied ? .orange : .blue
    }

    private var bannerBackground: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(iconColor.opacity(0.07))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(iconColor.opacity(0.20), lineWidth: 0.5)
            )
    }

    private var actionButton: some View {
        Button(manager.permissionState.actionLabel) {
            manager.performAction()
        }
        .font(.system(size: 10, weight: .medium))
        .buttonStyle(.plain)
        .foregroundStyle(.blue)
    }
}
