import AppKit
import Foundation
import RenderHostCore
import SwiftUI

private final class RenderHostDelegate: NSObject, NSApplicationDelegate {
    private var panel: DesktopWidgetPanel?
    private var providers: ProviderStore?
    private var worker: WorkerSession?
    private var resizeObserver: NSObjectProtocol?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let policy = DesktopWindowPolicy()
        let workspace = workspaceArgument()
        let manifest = loadManifest(workspace: workspace)
        let preferences = loadPreferences(workspace: workspace, manifest: manifest)
        let preferencesModel = WidgetPreferencesModel(preferences)
        let spotify = SpotifyConnector()
        let providers = ProviderStore(
            subscriptions: Set(manifest.subscribe),
            accountRequirements: manifest.accounts,
            spotify: spotify
        )
        providers.start()
        let actionDispatcher = WidgetActionDispatcher(
            capabilities: manifest.capabilities,
            spotify: spotify,
            hasSpotifyAccount: manifest.accounts.contains(where: { $0.connector == SpotifyConnector.connectorID })
        )
        let contentModel = WidgetContentModel(tree: loadTree(workspace: workspace))
        let interactionStore = WidgetInteractionStore(workspace: workspace)
        let panel = DesktopWidgetPanel(
            contentRect: NSRect(
                x: 0,
                y: 0,
                width: manifest.size.width,
                height: manifest.size.height
            ),
            policy: policy,
            adjustable: manifest.adjustable,
            preferences: preferences
        )
        let initialSize = renderSize(preferences: preferences, panel: panel, manifest: manifest)
        let hostedContentView = DraggableHostingView(
            rootView: AnyView(
                WidgetTreeContainer(
                    model: contentModel,
                    providers: providers,
                    interactionStore: interactionStore,
                    widgetName: manifest.name,
                    workspace: workspace,
                    adjustable: manifest.adjustable,
                    defaultSize: manifest.size,
                    preferences: preferencesModel,
                    onPreferencesChange: { [weak panel] next in
                        preferencesModel.value = next
                        self.savePreferences(next, workspace: workspace)
                        panel?.apply(preferences: next, adjustable: manifest.adjustable)
                    },
                    onModeChange: { [weak self, weak panel] mode in
                        guard let self else { return }
                        var next = preferencesModel.value
                        next.mode = mode
                        if mode != "auto",
                           let bounds = manifest.adjustable?.responsive?.modes[mode] {
                            let size = renderSize(preferences: next, panel: panel, manifest: manifest)
                            next.width = max(size.width, bounds.minWidth)
                            next.height = max(size.height, bounds.minHeight)
                        }
                        preferencesModel.value = next
                        savePreferences(next, workspace: workspace)
                        panel?.apply(preferences: next, adjustable: manifest.adjustable)
                        let size = renderSize(preferences: next, panel: panel, manifest: manifest)
                        self.worker?.render(
                            mode: effectiveMode(preferences: next, manifest: manifest, size: size),
                            size: WorkerRenderSize(width: size.width, height: size.height)
                        ) { result in
                            if case .failure(let error) = result {
                                NSLog("Render mode change failed: %@", error.localizedDescription)
                            }
                        }
                    },
                    onAction: actionDispatcher.dispatch,
                    onAuthorize: {
                        guard let requirement = manifest.accounts.first(where: { $0.connector == SpotifyConnector.connectorID }) else { return }
                        providers.setAuthorizationMessage("Opening Spotify authorization…")
                        Task {
                            do {
                                _ = try await spotify.authorize(scopes: requirement.scopes)
                                await MainActor.run {
                                    providers.setAuthorizationMessage(nil)
                                    providers.refreshNow()
                                }
                            } catch {
                                await MainActor.run {
                                    providers.setAuthorizationMessage(error.localizedDescription)
                                    providers.refreshNow()
                                }
                            }
                        }
                    },
                    onStop: { NSApp.terminate(nil) }
                )
            )
        )
        if manifest.adjustable?.enabled == true {
            resizeObserver = NotificationCenter.default.addObserver(
                forName: NSWindow.didResizeNotification,
                object: panel,
                queue: .main
            ) { [weak panel] _ in
                guard let panel else { return }
                panel.clampToVisibleDisplay()
                var next = preferencesModel.value
                let contentSize = panel.contentRect(forFrameRect: panel.frame).size
                next.width = contentSize.width
                next.height = contentSize.height
                preferencesModel.value = next
                self.savePreferences(next, workspace: workspace)
                self.worker?.render(
                    mode: self.effectiveMode(preferences: next, manifest: manifest, size: contentSize),
                    size: WorkerRenderSize(width: contentSize.width, height: contentSize.height)
                ) { result in
                    if case .failure(let error) = result {
                        NSLog("Render resize failed: %@", error.localizedDescription)
                    }
                }
            }
        }
        hostedContentView.onDrag = { [weak panel] origin in
            guard !preferencesModel.value.locked else { return }
            panel?.move(to: origin)
        }
        hostedContentView.onDragEnded = { [weak self, weak panel] in
            guard let self, let panel, !preferencesModel.value.locked else { return }
            self.savePlacement(workspace: workspace, origin: panel.frame.origin, panel: panel)
        }
        let contentView = AdjustableWidgetContentView(
            hostedView: hostedContentView,
            panel: panel
        )
        panel.contentView = contentView
        var pendingWorker: WorkerSession?
        if let workspace {
            let worker = WorkerSession(
                workspace: workspace,
                workerScript: workerScriptArgument(),
                sourcePath: workerSourcePath(),
                statePath: workerStatePath(),
                treePath: workerTreePath(),
                mode: effectiveMode(preferences: preferences, manifest: manifest, size: initialSize),
                size: WorkerRenderSize(width: initialSize.width, height: initialSize.height)
            )
            worker.onTree = { [weak contentModel] tree in
                DispatchQueue.main.async {
                    contentModel?.tree = tree
                }
            }
            worker.onFailure = { diagnostics in
                NSLog("Render worker failure: %@", diagnostics.map(\.message).joined(separator: "; "))
            }
            pendingWorker = worker
            self.worker = worker
        }
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

