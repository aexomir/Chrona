import ActivityKit
import WidgetKit
import SwiftUI

struct FocusActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startDate: Date
    }
    var title: String
    var projectName: String
    var projectIcon: String
    var projectColor: String
}

// MARK: - Lock Screen

private struct FocusLockScreenView: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    private var color: Color { Color(hex: context.attributes.projectColor) ?? .green }
    private var icon: String { context.attributes.projectIcon.isEmpty ? "timer" : context.attributes.projectIcon }

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
                Text(context.attributes.title.isEmpty ? "Focus Session" : context.attributes.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(context.attributes.projectName.isEmpty ? "Focus" : context.attributes.projectName)
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

    private var color: Color { Color(hex: context.attributes.projectColor) ?? .green }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: context.attributes.projectIcon.isEmpty ? "timer" : context.attributes.projectIcon)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 20, height: 20)
                    .foregroundStyle(color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.title.isEmpty ? "Focus Session" : context.attributes.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(context.attributes.projectName.isEmpty ? "Focus" : context.attributes.projectName)
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
            .foregroundStyle(Color(hex: context.attributes.projectColor) ?? .green)
            .monospacedDigit()
            .frame(maxHeight: .infinity, alignment: .center)
            .padding(.trailing, 4)
    }
}

// MARK: - Dynamic Island: Compact & Minimal

private struct FocusDICompactLeading: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        Image(systemName: context.attributes.projectIcon.isEmpty ? "timer" : context.attributes.projectIcon)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 32, height: 16, alignment: .center)
            .foregroundStyle(Color(hex: context.attributes.projectColor) ?? .green)
    }
}

private struct FocusDICompactTrailing: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        Text(context.state.startDate, style: .timer)
            .font(.system(size: 12, weight: .semibold, design: .monospaced))
            .foregroundStyle(Color(hex: context.attributes.projectColor) ?? .green)
            .frame(width: 40, height: 16, alignment: .center)
    }
}

private struct FocusDIMinimal: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        Image(systemName: context.attributes.projectIcon.isEmpty ? "timer" : context.attributes.projectIcon)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 14, height: 14)
            .foregroundStyle(Color(hex: context.attributes.projectColor) ?? .green)
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
                FocusDICompactLeading(context: context) //timer
            } compactTrailing: {
                FocusDICompactTrailing(context: context) //logo
            } minimal: {
                // FocusDIMinimal(context: context) //!?
            }
            .widgetURL(URL(string: "focus://timer"))
            .keylineTint(Color(hex: context.attributes.projectColor) ?? .green)
        }
    }
}

// MARK: - Preview

extension FocusActivityAttributes {
    fileprivate static var preview: FocusActivityAttributes {
        FocusActivityAttributes(title: "Deep Work", projectName: "Work", projectIcon: "briefcase.fill", projectColor: "#ef4444")
    }
}

extension FocusActivityAttributes.ContentState {
    fileprivate static var active: FocusActivityAttributes.ContentState {
        FocusActivityAttributes.ContentState(startDate: Date().addingTimeInterval(-2520))
    }
}

#Preview("Notification", as: .content, using: FocusActivityAttributes.preview) {
    WidgetLiveActivity()
} contentStates: {
    FocusActivityAttributes.ContentState.active
}
