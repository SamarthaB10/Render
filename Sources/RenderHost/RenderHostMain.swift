import AppKit
import Foundation
import RenderHostCore
import SwiftUI

private final class RenderHostDelegate: NSObject, NSApplicationDelegate {
    private var panel: DesktopWidgetPanel?
    private var providers: ProviderStore?
    private var worker: WorkerSession?
    private var stateController: WidgetStateController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let policy = DesktopWindowPolicy()
        let workspace = workspaceArgument()
        let manifest = loadManifest(workspace: workspace)
        WidgetFontRegistrar.register(manifest.fonts, workspace: workspace, declaredAssets: Set(manifest.assets ?? []))
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
        let interactionCoordinator = WidgetInteractionCoordinator()
        let contentModel = WidgetContentModel(tree: loadTree(workspace: workspace))
        let stateController = workspace.map(WidgetStateController.init)
        self.stateController = stateController
        let panel = DesktopWidgetPanel(
            contentRect: NSRect(
                x: 0,
                y: 0,
                width: manifest.size.width,
                height: manifest.size.height
            ),
            policy: policy,
            resizable: manifest.resizable,
            windowShape: manifest.windowShape
        )
        let hostedView = DraggableHostingView(
            rootView: AnyView(
                WidgetTreeContainer(
                    model: contentModel,
                    providers: providers,
                    widgetName: manifest.name,
                    workspace: workspace,
                    designSize: CGSize(width: manifest.size.width, height: manifest.size.height),
                    windowShape: manifest.windowShape,
                    declaredAssets: manifest.assets.map(Set.init),
                    interactionCoordinator: interactionCoordinator,
                    onAction: actionDispatcher.dispatch,
                    onStateChange: { [weak stateController] key, value in
                        stateController?.set(key, value: value)
                    },
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
        hostedView.focusRingType = .none
        hostedView.onDrag = { [weak panel] origin in
            panel?.move(to: origin)
        }
        hostedView.shouldForwardMouseEvents = { [weak interactionCoordinator] in
            interactionCoordinator?.isPointerOverControl == true
        }
        hostedView.onDragEnded = { [weak self, weak panel] in
            guard let self, let panel else { return }
            self.savePlacement(workspace: workspace, origin: panel.frame.origin, panel: panel)
        }
        if manifest.resizable || manifest.windowShape == .circle {
            panel.contentView = ResizableWidgetContentView(
                hostedView: hostedView,
                panel: panel,
                interactionCoordinator: interactionCoordinator
            )
        } else {
            panel.contentView = hostedView
        }
        panel.normalizeWindowShape()
        var pendingWorker: WorkerSession?
        if let workspace {
            let worker = WorkerSession(
                workspace: workspace,
                workerScript: workerScriptArgument(),
                sourcePath: workerSourcePath(),
                statePath: workerStatePath(),
                treePath: workerTreePath(),
                widgetStatePath: stateController?.url.path
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
    let widgetName: String
    let workspace: String?
    let designSize: CGSize
    let windowShape: WidgetWindowShape
    let declaredAssets: Set<String>?
    let interactionCoordinator: WidgetInteractionCoordinator
    let onAction: (WidgetAction) -> Void
    let onStateChange: (String, WidgetJSONValue) -> Void
    let onAuthorize: () -> Void
    let onStop: () -> Void

    var body: some View {
        GeometryReader { proxy in
            let surfaceWidth = windowShape == .circle
                ? min(proxy.size.width, proxy.size.height)
                : proxy.size.width
            let surfaceHeight = windowShape == .circle
                ? min(proxy.size.width, proxy.size.height)
                : proxy.size.height

            ZStack(alignment: .topLeading) {
                WidgetTreeView(
                    tree: model.tree,
                    providers: providers,
                    workspace: workspace,
                    declaredAssets: declaredAssets,
                    interactionCoordinator: interactionCoordinator,
                    onAction: onAction,
                    onStateChange: onStateChange
                )
                .frame(width: max(designSize.width, 1), height: max(designSize.height, 1), alignment: .topLeading)
                .scaleEffect(
                    x: surfaceWidth / max(designSize.width, 1),
                    y: surfaceHeight / max(designSize.height, 1),
                    anchor: .topLeading
                )
                .frame(width: surfaceWidth, height: surfaceHeight, alignment: .topLeading)
                .clipped()

                WidgetSettingsOverlay(
                    widgetName: widgetName,
                    workspace: workspace,
                    windowShape: windowShape,
                    surfaceSize: CGSize(width: surfaceWidth, height: surfaceHeight),
                    accountStatus: providers.accountStatus(for: SpotifyConnector.connectorID),
                    authorizationMessage: providers.authorizationMessage,
                    onAuthorize: onAuthorize,
                    onStop: onStop
                )
                .frame(width: surfaceWidth, height: surfaceHeight, alignment: .topLeading)
            }
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
        }
    }
}

private struct RuntimeManifest: Decodable {
    let name: String
    let size: Size
    let anchor: Anchor
    let capabilities: [String]
    let subscribe: [String]
    let accounts: [WidgetAccountRequirement]
    let assets: [String]?
    let fonts: [WidgetFontDeclaration]
    let resizable: Bool
    let windowShape: WidgetWindowShape

    init(name: String, size: Size, anchor: Anchor, capabilities: [String], subscribe: [String], accounts: [WidgetAccountRequirement], assets: [String]? = nil, fonts: [WidgetFontDeclaration] = [], resizable: Bool = true, windowShape: WidgetWindowShape = .rectangle) {
        self.name = name
        self.size = size
        self.anchor = anchor
        self.capabilities = capabilities
        self.subscribe = subscribe
        self.accounts = accounts
        self.assets = assets
        self.fonts = fonts
        self.resizable = resizable
        self.windowShape = windowShape
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "Render Widget"
        size = try container.decode(Size.self, forKey: .size)
        anchor = try container.decode(Anchor.self, forKey: .anchor)
        capabilities = try container.decode([String].self, forKey: .capabilities)
        subscribe = try container.decode([String].self, forKey: .subscribe)
        accounts = try container.decodeIfPresent([WidgetAccountRequirement].self, forKey: .accounts) ?? []
        assets = try container.decodeIfPresent([String].self, forKey: .assets)
        fonts = try container.decodeIfPresent([WidgetFontDeclaration].self, forKey: .fonts) ?? []
        resizable = try container.decodeIfPresent(Bool.self, forKey: .resizable) ?? true
        windowShape = try container.decodeIfPresent(WidgetWindowShape.self, forKey: .windowShape) ?? .rectangle
    }

    private enum CodingKeys: String, CodingKey {
        case size
        case name
        case anchor
        case capabilities
        case subscribe
        case accounts
        case assets
        case fonts
        case resizable
        case windowShape
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

    static let fallback = RuntimeManifest(
        name: "Render Widget",
        size: Size(width: 320, height: 180),
        anchor: Anchor(corner: .topLeft, offset: Offset(x: 24, y: 24)),
        capabilities: [],
        subscribe: [],
        accounts: [],
        assets: nil
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
