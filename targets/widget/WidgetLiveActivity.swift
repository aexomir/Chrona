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
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 44, height: 44)
                Image(systemName: icon)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 20, height: 20)
                    .foregroundStyle(color)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(context.state.title.isEmpty ? "Chrona Session" : context.state.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(context.state.projectName.isEmpty ? "Chrona" : context.state.projectName)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(color)
                    .lineLimit(1)
            }

            Spacer(minLength: 100)

            Text(context.state.startDate, style: .timer)
                .font(.system(size: 26, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
    }
}

// MARK: - Dynamic Island: Expanded

private struct FocusDILeading: View {
    let context: ActivityViewContext<FocusActivityAttributes>

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

private struct FocusDITrailing: View {
    let context: ActivityViewContext<FocusActivityAttributes>

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

private struct FocusDICompactLeading: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        Image(systemName: context.state.projectIcon.isEmpty ? "timer" : context.state.projectIcon)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 32, height: 16, alignment: .center)
            .foregroundStyle(Color(hex: context.state.projectColor) ?? .green)
    }
}

private struct FocusDICompactTrailing: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        Text(context.state.startDate, style: .timer)
            .font(.system(size: 12, weight: .semibold, design: .monospaced))
            .foregroundStyle(Color(hex: context.state.projectColor) ?? .green)
            .frame(width: 40, height: 16, alignment: .center)
    }
}

private struct FocusDIMinimal: View {
    let context: ActivityViewContext<FocusActivityAttributes>

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
        ActivityConfiguration(for: FocusActivityAttributes.self) { context in
            FocusLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    FocusDILeading(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    FocusDITrailing(context: context)
                }
            } compactLeading: {
                FocusDICompactLeading(context: context)
            } compactTrailing: {
                FocusDICompactTrailing(context: context)
            } minimal: {
                FocusDIMinimal(context: context)
            }
            .widgetURL(URL(string: "focus://timer"))
            .keylineTint(Color(hex: context.state.projectColor) ?? .green)
        }
    }
}

// MARK: - Preview

extension FocusActivityAttributes.ContentState {
    fileprivate static var active: FocusActivityAttributes.ContentState {
        FocusActivityAttributes.ContentState(
            startDate: Date().addingTimeInterval(-2520),
            title: "Deep Work",
            projectName: "Work",
            projectIcon: "briefcase.fill",
            projectColor: "#ef4444"
        )
    }
}

#Preview("Notification", as: .content, using: FocusActivityAttributes()) {
    WidgetLiveActivity()
} contentStates: {
    FocusActivityAttributes.ContentState.active
}
