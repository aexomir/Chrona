import WidgetKit
import SwiftUI

private let appGroup = "group.com.aexomir.Focus"
private let widgetKey = "focus_data"

// MARK: - Data

struct WidgetData {
    let focusMinutesToday: Int
    let isTracking: Bool
    let currentSessionMinutes: Int
    let currentSessionTitle: String
    let projectName: String
    let projectIcon: String
    let projectColor: String

    var hasProject: Bool { !projectName.isEmpty }
    var color: Color { Color(hex: projectColor) ?? .blue }

    static var empty: WidgetData {
        WidgetData(focusMinutesToday: 0, isTracking: false, currentSessionMinutes: 0,
                   currentSessionTitle: "", projectName: "", projectIcon: "", projectColor: "")
    }

    static func load() -> WidgetData {
        let defaults = UserDefaults(suiteName: appGroup)
        guard let data = defaults?.data(forKey: widgetKey),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return .empty }
        return WidgetData(
            focusMinutesToday: json["focusMinutesToday"] as? Int ?? 0,
            isTracking: (json["isTracking"] as? Int ?? 0) == 1,
            currentSessionMinutes: json["currentSessionMinutes"] as? Int ?? 0,
            currentSessionTitle: json["currentSessionTitle"] as? String ?? "",
            projectName: json["projectName"] as? String ?? "",
            projectIcon: json["projectIcon"] as? String ?? "",
            projectColor: json["projectColor"] as? String ?? ""
        )
    }
}

// MARK: - Color helper

extension Color {
    init?(hex: String) {
        guard !hex.isEmpty else { return nil }
        let hex = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard hex.count == 6, let value = UInt64(hex, radix: 16) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

// MARK: - Timeline

struct FocusTimeProvider: TimelineProvider {
    func placeholder(in context: Context) -> FocusTimeEntry {
        FocusTimeEntry(date: Date(), data: .empty)
    }
    func getSnapshot(in context: Context, completion: @escaping (FocusTimeEntry) -> Void) {
        completion(FocusTimeEntry(date: Date(), data: WidgetData.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<FocusTimeEntry>) -> Void) {
        let data = WidgetData.load()
        let entry = FocusTimeEntry(date: Date(), data: data)
        let interval = data.isTracking ? 1 : 5
        let next = Calendar.current.date(byAdding: .minute, value: interval, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct FocusTimeEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

// MARK: - Small Widget

struct SmallWidgetView: View {
    let data: WidgetData

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(alignment: .center) {
                Text("FOCUS")
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .kerning(1.5)
                Spacer()
                if data.isTracking {
                    Circle()
                        .fill(data.hasProject ? data.color : .green)
                        .frame(width: 6, height: 6)
                }
            }

            Spacer()

            // Main number
            HStack(alignment: .lastTextBaseline, spacing: 3) {
                Text("\(data.focusMinutesToday)")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                Text("min")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 3)
            }

            Text("today")
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(.tertiary)
                .padding(.bottom, 10)

            // Project row
            if data.hasProject {
                Divider().overlay(.white.opacity(0.08))
                    .padding(.bottom, 8)
                HStack(spacing: 6) {
                    Image(systemName: data.projectIcon.isEmpty ? "folder.fill" : data.projectIcon)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(data.color)
                    Text(data.projectName)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Spacer()
                    if data.isTracking && data.currentSessionMinutes > 0 {
                        Text("+\(data.currentSessionMinutes)m")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(data.color)
                    }
                }
            }
        }
        .containerBackground(.fill.quaternary, for: .widget)
    }
}

// MARK: - Medium Widget

struct MediumWidgetView: View {
    let data: WidgetData

    var body: some View {
        HStack(spacing: 0) {
            // Left: time summary
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("FOCUS")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .kerning(1.5)
                    Spacer()
                    if data.isTracking {
                        Circle()
                            .fill(data.hasProject ? data.color : .green)
                            .frame(width: 6, height: 6)
                    }
                }
                Spacer()
                HStack(alignment: .lastTextBaseline, spacing: 3) {
                    Text("\(data.focusMinutesToday)")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundStyle(.primary)
                        .monospacedDigit()
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Text("min")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 3)
                }
                Text("today")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity)

            // Divider
            Rectangle()
                .fill(.white.opacity(0.07))
                .frame(width: 1)
                .padding(.vertical, 4)
                .padding(.horizontal, 14)

            // Right: project + session
            VStack(alignment: .leading, spacing: 0) {
                if data.hasProject {
                    // Project icon
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
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    if data.isTracking {
                        Text(data.currentSessionTitle.isEmpty ? "In session" : data.currentSessionTitle)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .padding(.top, 1)

                        Spacer()

                        if data.currentSessionMinutes > 0 {
                            Text("+\(data.currentSessionMinutes) min")
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundStyle(data.color)
                        }
                    } else {
                        Spacer()
                        Text("Not tracking")
                            .font(.system(size: 11))
                            .foregroundStyle(.tertiary)
                    }
                } else {
                    Spacer()
                    Text("No project")
                        .font(.system(size: 12))
                        .foregroundStyle(.tertiary)
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .containerBackground(.fill.quaternary, for: .widget)
    }
}

// MARK: - Entry View

struct FocusTimeWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: FocusTimeProvider.Entry

    var body: some View {
        switch family {
        case .systemMedium:
            MediumWidgetView(data: entry.data)
        default:
            SmallWidgetView(data: entry.data)
        }
    }
}

// MARK: - Widget

struct FocusTimeWidget: Widget {
    let kind: String = "com.aexomir.FocusTimeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FocusTimeProvider()) { entry in
            FocusTimeWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Focus Time")
        .description("Track your daily focus time and active project.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview

#Preview("Small", as: .systemSmall) {
    FocusTimeWidget()
} timeline: {
    FocusTimeEntry(date: .now, data: WidgetData(
        focusMinutesToday: 127, isTracking: true,
        currentSessionMinutes: 23, currentSessionTitle: "Deep Work",
        projectName: "Work", projectIcon: "briefcase.fill", projectColor: "#ef4444"
    ))
}

#Preview("Medium", as: .systemMedium) {
    FocusTimeWidget()
} timeline: {
    FocusTimeEntry(date: .now, data: WidgetData(
        focusMinutesToday: 127, isTracking: true,
        currentSessionMinutes: 23, currentSessionTitle: "Deep Work",
        projectName: "Work", projectIcon: "briefcase.fill", projectColor: "#ef4444"
    ))
}
