import AppKit
import Foundation
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
        panel.contentView = NSHostingView(rootView: WidgetTreeView(tree: loadTree()))
        panel.placeOnPrimaryDisplay(using: policy)
        panel.orderFrontRegardless()
        self.panel = panel
    }

    private func loadTree() -> WidgetTree {
        guard
            let workspace = workspaceArgument(),
            let data = try? Data(contentsOf: URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/tree.json")),
            let tree = try? JSONDecoder().decode(WidgetTree.self, from: data),
            tree.validationIssues().isEmpty
        else {
            return WidgetTree(
                kind: .column,
                children: [
                    WidgetTree(kind: .text, text: "Render"),
                    WidgetTree(kind: .text, text: "Native host online")
                ],
                style: WidgetStyle(width: 320, height: 180, color: "#1565c0")
            )
        }
        return tree
    }

    private func workspaceArgument() -> String? {
        guard let index = CommandLine.arguments.firstIndex(of: "--workspace") else { return nil }
        let next = CommandLine.arguments.index(after: index)
        return next < CommandLine.arguments.endIndex ? CommandLine.arguments[next] : nil
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
