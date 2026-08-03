import AppKit
import Foundation
import RenderHostCore

final class WidgetHostSession {
    let workspace: String?
    let manifest: RuntimeManifest
    let contentModel: WidgetContentModel
    let interactionStore: WidgetInteractionStore
    let providers: ProviderStore
    let actionDispatcher: WidgetActionDispatcher
    let preferences: WidgetPreferencesModel
    let workerStatePath: String?
    private(set) var worker: WorkerSession?

    init(
        workspace: String?,
        workerScript: String,
        sourcePath: String?,
        statePath: String?,
        treePath: String?
    ) {
        self.workspace = workspace
        self.manifest = Self.loadManifest(workspace: workspace)
        let initialPreferences = Self.loadPreferences(workspace: workspace, manifest: manifest)
        self.preferences = WidgetPreferencesModel(initialPreferences)
        self.contentModel = WidgetContentModel(tree: Self.loadTree(workspace: workspace))
        self.interactionStore = WidgetInteractionStore(workspace: workspace)
        self.workerStatePath = statePath

        let spotify = SpotifyConnector()
        let reminders = RemindersConnector()
        let providers = ProviderStore(
            subscriptions: Set(manifest.subscribe),
            accountRequirements: manifest.accounts,
            spotify: spotify,
            reminders: reminders
        )
        self.providers = providers
        self.actionDispatcher = WidgetActionDispatcher(
            capabilities: manifest.capabilities,
            spotify: spotify,
            reminders: reminders,
            hasSpotifyAccount: manifest.accounts.contains(where: { $0.connector == SpotifyConnector.connectorID }),
            hasRemindersAccount: manifest.accounts.contains(where: { $0.connector == RemindersConnector.connectorID && $0.scopes.contains("reminders.write") }),
            onRemindersMutation: providers.refreshNow
        )

        self.worker = nil
        if let workspace {
            let initialWorkerSize = NSSize(
                width: initialPreferences.width ?? manifest.size.width,
                height: initialPreferences.height ?? manifest.size.height
            )
            let worker = WorkerSession(
                workspace: workspace,
                workerScript: workerScript,
                sourcePath: sourcePath,
                statePath: statePath,
                treePath: treePath,
                mode: Self.effectiveMode(preferences: initialPreferences, manifest: manifest, size: initialWorkerSize),
                size: WorkerRenderSize(width: initialWorkerSize.width, height: initialWorkerSize.height)
            )
            worker.onTree = { [weak contentModel] tree in
                DispatchQueue.main.async {
                    contentModel?.tree = tree
                }
            }
            worker.onFailure = { (diagnostics: [WorkerDiagnostic]) in
                NSLog("Render worker failure: %@", diagnostics.map(\.message).joined(separator: "; "))
            }
            self.worker = worker
        }
    }

    func startWorker() {
        guard let worker else { return }
        let contentModel = contentModel
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let tree = try worker.start()
                DispatchQueue.main.async {
                    contentModel.tree = tree
                }
            } catch {
                worker.recordInitialFailure(error)
                NSLog("Render worker failed to start: %@", error.localizedDescription)
            }
        }
    }

    func render(mode: String, size: NSSize, completion: @escaping (Result<WidgetTree, Error>) -> Void = { _ in }) {
        worker?.render(
            mode: mode,
            size: WorkerRenderSize(width: size.width, height: size.height),
            completion: completion
        )
    }

    func stop() {
        worker?.stop()
    }

    func savePreferences(_ next: WidgetPreferences) {
        preferences.value = next
        guard let workspace, let data = try? JSONEncoder().encode(next) else { return }
        try? data.write(to: preferencesURL(workspace: workspace), options: .atomic)
    }

    func loadPlacement() -> WidgetPlacement? {
        guard let workspace,
              let data = try? Data(contentsOf: placementURL(workspace: workspace))
        else { return nil }
        return try? JSONDecoder().decode(WidgetPlacement.self, from: data)
    }

    func savePlacement(origin: NSPoint, panel: DesktopWidgetPanel) {
        guard
            let workspace,
            let screen = panel.screen(containing: origin),
            let screenID = panel.displayID(for: screen)
        else { return }

        let placement = WidgetPlacement(screenID: screenID, originX: origin.x, originY: origin.y)
        guard let data = try? JSONEncoder().encode(placement) else { return }
        try? data.write(to: placementURL(workspace: workspace), options: .atomic)
    }

    func markIntentionalStop() {
        guard let workspace else { return }
        let metadataURL = URL(fileURLWithPath: workspace).appendingPathComponent(".render/metadata.json")
        guard
            let data = try? Data(contentsOf: metadataURL),
            var metadata = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else { return }

        metadata["status"] = "stopped"
        metadata["running"] = false
        metadata["stopRequested"] = true
        metadata["processId"] = NSNull()
        metadata["workerProcessId"] = NSNull()
        metadata["workerStatePath"] = NSNull()
        metadata["lastTransitionAt"] = ISO8601DateFormatter().string(from: Date())
        guard let nextData = try? JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys]) else { return }
        try? nextData.write(to: metadataURL, options: .atomic)
    }

    func initialSize(panel: DesktopWidgetPanel?) -> NSSize {
        if let panel {
            return panel.contentRect(forFrameRect: panel.frame).size
        }
        return NSSize(
            width: preferences.value.width ?? manifest.size.width,
            height: preferences.value.height ?? manifest.size.height
        )
    }

    func effectiveMode(size: NSSize) -> String {
        Self.effectiveMode(preferences: preferences.value, manifest: manifest, size: size)
    }

    private static func loadTree(workspace: String?) -> WidgetTree {
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

    private static func loadManifest(workspace: String?) -> RuntimeManifest {
        guard
            let workspace,
            let data = try? Data(contentsOf: URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/manifest.json")),
            let manifest = try? JSONDecoder().decode(RuntimeManifest.self, from: data)
        else {
            return .fallback
        }
        return manifest
    }

    private static func loadPreferences(workspace: String?, manifest: RuntimeManifest) -> WidgetPreferences {
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

    private static func effectiveMode(preferences: WidgetPreferences, manifest: RuntimeManifest, size: NSSize) -> String {
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

    private static func placementURL(workspace: String) -> URL {
        URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/placement.json")
    }

    private static func preferencesURL(workspace: String) -> URL {
        URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/preferences.json")
    }

    private func placementURL(workspace: String) -> URL {
        Self.placementURL(workspace: workspace)
    }

    private func preferencesURL(workspace: String) -> URL {
        Self.preferencesURL(workspace: workspace)
    }
}
