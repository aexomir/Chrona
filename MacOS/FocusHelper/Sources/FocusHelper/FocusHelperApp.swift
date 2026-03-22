import SwiftUI

@main
struct FocusHelperApp: App {
    @StateObject private var poller = ActivityPoller()

    var body: some Scene {
        MenuBarExtra {
            MenuBarView()
                .environmentObject(poller)
        } label: {
            // Icon reflects connection state
            Image(systemName: poller.isConnected ? "circle.fill" : "circle.dotted")
                .symbolRenderingMode(.monochrome)
        }
        .menuBarExtraStyle(.window)
    }
}
