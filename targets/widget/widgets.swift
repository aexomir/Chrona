import WidgetKit
import SwiftUI

// MARK: - Shared helpers

private let appGroup = "group.com.aexomir.Focus"

extension Color {
    init?(hex: String) {
        guard !hex.isEmpty else { return nil }
        let hex = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard hex.count == 6, let value = UInt64(hex, radix: 16) else { return nil }
        self.init(
            red:   Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8)  & 0xFF) / 255,
            blue:  Double(value & 0xFF)          / 255
        )
    }
}

private func formatTime(_ iso: String) -> String {
    guard let date = ISO8601DateFormatter().date(from: iso) else { return "" }
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    return f.string(from: date)
}

private func formatDuration(_ minutes: Int) -> String {
    guard minutes > 0 else { return "0m" }
    if minutes < 60 { return "\(minutes)m" }
    let h = minutes / 60
    let m = minutes % 60
    return m == 0 ? "\(h)h" : "\(h)h \(m)m"
}

private let suggestionTexts = [
    "Deep work", "Study session", "Creative flow",
    "Focus block", "Writing sprint", "Problem solving"
]

private func currentSuggestion() -> String {
    let index = Int(Date().timeIntervalSince1970 / 60) % suggestionTexts.count
    return suggestionTexts[index]
}

// MARK: ─────────────────────────────────────────────────────────────────────
// MARK: FOCUS TIME WIDGET
// MARK: ─────────────────────────────────────────────────────────────────────

private let focusKey = "focus_data"

struct FocusWidgetData {
    let focusMinutesToday: Int
    let isTracking: Bool
    let currentSessionMinutes: Int
    let startTimestamp: String
    let currentSessionTitle: String
    let projectName: String
    let projectIcon: String
    let projectColor: String

    var hasProject: Bool { !projectName.isEmpty }
    var color: Color { Color(hex: projectColor) ?? .blue }
    var startDate: Date? {
        guard !startTimestamp.isEmpty else { return nil }
        return parseISO(startTimestamp)
    }

    static var empty: FocusWidgetData {
        FocusWidgetData(focusMinutesToday: 0, isTracking: false, currentSessionMinutes: 0,
                        startTimestamp: "", currentSessionTitle: "", projectName: "", projectIcon: "", projectColor: "")
    }

    static func load() -> FocusWidgetData {
        let defaults = UserDefaults(suiteName: appGroup)
        guard let data = defaults?.data(forKey: focusKey),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return .empty }
        return FocusWidgetData(
            focusMinutesToday: json["focusMinutesToday"] as? Int ?? 0,
            isTracking: (json["isTracking"] as? Int ?? 0) == 1,
            currentSessionMinutes: json["currentSessionMinutes"] as? Int ?? 0,
            startTimestamp: json["startTimestamp"] as? String ?? "",
            currentSessionTitle: json["currentSessionTitle"] as? String ?? "",
            projectName: json["projectName"] as? String ?? "",
            projectIcon: json["projectIcon"] as? String ?? "",
            projectColor: json["projectColor"] as? String ?? ""
        )
    }
}

