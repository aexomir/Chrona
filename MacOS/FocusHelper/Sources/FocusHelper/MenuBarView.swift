import SwiftUI

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
            controls
            Divider().padding(.horizontal, 8).padding(.vertical, 2)
            MenuButton(label: "Quit FocusHelper", systemImage: "power") {
                NSApplication.shared.terminate(nil)
            }
            .padding(.bottom, 4)
        }
        .frame(width: 260)
        .background(Color(NSColor.windowBackgroundColor))
    }

    // MARK: - Sections

    private var activityHeader: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(poller.isConnected ? Color.green : Color.red.opacity(0.8))
                .frame(width: 8, height: 8)
            Text(poller.isConnected ? "ActivityWatch connected" : "ActivityWatch offline")
                .font(.system(size: 12, weight: .medium))
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    private var activityStats: some View {
        VStack(alignment: .leading, spacing: 4) {
            StatRow(label: "Today",    value: "\(poller.eventsLoggedToday) events")
            StatRow(label: "All time", value: "\(poller.totalEvents) events · \(segmentInfo)")
            if poller.corruptedLines > 0 {
                StatRow(
                    label: "Corrupted",
                    value: "\(poller.corruptedLines) lines skipped",
                    valueColor: .orange
                )
            }
            if let last = poller.lastPollTime {
                StatRow(label: "Last poll", value: relativeTime(last))
            }
            StatRow(label: "Status", value: poller.statusMessage)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var streamSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header row with stream status dot
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

            // Connection address for the iOS app to use
            let addr = poller.broadcaster.connectionAddress
            if addr != "offline" {
                StatRow(label: "IP", value: poller.broadcaster.connectionAddress)
                StatRow(label: "Host", value: poller.broadcaster.hostnameAddress)
            } else {
                StatRow(label: "Stream", value: "Server offline", valueColor: .secondary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var controls: some View {
        Group {
            if poller.isPolling {
                MenuButton(label: "Pause Polling", systemImage: "pause.circle") {
                    poller.stop()
                }
            } else {
                MenuButton(label: "Start Polling", systemImage: "play.circle.fill") {
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