        if let pendingWorker {
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let tree = try pendingWorker.start()
                    DispatchQueue.main.async {
                        contentModel.tree = tree
                    }
                } catch {
                    pendingWorker.recordInitialFailure(error)
                    NSLog("Render worker failed to start: %@", error.localizedDescription)
                }
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let resizeObserver { NotificationCenter.default.removeObserver(resizeObserver) }
        worker?.stop()
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

    private func loadPreferences(workspace: String?, manifest: RuntimeManifest) -> WidgetPreferences {
        let fallback = WidgetPreferences.defaults
        guard let workspace,
              let data = try? Data(contentsOf: preferencesURL(workspace: workspace)),
              let preferences = try? JSONDecoder().decode(WidgetPreferences.self, from: data)
        else { return fallback }
        guard let responsive = manifest.adjustable?.responsive,
              preferences.mode != "auto",
              responsive.modes[preferences.mode] == nil
        else { return preferences }
        var recovered = preferences
        recovered.mode = "auto"
        return recovered
    }

    private func savePreferences(_ preferences: WidgetPreferences, workspace: String?) {
        guard let workspace, let data = try? JSONEncoder().encode(preferences) else { return }
        try? data.write(to: preferencesURL(workspace: workspace), options: .atomic)
    }

    private func renderSize(preferences: WidgetPreferences, panel: DesktopWidgetPanel?, manifest: RuntimeManifest) -> NSSize {
        if let panel {
            return panel.contentRect(forFrameRect: panel.frame).size
        }
        return NSSize(
            width: preferences.width ?? manifest.size.width,
            height: preferences.height ?? manifest.size.height
        )
    }

