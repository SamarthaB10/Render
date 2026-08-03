import Foundation
import RenderHostCore

protocol RenderConnectorAdapter: AnyObject {
    var connectorID: String { get }
    func status(scopes: [String]) -> AccountStatus
    func authorize(scopes: [String]) async throws -> AccountStatus
}

extension SpotifyConnector: RenderConnectorAdapter {
    var connectorID: String { Self.connectorID }
}

extension RemindersConnector: RenderConnectorAdapter {
    var connectorID: String { Self.connectorID }
}

final class RenderConnectorRegistry {
    let spotify: SpotifyConnector
    let reminders: RemindersConnector
    private let adapters: [String: any RenderConnectorAdapter]

    init(spotify: SpotifyConnector, reminders: RemindersConnector) {
        self.spotify = spotify
        self.reminders = reminders
        self.adapters = [
            SpotifyConnector.connectorID: spotify,
            RemindersConnector.connectorID: reminders
        ]
    }

    func adapter(for connectorID: String) -> (any RenderConnectorAdapter)? {
        adapters[connectorID]
    }

    func status(for connectorID: String, scopes: [String]) -> AccountStatus {
        adapter(for: connectorID)?.status(scopes: scopes)
            ?? AccountStatus(
                connector: connectorID,
                state: .unavailable,
                scopes: scopes,
                message: "connector is not available in this host"
            )
    }

    func authorize(connectorID: String, scopes: [String]) async throws -> AccountStatus {
        guard let adapter = adapter(for: connectorID) else {
            throw RenderConnectorRegistryError.unsupported(connectorID)
        }
        return try await adapter.authorize(scopes: scopes)
    }
}

enum RenderConnectorRegistryError: LocalizedError {
    case unsupported(String)

    var errorDescription: String? {
        switch self {
        case .unsupported(let connectorID):
            return "connector '\(connectorID)' is not available in this host"
        }
    }
}

struct RenderProviderRegistry {
    func contains(_ provider: String) -> Bool {
        RenderWidgetContract.providers.contains(provider)
    }

    func connectorID(for provider: String) -> String? {
        RenderWidgetContract.providerConnectors[provider]
    }
}

struct RenderActionRegistry {
    func contains(_ action: String) -> Bool {
        RenderWidgetContract.actions.contains(action)
    }

    func connectorID(for action: String) -> String? {
        RenderWidgetContract.actionConnectors[action]
    }
}

final class RenderRegistry {
    let connectors: RenderConnectorRegistry
    let providers = RenderProviderRegistry()
    let actions = RenderActionRegistry()

    init(spotify: SpotifyConnector, reminders: RemindersConnector) {
        connectors = RenderConnectorRegistry(spotify: spotify, reminders: reminders)
    }
}
