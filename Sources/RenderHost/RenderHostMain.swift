import AppKit
import RenderHostCore
import SwiftUI

private final class RenderHostDelegate: NSObject, NSApplicationDelegate {
    private var panel: DesktopWidgetPanel?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let policy = DesktopWindowPolicy()
        let panel = DesktopWidgetPanel(
            contentRect: NSRect(x: 0, y: 0, width: 320, height: 180),
            policy: policy
        )
        panel.contentView = NSHostingView(rootView: PrototypeWidget())
        panel.placeOnPrimaryDisplay(using: policy)
        panel.orderFrontRegardless()
        self.panel = panel
    }
}

private struct PrototypeWidget: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.blue.opacity(0.92))
            VStack(alignment: .leading, spacing: 8) {
                Text("Render")
                    .font(.headline)
                Text("Native host online")
                    .font(.subheadline)
                    .opacity(0.85)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .frame(width: 320, height: 180)
    }
}

@main
struct RenderHostMain {
    static func main() {
        if CommandLine.arguments.contains("--self-check") {
            print("RenderHost native boundary is available")
            return
        }

        let application = NSApplication.shared
        application.setActivationPolicy(.accessory)
        application.delegate = RenderHostDelegate()
        application.run()
    }
}