    private func effectiveMode(preferences: WidgetPreferences, manifest: RuntimeManifest, size: NSSize) -> String {
        guard preferences.mode == "auto", let responsive = manifest.adjustable?.responsive else {
            return preferences.mode
        }
        let fitting = responsive.modes
            .filter { size.width >= $0.value.minWidth && size.height >= $0.value.minHeight }
            .max { lhs, rhs in
                (lhs.value.minWidth + lhs.value.minHeight) < (rhs.value.minWidth + rhs.value.minHeight)
            }
        return fitting?.key ?? responsive.defaultMode
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

    private func preferencesURL(workspace: String) -> URL {
        URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/preferences.json")
    }

    private func workspaceArgument() -> String? {
        guard let index = CommandLine.arguments.firstIndex(of: "--workspace") else { return nil }
        let next = CommandLine.arguments.index(after: index)
        return next < CommandLine.arguments.endIndex ? CommandLine.arguments[next] : nil
    }

    private func workerScriptArgument() -> String {
        if let index = CommandLine.arguments.firstIndex(of: "--worker-script") {
            let next = CommandLine.arguments.index(after: index)
            if next < CommandLine.arguments.endIndex {
                return CommandLine.arguments[next]
            }
        }
        if let configured = ProcessInfo.processInfo.environment["RENDER_WORKER_SCRIPT"] {
            return configured
        }
        return URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("src/worker.mjs").path
    }

    private func workerSourcePath() -> String? {
        argumentValue(named: "--worker-source-path")
            ?? ProcessInfo.processInfo.environment["RENDER_WORKER_SOURCE_PATH"]
    }

    private func workerStatePath() -> String? {
        argumentValue(named: "--worker-state-path")
            ?? ProcessInfo.processInfo.environment["RENDER_WORKER_STATE_PATH"]
    }

    private func workerTreePath() -> String? {
        argumentValue(named: "--worker-tree-path")
            ?? ProcessInfo.processInfo.environment["RENDER_WORKER_TREE_PATH"]
    }

    private func argumentValue(named name: String) -> String? {
        guard let index = CommandLine.arguments.firstIndex(of: name) else { return nil }
        let next = CommandLine.arguments.index(after: index)
        return next < CommandLine.arguments.endIndex ? CommandLine.arguments[next] : nil
    }
}

private struct WidgetTreeContainer: View {
    @ObservedObject var model: WidgetContentModel
    @ObservedObject var providers: ProviderStore
    @ObservedObject var interactionStore: WidgetInteractionStore
    let widgetName: String
    let workspace: String?
    let adjustable: RuntimeManifest.Adjustable?
    let defaultSize: RuntimeManifest.Size
    @ObservedObject var preferences: WidgetPreferencesModel
    let onPreferencesChange: (WidgetPreferences) -> Void
    let onModeChange: (String) -> Void
    let onAction: (WidgetAction) -> Void
    let onAuthorize: () -> Void
    let onStop: () -> Void

    var body: some View {
        ZStack {
            WidgetTreeView(tree: model.tree, providers: providers, interactionStore: interactionStore, nodePath: "root", fillsAvailableSpace: true, onAction: onAction)
            WidgetSettingsOverlay(
                widgetName: widgetName,
                workspace: workspace,
                adjustable: adjustable,
                defaultSize: defaultSize,
                preferences: preferences.value,
                onPreferencesChange: onPreferencesChange,
                onModeChange: onModeChange,
                accountStatus: providers.accountStatus(for: SpotifyConnector.connectorID),
                authorizationMessage: providers.authorizationMessage,
                onAuthorize: onAuthorize,
                onStop: onStop
            )
        }
    }
}

struct RuntimeManifest: Decodable {
    let name: String
    let size: Size
    let anchor: Anchor
    let capabilities: [String]
    let subscribe: [String]
    let accounts: [WidgetAccountRequirement]
    let adjustable: Adjustable?

    init(name: String, size: Size, anchor: Anchor, capabilities: [String], subscribe: [String], accounts: [WidgetAccountRequirement], adjustable: Adjustable? = nil) {
        self.name = name
        self.size = size
        self.anchor = anchor
        self.capabilities = capabilities
        self.subscribe = subscribe
        self.accounts = accounts
        self.adjustable = adjustable
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "Render Widget"
        size = try container.decode(Size.self, forKey: .size)
        anchor = try container.decode(Anchor.self, forKey: .anchor)
        capabilities = try container.decode([String].self, forKey: .capabilities)
        subscribe = try container.decode([String].self, forKey: .subscribe)
        accounts = try container.decodeIfPresent([WidgetAccountRequirement].self, forKey: .accounts) ?? []
        adjustable = try container.decodeIfPresent(Adjustable.self, forKey: .adjustable)
    }

    private enum CodingKeys: String, CodingKey {
        case size
        case name
        case anchor
        case capabilities
        case subscribe
        case accounts
        case adjustable
    }

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

    struct Adjustable: Decodable {
        let enabled: Bool
        let minSize: Size?
        let maxSize: Size?
        let responsive: Responsive?
    }

    struct Responsive: Decodable {
        let modes: [String: Mode]
        let defaultMode: String

        private enum CodingKeys: String, CodingKey { case modes, defaultMode = "default" }
    }

    struct Mode: Decodable {
        let minWidth: Double
        let minHeight: Double
    }

    static let fallback = RuntimeManifest(
        name: "Render Widget",
        size: Size(width: 320, height: 180),
        anchor: Anchor(corner: .topLeft, offset: Offset(x: 24, y: 24)),
        capabilities: [],
        subscribe: [],
        accounts: []
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
            let subscriptions = Set(["system.cpu", "system.memory", "system.time"])
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
