import AppKit
import Foundation
import RenderHostCore
import SwiftUI

private final class RenderHostDelegate: NSObject, NSApplicationDelegate {
    private var panel: DesktopWidgetPanel?
    private var providers: ProviderStore?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let policy = DesktopWindowPolicy()
        let workspace = workspaceArgument()
        let providers = ProviderStore(subscriptions: loadSubscriptions(workspace: workspace))
        providers.start()
        let panel = DesktopWidgetPanel(
            contentRect: NSRect(x: 0, y: 0, width: 320, height: 180),
            policy: policy
        )
        panel.contentView = NSHostingView(
            rootView: WidgetTreeView(tree: loadTree(workspace: workspace), providers: providers)
        )
        panel.placeOnPrimaryDisplay(using: policy)
        panel.orderFrontRegardless()
        self.panel = panel
        self.providers = providers
    }

    private func loadTree(workspace: String?) -> WidgetTree {
        guard
            let workspace,
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

    private func loadSubscriptions(workspace: String?) -> Set<String> {
        guard
            let workspace,
            let data = try? Data(contentsOf: URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/manifest.json")),
            let manifest = try? JSONDecoder().decode(RuntimeManifest.self, from: data)
        else {
            return []
        }
        return Set(manifest.subscribe)
    }

    private func workspaceArgument() -> String? {
        guard let index = CommandLine.arguments.firstIndex(of: "--workspace") else { return nil }
        let next = CommandLine.arguments.index(after: index)
        return next < CommandLine.arguments.endIndex ? CommandLine.arguments[next] : nil
    }
}

private struct RuntimeManifest: Decodable {
    let subscribe: [String]
}

@main
struct RenderHostMain {
    static func main() {
        if CommandLine.arguments.contains("--self-check") {
            print("RenderHost native boundary is available")
            return
        }
        if CommandLine.arguments.contains("--provider-self-check") {
            var sampler = SystemMetricsSampler()
            let subscriptions = Set(["system.cpu", "system.memory"])
            let first = sampler.sample(subscriptions: subscriptions)
            Thread.sleep(forTimeInterval: 1.05)
            let second = sampler.sample(subscriptions: subscriptions)
            let result = ["first": first, "second": second]
            if let data = try? JSONEncoder().encode(result) {
                print(String(decoding: data, as: UTF8.self))
            }
            return
        }

        let application = NSApplication.shared
        application.setActivationPolicy(.accessory)
        let delegate = RenderHostDelegate()
        application.delegate = delegate
        application.run()
    }
}
