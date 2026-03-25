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
    private var activityId: String?

    public func definition() -> ModuleDefinition {
        Name("ActivityController")

        AsyncFunction("startActivity") { (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(["activityId": ""])
                return
            }

            if let existingId = self.activityId {
                for activity in Activity<ChronaActivityAttributes>.activities
                where activity.id == existingId {
                    Task { await activity.end(dismissalPolicy: .immediate) }
                }
                self.activityId = nil
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
                self.activityId = activity.id
                promise.resolve(["activityId": activity.id])
            } catch {
                promise.reject(Exception(name: "StartActivityError", description: error.localizedDescription))
            }
        }

        AsyncFunction("updateActivity") { (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil)
                return
            }

            guard let existingId = self.activityId else {
                promise.resolve(nil)
                return
            }

            for activity in Activity<ChronaActivityAttributes>.activities
            where activity.id == existingId {
                let updated = ChronaActivityAttributes.ContentState(
                    startDate: activity.content.state.startDate,
                    title: params["title"] as? String ?? activity.content.state.title,
                    projectName: params["projectName"] as? String ?? activity.content.state.projectName,
                    projectIcon: params["projectIcon"] as? String ?? activity.content.state.projectIcon,
                    projectColor: params["projectColor"] as? String ?? activity.content.state.projectColor
                )
                Task { await activity.update(.init(state: updated, staleDate: nil)) }
            }
            promise.resolve(nil)
        }

        AsyncFunction("endActivity") { (promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil)
                return
            }

            if let existingId = self.activityId {
                for activity in Activity<ChronaActivityAttributes>.activities
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
