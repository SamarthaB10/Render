import AppKit
import Foundation
import RenderHostCore
import SwiftUI

private final class RenderHostDelegate: NSObject, NSApplicationDelegate {
    private var panel: DesktopWidgetPanel?
    private var session: WidgetHostSession?
    private var resizeObserver: NSObjectProtocol?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let policy = DesktopWindowPolicy()
        let workspace = workspaceArgument()
        let hostSession = WidgetHostSession(
            workspace: workspace,
            workerScript: workerScriptArgument(),
            sourcePath: workerSourcePath(),
            statePath: workerStatePath(),
            treePath: workerTreePath()
        )
        let manifest = hostSession.manifest
        let preferences = hostSession.preferences.value
        let preferencesModel = hostSession.preferences
        let providers = hostSession.providers
        providers.start()
        let actionDispatcher = hostSession.actionDispatcher
        let contentModel = hostSession.contentModel
        let interactionStore = hostSession.interactionStore
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
        let hostedContentView = DraggableHostingView(
            rootView: AnyView(
                WidgetTreeContainer(
                    model: contentModel,
                    providers: providers,
                    interactionStore: interactionStore,
                    widgetName: manifest.name,
                    workspace: workspace,
                    themeConfig: manifest.theme ?? RuntimeManifest.Theme(
                        defaultTheme: RenderThemeName.darkGlass.rawValue,
                        options: RenderThemeName.allCases.map(\.rawValue)
                    ),
                    workerStatePath: hostSession.workerStatePath,
                    adjustable: manifest.adjustable,
                    defaultSize: manifest.size,
                    preferences: preferencesModel,
                    onPreferencesChange: { [weak panel] next in
                        preferencesModel.value = next
                        hostSession.savePreferences(next)
                        panel?.apply(preferences: next, adjustable: manifest.adjustable)
                    },
                    onModeChange: { [weak panel] mode in
                        var next = preferencesModel.value
                        next.mode = mode
                        if mode != "auto",
                           let bounds = manifest.adjustable?.responsive?.modes[mode] {
                            let size = hostSession.initialSize(panel: panel)
                            next.width = max(size.width, bounds.minWidth)
                            next.height = max(size.height, bounds.minHeight)
                        }
                        preferencesModel.value = next
                        hostSession.savePreferences(next)
                        panel?.apply(preferences: next, adjustable: manifest.adjustable)
                        let size = hostSession.initialSize(panel: panel)
                        hostSession.render(
                            mode: hostSession.effectiveMode(size: size),
                            size: size
                        ) { result in
                            if case .failure(let error) = result {
                                NSLog("Render mode change failed: %@", error.localizedDescription)
                            }
                        }
                    },
                    onAction: actionDispatcher.dispatch,
                    onAuthorize: {
                        guard let requirement = manifest.accounts.first else { return }
                        providers.setAuthorizationMessage("Opening \(requirement.connector) permissions…")
                        Task {
                            do {
                                try await providers.authorize(connector: requirement.connector, scopes: requirement.scopes)
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
                    onStop: {
                        hostSession.markIntentionalStop()
                        NSApp.terminate(nil)
                    }
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
                hostSession.savePreferences(next)
                hostSession.render(
                    mode: hostSession.effectiveMode(size: contentSize),
                    size: contentSize
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
        hostedContentView.onDragEnded = { [weak panel] in
            guard let panel, !preferencesModel.value.locked else { return }
            hostSession.savePlacement(origin: panel.frame.origin, panel: panel)
        }
        let contentView = AdjustableWidgetContentView(
            hostedView: hostedContentView,
            panel: panel
        )
        panel.contentView = contentView
        if let placement = hostSession.loadPlacement(),
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
        self.session = hostSession
        hostSession.startWorker()
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let resizeObserver { NotificationCenter.default.removeObserver(resizeObserver) }
        session?.stop()
    }

    private func screen(for placement: WidgetPlacement, panel: DesktopWidgetPanel) -> NSScreen? {
        if let screenID = placement.screenID,
           let screen = NSScreen.screens.first(where: { panel.displayID(for: $0) == screenID }) {
            return screen
        }
        return panel.screen(containing: NSPoint(x: placement.originX, y: placement.originY))
            ?? NSScreen.screens.first
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
    let themeConfig: RuntimeManifest.Theme?
    let workerStatePath: String?
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
            WidgetTreeView(tree: model.tree, providers: providers, interactionStore: interactionStore, theme: RenderTheme(name: selectedTheme), nodePath: "root", fillsAvailableSpace: true, onAction: onAction)
            WidgetSettingsOverlay(
                widgetName: widgetName,
                workspace: workspace,
                themeConfig: themeConfig,
                theme: RenderTheme(name: selectedTheme),
                workerStatePath: workerStatePath,
                adjustable: adjustable,
                defaultSize: defaultSize,
                preferences: preferences.value,
                onPreferencesChange: onPreferencesChange,
                onModeChange: onModeChange,
                youtube: youtubeSettings,
                interactionStore: interactionStore,
                accountStatus: providers.accountConnector.flatMap { providers.accountStatus(for: $0) },
                authorizationMessage: providers.authorizationMessage,
                onAuthorize: onAuthorize,
                onStop: onStop
            )
        }
    }

    private var selectedTheme: String {
        let fallback = themeConfig?.defaultTheme ?? RenderThemeName.darkGlass.rawValue
        let selected = preferences.value.theme ?? fallback
        guard let themeConfig else { return selected }
        return themeConfig.options.contains(selected) ? selected : fallback
    }

    private var youtubeSettings: YouTubePlayerSettings? {
        findYouTubeSettings(in: model.tree, path: "root")
    }

    private func findYouTubeSettings(in tree: WidgetTree, path: String) -> YouTubePlayerSettings? {
        if tree.kind == .youtubePlayer {
            return YouTubePlayerSettings(
                path: path,
                initialVideoID: tree.videoId,
                allowLinkInput: tree.allowLinkInput == true
            )
        }
        for (index, child) in tree.children.enumerated() {
            if let settings = findYouTubeSettings(in: child, path: "\(path).children[\(index)]") {
                return settings
            }
        }
        return nil
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
    let theme: Theme?

    init(name: String, size: Size, anchor: Anchor, capabilities: [String], subscribe: [String], accounts: [WidgetAccountRequirement], adjustable: Adjustable? = nil, theme: Theme? = nil) {
        self.name = name
        self.size = size
        self.anchor = anchor
        self.capabilities = capabilities
        self.subscribe = subscribe
        self.accounts = accounts
        self.adjustable = adjustable
        self.theme = theme
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
        theme = try container.decodeIfPresent(Theme.self, forKey: .theme)
    }

    private enum CodingKeys: String, CodingKey {
        case size
        case name
        case anchor
        case capabilities
        case subscribe
        case accounts
        case adjustable
        case theme
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

    struct Theme: Decodable {
        let defaultTheme: String
        let options: [String]

        init(defaultTheme: String, options: [String]) {
            self.defaultTheme = defaultTheme
            self.options = options
        }

        private enum CodingKeys: String, CodingKey { case defaultTheme = "default", options }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            defaultTheme = try container.decode(String.self, forKey: .defaultTheme)
            options = try container.decodeIfPresent([String].self, forKey: .options) ?? [defaultTheme]
        }
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
