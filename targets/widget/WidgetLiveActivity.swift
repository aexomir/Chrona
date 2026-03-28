import ActivityKit
import WidgetKit
import SwiftUI

struct ChronaActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startDate: Date
        var title: String
        var projectName: String
        var projectIcon: String
        var projectColor: String
    }
}

// MARK: - Lock Screen

private struct ChronaLockScreenView: View {
    let context: ActivityViewContext<ChronaActivityAttributes>

    private var color: Color { Color(hex: context.state.projectColor) ?? .green }
    private var icon: String { context.state.projectIcon.isEmpty ? "timer" : context.state.projectIcon }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 10) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 36, height: 36)
                    Image(systemName: icon)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 18, height: 18)
                        .foregroundStyle(color)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.title.isEmpty ? "Chrona Session" : context.state.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(context.state.projectName.isEmpty ? "Chrona" : context.state.projectName)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(color)
                        .lineLimit(1)
                }
                .layoutPriority(1)

                Spacer(minLength: 8)

                Text(context.state.startDate, style: .timer)
                    .font(.system(size: 22, weight: .bold, design: .monospaced))
                    .foregroundStyle(color)
                    .monospacedDigit()
                    .lineLimit(1)
                    .frame(minWidth: 72, alignment: .trailing)
            }

            Link(destination: URL(string: "chrona://stop")!) {
                Label("Stop", systemImage: "stop.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(.white.opacity(0.08)))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

// MARK: - Dynamic Island: Expanded

private struct ChronaDILeading: View {
    let context: ActivityViewContext<ChronaActivityAttributes>

    private var color: Color { Color(hex: context.state.projectColor) ?? .green }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: context.state.projectIcon.isEmpty ? "timer" : context.state.projectIcon)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 20, height: 20)
                    .foregroundStyle(color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(context.state.title.isEmpty ? "Chrona Session" : context.state.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(context.state.projectName.isEmpty ? "Chrona" : context.state.projectName)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(color)
                    .lineLimit(1)
            }
        }
        .frame(maxHeight: .infinity, alignment: .center)
        .padding(.leading, 4)
    }
}

private struct ChronaDITrailing: View {
    let context: ActivityViewContext<ChronaActivityAttributes>

    var body: some View {
        Text(context.state.startDate, style: .timer)
            .font(.system(size: 22, weight: .bold, design: .monospaced))
            .foregroundStyle(Color(hex: context.state.projectColor) ?? .green)
            .monospacedDigit()
            .frame(maxHeight: .infinity, alignment: .center)
            .padding(.trailing, 4)
    }
}

// MARK: - Dynamic Island: Compact & Minimal

private struct ChronaDICompactLeading: View {
    let context: ActivityViewContext<ChronaActivityAttributes>

    var body: some View {
        Image(systemName: context.state.projectIcon.isEmpty ? "timer" : context.state.projectIcon)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 32, height: 16, alignment: .center)
            .foregroundStyle(Color(hex: context.state.projectColor) ?? .green)
    }
}

private struct ChronaDICompactTrailing: View {
    let context: ActivityViewContext<ChronaActivityAttributes>

    var body: some View {
        Text(context.state.startDate, style: .timer)
            .font(.system(size: 12, weight: .semibold, design: .monospaced))
            .foregroundStyle(Color(hex: context.state.projectColor) ?? .green)
            .frame(width: 40, height: 16, alignment: .center)
    }
}

private struct ChronaDIMinimal: View {
    let context: ActivityViewContext<ChronaActivityAttributes>

    var body: some View {
        Image(systemName: context.state.projectIcon.isEmpty ? "timer" : context.state.projectIcon)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 14, height: 14)
            .foregroundStyle(Color(hex: context.state.projectColor) ?? .green)
    }
}

// MARK: - Widget

struct WidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ChronaActivityAttributes.self) { context in
            ChronaLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ChronaDILeading(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ChronaDITrailing(context: context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Link(destination: URL(string: "chrona://stop")!) {
                        Label("Stop", systemImage: "stop.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.6))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(.white.opacity(0.08)))
                    }
                    .padding(.horizontal, 4)
                    .padding(.bottom, 4)
                }
            } compactLeading: {
                ChronaDICompactLeading(context: context)
            } compactTrailing: {
                ChronaDICompactTrailing(context: context)
            } minimal: {
                ChronaDIMinimal(context: context)
            }
            .widgetURL(URL(string: "focus://timer"))
            .keylineTint(Color(hex: context.state.projectColor) ?? .green)
        }
    }
}

// MARK: - Preview

extension ChronaActivityAttributes.ContentState {
    fileprivate static var active: ChronaActivityAttributes.ContentState {
        ChronaActivityAttributes.ContentState(
            startDate: Date().addingTimeInterval(-2520),
            title: "Deep Work",
            projectName: "Work",
            projectIcon: "briefcase.fill",
            projectColor: "#ef4444"
        )
    }
}

#Preview("Notification", as: .content, using: ChronaActivityAttributes()) {
    WidgetLiveActivity()
} contentStates: {
    ChronaActivityAttributes.ContentState.active
}
