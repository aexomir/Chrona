import SwiftUI
import WatchConnectivity
import WatchKit

// MARK: - Models

struct WatchProject: Identifiable, Decodable {
    let id: String
    let name: String
    let color: String
    let icon: String
}

struct WatchSessionItem: Identifiable, Decodable {
    let id: String
    let title: String
    let projectName: String
    let projectColor: String
    let startTime: String
    let duration: Int
}

// MARK: - Extensions

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard hex.count == 6, let value = UInt64(hex, radix: 16) else {
            self = .accentColor; return
        }
        self.init(
            red:   Double((value >> 16) & 0xFF) / 255,
            green: Double((value >>  8) & 0xFF) / 255,
            blue:  Double( value        & 0xFF) / 255
        )
    }
}

extension View {
    func glassCard(tint: Color = .clear) -> some View {
        self
            .background(Color.white.opacity(0.08))
            .background(tint.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.white.opacity(0.14), lineWidth: 0.5))
    }

    func glassButton(fill: Color = Color.white.opacity(0.12)) -> some View {
        self
            .background(fill)
            .clipShape(RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(Color.white.opacity(0.18), lineWidth: 0.5))
    }
}

// MARK: - State

final class WatchSession: NSObject, WCSessionDelegate, ObservableObject {
    @Published var isTracking = false
    @Published var sessionTitle = ""
    @Published var projectName = ""
    @Published var projectColor = ""
    @Published var startTimestamp: Date? = nil
    @Published var todayMinutes: Int = 0
    @Published var todaySessions: Int = 0
    @Published var recentProjects: [WatchProject] = []
    @Published var sessionItems: [WatchSessionItem] = []

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        let ctx = WCSession.default.receivedApplicationContext
        if !ctx.isEmpty { DispatchQueue.main.async { self.applyMessage(ctx) } }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.applyMessage(message) }
    }

    func session(_ session: WCSession, didReceiveApplicationContext ctx: [String: Any]) {
        DispatchQueue.main.async { self.applyMessage(ctx) }
    }

    func parseISO(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    private func applyMessage(_ msg: [String: Any]) {
        if let s = msg["startTimestamp"] as? String {
            startTimestamp = s.isEmpty ? nil : parseISO(s)
        }
        if let v = msg["title"]          as? String { sessionTitle = v }
        if let v = msg["projectName"]    as? String { projectName = v }
        if let v = msg["projectColor"]   as? String { projectColor = v }
        if let v = msg["todayMinutes"]   as? Int    { todayMinutes = v }
        if let v = msg["todaySessions"]  as? Int    { todaySessions = v }
        if let json = msg["recentProjects"] as? String,
           let data = json.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([WatchProject].self, from: data) {
            recentProjects = decoded
        }
        if let json = msg["recentSessions"] as? String,
           let data = json.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([WatchSessionItem].self, from: data) {
            sessionItems = decoded
        }
        if let v = msg["isTracking"] as? Bool { isTracking = v }
    }

    func sendAction(_ action: String, projectId: String? = nil, projectName: String? = nil, title: String? = nil) {
        var payload: [String: Any] = ["action": action]
        if let v = projectId   { payload["projectId"]   = v }
        if let v = projectName { payload["projectName"] = v }
        if let v = title       { payload["title"]       = v }
        WKInterfaceDevice.current().play(.success)
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
    }
}

// MARK: - Formatters

private func elapsed(from start: Date?, to now: Date) -> Int {
    guard let start else { return 0 }
    return max(0, Int(now.timeIntervalSince(start)))
}

private func formatElapsed(_ seconds: Int) -> String {
    let h = seconds / 3600, m = (seconds % 3600) / 60, s = seconds % 60
    return h > 0
        ? String(format: "%d:%02d:%02d", h, m, s)
        : String(format: "%02d:%02d", m, s)
}

private func formatTotal(_ minutes: Int) -> String {
    guard minutes >= 60 else { return "\(minutes)m" }
    let rem = minutes % 60
    return rem > 0 ? "\(minutes / 60)h \(rem)m" : "\(minutes / 60)h"
}

private func formatDuration(_ seconds: Int) -> String {
    let m = seconds / 60
    guard m >= 60 else { return "\(m)m" }
    let rem = m % 60
    return rem > 0 ? "\(m / 60)h \(rem)m" : "\(m / 60)h"
}

private func formatStartTime(_ isoString: String, parseISO: (String) -> Date?) -> String {
    guard let date = parseISO(isoString) else { return "" }
    let f = DateFormatter()
    f.dateFormat = "h:mm"
    return f.string(from: date)
}

// MARK: - Tracking Body (owns title-edit state)

private struct TrackingBody: View {
    @ObservedObject var session: WatchSession
    let accent: Color