struct FocusWidgetProvider: WidgetKit.TimelineProvider {
    func placeholder(in context: Context) -> FocusWidgetEntry { FocusWidgetEntry(date: Date(), data: .empty) }
    func getSnapshot(in context: Context, completion: @escaping (FocusWidgetEntry) -> Void) {
        completion(FocusWidgetEntry(date: Date(), data: FocusWidgetData.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (WidgetKit.Timeline<FocusWidgetEntry>) -> Void) {
        let data = FocusWidgetData.load()
        let entry = FocusWidgetEntry(date: Date(), data: data)
        let interval = data.isTracking ? 1 : 5
        let next = Calendar.current.date(byAdding: .minute, value: interval, to: Date())!
        completion(WidgetKit.Timeline(entries: [entry], policy: .after(next)))
    }
}

struct FocusWidgetEntry: WidgetKit.TimelineEntry {
    let date: Date
    let data: FocusWidgetData
}

// MARK: - Shared subviews

private struct LiveBadge: View {
    let color: Color
    var body: some View {
        Text("LIVE")
            .font(.system(size: 8, weight: .bold, design: .monospaced))
            .kerning(1.0)
            .foregroundStyle(color)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(Capsule().fill(color.opacity(0.18)))
    }
}

private struct TrackingRightView: View {
    let data: FocusWidgetData
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(data.color.opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: data.projectIcon.isEmpty ? "folder.fill" : data.projectIcon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(data.color)
            }
            .padding(.bottom, 8)
            Text(data.projectName)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
            Text(data.currentSessionTitle.isEmpty ? "In session" : data.currentSessionTitle)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .padding(.top, 1)
            Spacer()
            if let startDate = data.startDate {
                Text(startDate, style: .timer)
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(data.color)
                    .monospacedDigit()
            } else {
                Text(formatDuration(data.currentSessionMinutes))
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(data.color)
            }
        }
    }
}

private struct IdleRightView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("START")
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .kerning(1.2)
                .foregroundStyle(.tertiary)
            Spacer()
            Image(systemName: "play.fill")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.primary)
            Text(currentSuggestion())
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .padding(.top, 4)
            Spacer()
            Text("Tap to begin")
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
        }
    }
}

// MARK: - Small

struct SmallFocusView: View {
    let data: FocusWidgetData
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("FOCUS")
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .kerning(1.5)
                Spacer()
                if data.isTracking {
                    LiveBadge(color: data.hasProject ? data.color : .green)
                }
            }
            Spacer()
            Text(formatDuration(data.focusMinutesToday))
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text("today")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
                .padding(.bottom, 10)
            Divider().overlay(.white.opacity(0.08)).padding(.bottom, 8)
            if data.isTracking && data.hasProject {
                HStack(spacing: 6) {
                    Image(systemName: data.projectIcon.isEmpty ? "folder.fill" : data.projectIcon)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(data.color)
                    Text(data.projectName)
                        .font(.system(size: 11, weight: .medium))
                        .lineLimit(1)
                    Spacer()
                    if let startDate = data.startDate {
                        Text(startDate, style: .timer)
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(data.color)
                            .monospacedDigit()
                    } else {
                        Text(formatDuration(data.currentSessionMinutes))
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(data.color)
                    }
                }
            } else {
                HStack(spacing: 5) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.tertiary)
                    Text(currentSuggestion())
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .containerBackground(.fill.quaternary, for: .widget)
    }
}

// MARK: - Medium

struct MediumFocusView: View {
    let data: FocusWidgetData
    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("FOCUS")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .kerning(1.5)
                    Spacer()
                    if data.isTracking {
                        LiveBadge(color: data.hasProject ? data.color : .green)
                    }
                }
                Spacer()
                Text(formatDuration(data.focusMinutesToday))
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.45)
                    .lineLimit(1)
                Text("today")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            Rectangle()
                .fill(.white.opacity(0.07))
                .frame(width: 1)
                .padding(.vertical, 4)
                .padding(.horizontal, 14)
            Group {
                if data.isTracking && data.hasProject {
                    TrackingRightView(data: data)
                } else {
                    IdleRightView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
        .containerBackground(.fill.quaternary, for: .widget)
    }
}

struct FocusTimeWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: FocusWidgetEntry
    var body: some View {
        if family == .systemMedium { MediumFocusView(data: entry.data) }
        else { SmallFocusView(data: entry.data) }
    }
}

