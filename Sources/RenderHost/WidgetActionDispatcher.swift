import Foundation
import RenderHostCore

/// The native action boundary. Widget trees carry descriptors; this object is
/// the only place where a descriptor can become a host operation.
final class WidgetActionDispatcher {
    private let capabilities: Set<String>
    private let registry: RenderRegistry
    private let hasSpotifyAccount: Bool
    private let hasRemindersAccount: Bool
    private let onRemindersMutation: (() -> Void)?

    init(
        capabilities: [String],
        registry: RenderRegistry? = nil,
        accountRequirements: [WidgetAccountRequirement] = [],
        spotify: SpotifyConnector = SpotifyConnector(),
        reminders: RemindersConnector = RemindersConnector(),
        hasSpotifyAccount: Bool = false,
        hasRemindersAccount: Bool = false,
        onRemindersMutation: (() -> Void)? = nil
    ) {
        self.capabilities = Set(capabilities)
        self.registry = registry ?? RenderRegistry(spotify: spotify, reminders: reminders)
        self.hasSpotifyAccount = hasSpotifyAccount || accountRequirements.contains(where: { $0.connector == SpotifyConnector.connectorID })
        self.hasRemindersAccount = hasRemindersAccount || accountRequirements.contains(where: { $0.connector == RemindersConnector.connectorID && $0.scopes.contains("reminders.write") })
        self.onRemindersMutation = onRemindersMutation
    }

    func dispatch(_ action: WidgetAction) {
        switch action {
        case .invoke(let name, let payload):
            guard !name.isEmpty else {
                NSLog("Render action denied: empty invoke name")
                return
            }
            guard isKnownAction(name) else {
                NSLog("Render action denied: unsupported invoke '%@'", name)
                return
            }
            if registry.actions.connectorID(for: name) == SpotifyConnector.connectorID {
                guard hasSpotifyAccount else {
                    NSLog("Render action denied: Spotify account requirement is missing")
                    return
                }
                let command: SpotifyPlaybackCommand?
                switch name {
                case "spotify.play": command = .play
                case "spotify.pause": command = .pause
                case "spotify.next": command = .next
                case "spotify.previous": command = .previous
                default: command = nil
                }
                guard let command else {
                    NSLog("Render action denied: '%@' requires a set value", name)
                    return
                }
                performSpotify(command)
                return
            }
            if registry.actions.connectorID(for: name) == RemindersConnector.connectorID {
                guard hasRemindersAccount else {
                    NSLog("Render action denied: Reminders account requirement is missing")
                    return
                }
                guard let command = remindersCommand(name: name, payload: payload) else { return }
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    do {
                        try self.registry.connectors.reminders.perform(command)
                        self.onRemindersMutation?()
                        NSLog("Render Reminders action completed")
                    } catch {
                        NSLog("Render Reminders action unavailable: %@", error.localizedDescription)
                    }
                }
                return
            }
            NSLog("Render action accepted: invoke '%@' payload=%@ capabilities=%@", name, String(describing: payload), capabilities.sorted().joined(separator: ","))
        case .set(let name, let value):
            guard !name.isEmpty else {
                NSLog("Render action denied: empty set name")
                return
            }
            guard isKnownAction(name) else {
                NSLog("Render action denied: unsupported set '%@'", name)
                return
            }
            if registry.actions.connectorID(for: name) == SpotifyConnector.connectorID, name == "spotify.set-volume" {
                guard hasSpotifyAccount, case .number(let number) = value, number.isFinite, (0...100).contains(number) else {
                    NSLog("Render action denied: Spotify volume must be a number from 0 through 100 and require an account")
                    return
                }
                performSpotify(.setVolume(Int(number.rounded())))
                return
            }
            NSLog("Render action accepted: set '%@' value=%@ capabilities=%@", name, String(describing: value), capabilities.sorted().joined(separator: ","))
        }
    }

    private func isKnownAction(_ name: String) -> Bool {
        registry.actions.contains(name)
    }

    private func performSpotify(_ command: SpotifyPlaybackCommand) {
        Task {
            do {
                try await registry.connectors.spotify.perform(command)
                NSLog("Render Spotify action completed")
            } catch {
                NSLog("Render Spotify action unavailable: %@", error.localizedDescription)
            }
        }
    }

    private func remindersCommand(name: String, payload: WidgetJSONValue?) -> RemindersCommand? {
        guard case .object(let object) = payload else {
            NSLog("Render action denied: '%@' requires an object payload", name)
            return nil
        }
        switch name {
        case "reminders.create":
            guard let title = string(object["title"]) else {
                NSLog("Render action denied: reminders.create requires payload.title")
                return nil
            }
            guard let dueDate = date(object["dueDate"]) else {
                if object["dueDate"] != nil {
                    NSLog("Render action denied: reminders.create dueDate must be an ISO date string")
                    return nil
                }
                return .create(title: title, listName: string(object["listName"]), dueDate: nil)
            }
            return .create(title: title, listName: string(object["listName"]), dueDate: dueDate)
        case "reminders.update":
            guard let id = string(object["id"]) else {
                NSLog("Render action denied: reminders.update requires payload.id")
                return nil
            }
            let dueDateValue = object["dueDate"]
            guard let dueDate = date(dueDateValue) else {
                if let dueDateValue, dueDateValue != .null {
                    NSLog("Render action denied: reminders.update dueDate must be an ISO date string or null")
                    return nil
                }
                return .update(id: id, title: string(object["title"]), dueDate: nil, clearDueDate: dueDateValue == .null, completed: boolean(object["completed"]))
            }
            return .update(id: id, title: string(object["title"]), dueDate: dueDate, clearDueDate: false, completed: boolean(object["completed"]))
        case "reminders.complete":
            guard let id = string(object["id"]) else {
                NSLog("Render action denied: reminders.complete requires payload.id")
                return nil
            }
            return .complete(id: id, completed: boolean(object["completed"]) ?? true)
        case "reminders.delete":
            guard let id = string(object["id"]) else {
                NSLog("Render action denied: reminders.delete requires payload.id")
                return nil
            }
            return .delete(id: id)
        default:
            return nil
        }
    }

    private func string(_ value: WidgetJSONValue?) -> String? {
        guard case .string(let value) = value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return value
    }

    private func boolean(_ value: WidgetJSONValue?) -> Bool? {
        guard case .boolean(let value) = value else { return nil }
        return value
    }

    private func date(_ value: WidgetJSONValue?) -> Date? {
        guard case .string(let value) = value else { return nil }
        return ISO8601DateFormatter().date(from: value)
    }
}
