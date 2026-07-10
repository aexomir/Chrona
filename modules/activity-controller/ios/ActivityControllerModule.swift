import ExpoModulesCore
import ActivityKit

struct ChronaActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startDate: Date
        var title: String
        var projectName: String
        var projectIcon: String
        var projectColor: String
    }
}

public class ActivityControllerModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ActivityController")

        AsyncFunction("startActivity") { (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(["activityId": ""])
                return
            }

            Task {
                // End ALL existing Chrona activities before starting a new one.
                // Handles orphaned activities from prior app sessions (crash / kill).
                for activity in Activity<ChronaActivityAttributes>.activities {
                    await activity.end(dismissalPolicy: .immediate)
                }

                let isoFractional: ISO8601DateFormatter = {
                    let f = ISO8601DateFormatter()
                    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    return f
                }()
                let tsStr = params["startTimestamp"] as? String ?? ""
                let startDate = isoFractional.date(from: tsStr)
                    ?? ISO8601DateFormatter().date(from: tsStr)
                    ?? Date()

                let state = ChronaActivityAttributes.ContentState(
                    startDate: startDate,
                    title: params["title"] as? String ?? "",
                    projectName: params["projectName"] as? String ?? "",
                    projectIcon: params["projectIcon"] as? String ?? "",
                    projectColor: params["projectColor"] as? String ?? ""
                )

                do {
                    let activity = try Activity.request(
                        attributes: ChronaActivityAttributes(),
                        content: .init(state: state, staleDate: nil),
                        pushType: nil
                    )
                    promise.resolve(["activityId": activity.id])
                } catch {
                    promise.reject(Exception(name: "StartActivityError", description: error.localizedDescription))
                }
            }
        }

        AsyncFunction("updateActivity") { (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil)
                return
            }

            Task {
                guard let activity = Activity<ChronaActivityAttributes>.activities.first else {
                    promise.resolve(nil)
                    return
                }

                let current = activity.content.state
                let updated = ChronaActivityAttributes.ContentState(
                    startDate: current.startDate,
                    title: params["title"] as? String ?? current.title,
                    projectName: params["projectName"] as? String ?? current.projectName,
                    projectIcon: params["projectIcon"] as? String ?? current.projectIcon,
                    projectColor: params["projectColor"] as? String ?? current.projectColor
                )
                await activity.update(.init(state: updated, staleDate: nil))
                promise.resolve(nil)
            }
        }

        AsyncFunction("endActivity") { (promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil)
                return
            }

            Task {
                // End ALL activities regardless of any stored ID.
                for activity in Activity<ChronaActivityAttributes>.activities {
                    await activity.end(dismissalPolicy: .immediate)
                }
                promise.resolve(nil)
            }
        }

        Function("isLiveActivityRunning") { () -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            return !Activity<ChronaActivityAttributes>.activities.isEmpty
        }
    }
}