struct FocusTimeWidget: Widget {
    let kind = "com.aexomir.FocusTimeWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FocusWidgetProvider()) { entry in
            FocusTimeWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Focus Time")
        .description("Your focus time and active project at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: ─────────────────────────────────────────────────────────────────────
// MARK: TIMELINE WIDGET
// MARK: ─────────────────────────────────────────────────────────────────────

private let timelineKey = "timeline_data"

private let isoParserFractional: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

private let isoParserBasic: ISO8601DateFormatter = ISO8601DateFormatter()

private func parseISO(_ str: String) -> Date? {
    isoParserFractional.date(from: str) ?? isoParserBasic.date(from: str)
}

private func formatTimeFromDate(_ date: Date) -> String {
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    return f.string(from: date)
}

struct TimelineSession: Identifiable {
    let id: String
    let title: String
    let projectName: String
    let projectIcon: String
    let projectColor: String
    let startDate: Date
    let durationMinutes: Int
    let isActive: Bool

    var color: Color { Color(hex: projectColor) ?? .blue }
}

struct TimelineWidgetData {
    let sessions: [TimelineSession]
    let isTracking: Bool

    static var empty: TimelineWidgetData {
        TimelineWidgetData(sessions: [], isTracking: false)
    }

    static func load() -> TimelineWidgetData {
        let defaults = UserDefaults(suiteName: appGroup)
        guard let data = defaults?.data(forKey: timelineKey),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return .empty }

        let isTracking = (json["isTracking"] as? Int ?? 0) == 1
        let rawSessions = json["sessions"] as? [[String: Any]] ?? []

        let sessions: [TimelineSession] = rawSessions.compactMap { s in
            guard let startStr = s["startTime"] as? String,
                  let startDate = parseISO(startStr)
            else { return nil }
            return TimelineSession(
                id: startStr,
                title: s["title"] as? String ?? "",
                projectName: s["projectName"] as? String ?? "",
                projectIcon: s["projectIcon"] as? String ?? "",
                projectColor: s["projectColor"] as? String ?? "",
                startDate: startDate,
                durationMinutes: s["durationMinutes"] as? Int ?? 0,
                isActive: (s["isActive"] as? Int ?? 0) == 1
            )
        }

        return TimelineWidgetData(sessions: sessions, isTracking: isTracking)
    }
}

struct TimelineWidgetEntry: WidgetKit.TimelineEntry {
    let date: Date
    let data: TimelineWidgetData
}

struct TimelineWidgetProvider: WidgetKit.TimelineProvider {
    func placeholder(in context: Context) -> TimelineWidgetEntry {
        TimelineWidgetEntry(date: Date(), data: .empty)
    }
    func getSnapshot(in context: Context, completion: @escaping (TimelineWidgetEntry) -> Void) {
        completion(TimelineWidgetEntry(date: Date(), data: TimelineWidgetData.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (WidgetKit.Timeline<TimelineWidgetEntry>) -> Void) {
        let data = TimelineWidgetData.load()
        let entry = TimelineWidgetEntry(date: Date(), data: data)
        let interval = data.isTracking ? 1 : 15
        let next = Calendar.current.date(byAdding: .minute, value: interval, to: Date())!
        completion(WidgetKit.Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Subviews

private struct TimelineSessionRow: View {
    let session: TimelineSession
    let showConnector: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // Dot + connector
            VStack(spacing: 0) {
                ZStack {
                    if session.isActive {
                        Circle()
                            .fill(session.color.opacity(0.22))
                            .frame(width: 12, height: 12)
                    }
                    Circle()
                        .fill(session.color)
                        .frame(width: session.isActive ? 7 : 6, height: session.isActive ? 7 : 6)
                }
                .frame(width: 12, height: 12)

                if showConnector {
                    Rectangle()
                        .fill(Color.white.opacity(0.07))
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                }
            }

            // Content
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(session.title.isEmpty ? "Untitled" : session.title)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    if !session.projectName.isEmpty {
                        HStack(spacing: 3) {
                            Image(systemName: session.projectIcon.isEmpty ? "folder.fill" : session.projectIcon)
                                .font(.system(size: 8, weight: .semibold))
                                .foregroundStyle(session.color)
                            Text(session.projectName)
                                .font(.system(size: 10))
                                .foregroundStyle(.tertiary)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    if session.isActive {
                        Text(session.startDate, style: .timer)
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundStyle(session.color)
                            .monospacedDigit()
                    } else {
                        Text(formatDuration(session.durationMinutes))
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Text(formatTimeFromDate(session.startDate))
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundStyle(.quaternary)
                        .monospacedDigit()
                }
            }
            .padding(.bottom, showConnector ? 10 : 0)
        }
    }
}

private struct TimelineWidgetHeader: View {
    let isTracking: Bool
    let activeColor: Color

    var body: some View {
        HStack(spacing: 6) {
            Text("TIMELINE")
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .foregroundStyle(.secondary)
                .kerning(1.5)
            Spacer()
            if isTracking {
                LiveBadge(color: activeColor)
            } else {
                Text("TODAY")
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .foregroundStyle(.quaternary)
                    .kerning(1.0)
            }
        }
    }
}

private struct TimelineEmptyState: View {
    var body: some View {
        VStack(spacing: 5) {
            Image(systemName: "timer")
                .font(.system(size: 16))
                .foregroundStyle(.quaternary)
            Text("No sessions yet")
                .font(.system(size: 11))
                .foregroundStyle(.quaternary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Medium

struct MediumTimelineView: View {
    let data: TimelineWidgetData

    private var activeColor: Color {
        data.sessions.first?.color ?? .green
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TimelineWidgetHeader(isTracking: data.isTracking, activeColor: activeColor)
                .padding(.bottom, 10)

            if data.sessions.isEmpty {
                TimelineEmptyState()
            } else {
                let visible = Array(data.sessions.prefix(3))
                let overflow = data.sessions.count - visible.count

                ForEach(Array(visible.enumerated()), id: \.element.id) { idx, session in
                    let isLast = idx == visible.count - 1 && overflow == 0
                    TimelineSessionRow(session: session, showConnector: !isLast)
                }

                if overflow > 0 {
                    Text("+\(overflow) more")
                        .font(.system(size: 10))
                        .foregroundStyle(.quaternary)
                        .padding(.top, 6)
                        .padding(.leading, 20)
                }
            }

            Spacer(minLength: 0)
        }
        .widgetURL(URL(string: "focus://(tabs)/timeline"))
        .containerBackground(.fill.quaternary, for: .widget)
    }
}

// MARK: - Large

struct LargeTimelineView: View {
    let data: TimelineWidgetData

    private var activeColor: Color {
        data.sessions.first?.color ?? .green
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TimelineWidgetHeader(isTracking: data.isTracking, activeColor: activeColor)
                .padding(.bottom, 12)

            if data.sessions.isEmpty {
                TimelineEmptyState()
            } else {
                let visible = Array(data.sessions.prefix(6))
                let overflow = data.sessions.count - visible.count

                ForEach(Array(visible.enumerated()), id: \.element.id) { idx, session in
                    let isLast = idx == visible.count - 1 && overflow == 0
                    TimelineSessionRow(session: session, showConnector: !isLast)
                }

                if overflow > 0 {
                    Text("+\(overflow) more")
                        .font(.system(size: 10))
                        .foregroundStyle(.quaternary)
                        .padding(.top, 6)
                        .padding(.leading, 20)
                }
            }

            Spacer(minLength: 0)
        }
        .widgetURL(URL(string: "focus://(tabs)/timeline"))
        .containerBackground(.fill.quaternary, for: .widget)
    }
}

struct TimelineWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: TimelineWidgetEntry

    var body: some View {
        if family == .systemLarge {
            LargeTimelineView(data: entry.data)
        } else {
            MediumTimelineView(data: entry.data)
        }
    }
}

struct TimelineWidget: Widget {
    let kind = "com.aexomir.TimelineWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TimelineWidgetProvider()) { entry in
            TimelineWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Timeline")
        .description("Your focus sessions for today at a glance.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
