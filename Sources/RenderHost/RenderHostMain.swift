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
        let manifest = loadManifest(workspace: workspace)
        let providers = ProviderStore(subscriptions: Set(manifest.subscribe))
        providers.start()
        let panel = DesktopWidgetPanel(
            contentRect: NSRect(
                x: 0,
                y: 0,
                width: manifest.size.width,
                height: manifest.size.height
            ),
            policy: policy
        )
        let contentView = DraggableHostingView(
            rootView: AnyView(
                WidgetTreeView(tree: loadTree(workspace: workspace), providers: providers)
            )
        )
        contentView.onDrag = { [weak panel] origin in
            panel?.move(to: origin)
        }
        contentView.onDragEnded = { [weak self, weak panel] in
            guard let self, let panel else { return }
            self.savePlacement(workspace: workspace, origin: panel.frame.origin, panel: panel)
        }
        panel.contentView = contentView
        if let placement = loadPlacement(workspace: workspace),
           let screen = screen(for: placement, panel: panel) {
            panel.place(placement, on: screen)
        } else {
            panel.placeOnPrimaryDisplay(
                using: policy,
                anchor: manifest.anchor.corner,
                offsetX: manifest.anchor.offset.x,
                offsetY: manifest.anchor.offset.y
            )
        }
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

    private func loadManifest(workspace: String?) -> RuntimeManifest {
        guard
            let workspace,
            let data = try? Data(contentsOf: URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/manifest.json")),
            let manifest = try? JSONDecoder().decode(RuntimeManifest.self, from: data)
        else {
            return .fallback
        }
        return manifest
    }

    private func loadPlacement(workspace: String?) -> WidgetPlacement? {
        guard
            let workspace,
            let data = try? Data(contentsOf: placementURL(workspace: workspace))
        else {
            return nil
        }
        return try? JSONDecoder().decode(WidgetPlacement.self, from: data)
    }

    private func savePlacement(workspace: String?, origin: NSPoint, panel: DesktopWidgetPanel) {
        guard
            let workspace,
            let screen = panel.screen(containing: origin),
            let screenID = panel.displayID(for: screen)
        else {
            return
        }

        let placement = WidgetPlacement(
            screenID: screenID,
            originX: origin.x,
            originY: origin.y
        )
        guard let data = try? JSONEncoder().encode(placement) else { return }
        try? data.write(to: placementURL(workspace: workspace), options: .atomic)
    }

    private func screen(for placement: WidgetPlacement, panel: DesktopWidgetPanel) -> NSScreen? {
        if let screenID = placement.screenID,
           let screen = NSScreen.screens.first(where: { panel.displayID(for: $0) == screenID }) {
            return screen
        }
        return panel.screen(containing: NSPoint(x: placement.originX, y: placement.originY))
            ?? NSScreen.screens.first
    }

    private func placementURL(workspace: String) -> URL {
        URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/placement.json")
    }

    private func workspaceArgument() -> String? {
        guard let index = CommandLine.arguments.firstIndex(of: "--workspace") else { return nil }
        let next = CommandLine.arguments.index(after: index)
        return next < CommandLine.arguments.endIndex ? CommandLine.arguments[next] : nil
    }
}

private struct RuntimeManifest: Decodable {
    let size: Size
    let anchor: Anchor
    let subscribe: [String]

    struct Size: Decodable {
        let width: Double
        let height: Double
    }

    struct Anchor: Decodable {
        let corner: WidgetAnchor
        let offset: Offset
    }

    struct Offset: Decodable {
        let x: Double
        let y: Double
    }

    static let fallback = RuntimeManifest(
        size: Size(width: 320, height: 180),
        anchor: Anchor(corner: .topLeft, offset: Offset(x: 24, y: 24)),
        subscribe: []
    )
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
        if CommandLine.arguments.contains("--performance-self-check") {
            let result = [
                "frameCadence": FrameCadenceProbe().measure()
            ]
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