    @State private var isEditingTitle = false
    @State private var draftTitle = ""
    @FocusState private var titleFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Circle()
                    .fill(accent)
                    .frame(width: 7, height: 7)
                    .shadow(color: accent.opacity(0.6), radius: 4)
                Text(session.projectName.isEmpty ? "Focus" : session.projectName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .padding(.bottom, 3)

            Button {
                draftTitle = session.sessionTitle
                isEditingTitle = true
            } label: {
                HStack(spacing: 4) {
                    Text(session.sessionTitle.isEmpty ? "Add title…" : session.sessionTitle)
                        .font(.system(size: 11))
                        .foregroundStyle(session.sessionTitle.isEmpty ? .white.opacity(0.25) : .white.opacity(0.55))
                        .lineLimit(1)
                    Image(systemName: "pencil")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.white.opacity(0.2))
                }
            }
            .buttonStyle(.plain)
            .padding(.bottom, 6)

            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                Text(formatElapsed(elapsed(from: session.startTimestamp, to: ctx.date)))
                    .font(.system(.title, design: .monospaced, weight: .semibold))
                    .foregroundStyle(accent)
                    .shadow(color: accent.opacity(0.35), radius: 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.bottom, 4)

            Text("\(formatTotal(session.todayMinutes)) · \(session.todaySessions) sess")
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.35))

            Spacer(minLength: 6)

            Button { session.sendAction("stop") } label: {
                Text("Stop")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .glassButton(fill: Color.red.opacity(0.55))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 6)
        .sheet(isPresented: $isEditingTitle) {
            VStack(spacing: 10) {
                Text("Session Title")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.4))

                TextField("What are you working on?", text: $draftTitle)
                    .font(.system(size: 14))
                    .multilineTextAlignment(.center)
                    .focused($titleFocused)

                Button {
                    session.sendAction("updateTitle", title: draftTitle)
                    isEditingTitle = false
                } label: {
                    Text("Done")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .glassButton(fill: accent.opacity(0.35))
                }
                .buttonStyle(.plain)
            }
            .padding()
            .onAppear { titleFocused = true }
        }
    }
}

// MARK: - Main View (Idle / Tracking)

struct MainView: View {
    @ObservedObject var session: WatchSession

    private var accent: Color {
        session.projectColor.isEmpty ? .accentColor : Color(hex: session.projectColor)
    }

    var body: some View {
        if session.isTracking {
            trackingBody
        } else {
            idleBody
        }
    }

    private var idleBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Focus")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.4))
                .padding(.bottom, 10)

            VStack(alignment: .leading, spacing: 2) {
                Text(formatTotal(session.todayMinutes))
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(session.todaySessions) \(session.todaySessions == 1 ? "session" : "sessions") today")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.45))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .glassCard()

            Spacer(minLength: 8)

            Button { session.sendAction("start") } label: {
                Text("Start")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .glassButton()
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 6)
    }

    private var trackingBody: some View {
        TrackingBody(session: session, accent: accent)
    }
}

// MARK: - Timeline View

struct TodayView: View {
    @ObservedObject var session: WatchSession

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                HStack {
                    Text("Today")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.4))
                    Spacer()
                    Text(formatTotal(session.todayMinutes))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.3))
                }
                .padding(.bottom, 8)

                if session.sessionItems.isEmpty {
                    VStack(spacing: 6) {
                        Image(systemName: "clock")
                            .font(.system(size: 22, weight: .thin))
                            .foregroundStyle(.white.opacity(0.2))
                        Text("No sessions yet")
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.25))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                } else {
                    VStack(spacing: 6) {
                        ForEach(session.sessionItems) { item in
                            sessionCard(item)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.top, 4)
            .padding(.bottom, 8)
        }
    }

    private func sessionCard(_ item: WatchSessionItem) -> some View {
        let accent = item.projectColor.isEmpty ? Color.accentColor : Color(hex: item.projectColor)
        return HStack(alignment: .center, spacing: 0) {
            RoundedRectangle(cornerRadius: 2)
                .fill(accent)
                .frame(width: 3)
                .padding(.trailing, 9)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title.isEmpty ? item.projectName : item.title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    if !item.projectName.isEmpty && !item.title.isEmpty {
                        Text(item.projectName)
                            .font(.system(size: 10))
                            .foregroundStyle(accent.opacity(0.8))
                    }
                    Text(formatStartTime(item.startTime, parseISO: session.parseISO))
                        .font(.system(size: 10))
                        .foregroundStyle(.white.opacity(0.3))
                }
            }

            Spacer()

            Text(formatDuration(item.duration))
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.55))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .glassCard(tint: accent)
    }
}

// MARK: - Projects View

struct ProjectsView: View {
    @ObservedObject var session: WatchSession

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Text("Quick Start")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.4))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 8)

                VStack(spacing: 6) {
                    ForEach(session.recentProjects) { project in
                        Button {
                            session.sendAction("startWithProject", projectId: project.id, projectName: project.name)
                        } label: {
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(Color(hex: project.color))
                                    .frame(width: 8, height: 8)
                                    .shadow(color: Color(hex: project.color).opacity(0.5), radius: 3)
                                Text(project.name)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                Spacer()
                                Image(systemName: "play.fill")
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.3))
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 9)
                            .glassCard(tint: Color(hex: project.color))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.top, 4)
            .padding(.bottom, 8)
        }
    }
}

// MARK: - Root

struct ContentView: View {
    @StateObject private var session = WatchSession()
    @State private var selectedPage = 0

    var body: some View {
        TabView(selection: $selectedPage) {
            MainView(session: session)
                .tag(0)

            TodayView(session: session)
                .tag(1)

            if !session.isTracking {
                ProjectsView(session: session)
                    .tag(2)
            }
        }
        .tabViewStyle(.page)
        .onChange(of: session.isTracking) { _, nowTracking in
            if nowTracking { selectedPage = 0 }
        }
    }
}
