import ExpoModulesCore
import ActivityKit

// Must mirror FocusActivityAttributes in WidgetLiveActivity.swift exactly.
struct FocusActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startDate: Date
    }

    var title: String
    var projectName: String
    var projectIcon: String
    var projectColor: String
}

public class ActivityControllerModule: Module {
    private var activityId: String?

    public func definition() -> ModuleDefinition {
        Name("ActivityController")

        AsyncFunction("startActivity") { (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(["activityId": ""])
                return
            }

            // End any existing activity first
            if let existingId = self.activityId {
                for activity in Activity<FocusActivityAttributes>.activities
                where activity.id == existingId {
                    Task { await activity.end(dismissalPolicy: .immediate) }
                }
                self.activityId = nil
            }

            let title        = params["title"]        as? String ?? ""
            let projectName  = params["projectName"]  as? String ?? ""
            let projectIcon  = params["projectIcon"]  as? String ?? ""
            let projectColor = params["projectColor"] as? String ?? ""
            let tsStr        = params["startTimestamp"] as? String ?? ""

            let isoFractional: ISO8601DateFormatter = {
                let f = ISO8601DateFormatter()
                f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                return f
            }()
            let startDate = isoFractional.date(from: tsStr)
                ?? ISO8601DateFormatter().date(from: tsStr)
                ?? Date()

            let attributes = FocusActivityAttributes(
                title: title,
                projectName: projectName,
                projectIcon: projectIcon,
                projectColor: projectColor
            )
            let state = FocusActivityAttributes.ContentState(startDate: startDate)

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: nil),
                    pushType: nil
                )
                self.activityId = activity.id
                promise.resolve(["activityId": activity.id])
            } catch {
                promise.reject(Exception(
                    name: "StartActivityError",
                    description: error.localizedDescription
                ))
            }
        }

        AsyncFunction("endActivity") { (promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil)
                return
            }

            if let existingId = self.activityId {
                for activity in Activity<FocusActivityAttributes>.activities
                where activity.id == existingId {
                    Task { await activity.end(dismissalPolicy: .immediate) }
                }
                self.activityId = nil
            }
            promise.resolve(nil)
        }

        Function("isLiveActivityRunning") {
            return self.activityId != nil
        }
    }
}
