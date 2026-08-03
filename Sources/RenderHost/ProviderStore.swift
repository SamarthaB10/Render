import Combine
import Foundation
import RenderHostCore

final class ProviderStore: ObservableObject {
    @Published private(set) var snapshot = ProviderSnapshot()
    @Published private(set) var authorizationMessage: String?

    private let subscriptions: Set<String>
    private let accountRequirements: [String: WidgetAccountRequirement]
    private let spotify: SpotifyConnector
    private let reminders: RemindersConnector
    private var sampler = SystemMetricsSampler()
    private var timer: Timer?
    private var spotifySampleTask: Task<Void, Never>?
    private var remindersSampleTask: Task<Void, Never>?

    init(
        subscriptions: Set<String>,
        accountRequirements: [WidgetAccountRequirement] = [],
        spotify: SpotifyConnector = SpotifyConnector(),
        reminders: RemindersConnector = RemindersConnector()
    ) {
        self.subscriptions = subscriptions
        self.accountRequirements = Dictionary(uniqueKeysWithValues: accountRequirements.map { ($0.connector, $0) })
        self.spotify = spotify
        self.reminders = reminders
    }

    func start() {
        guard timer == nil, !subscriptions.isEmpty else { return }
        sample()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.sample()
        }
    }

    func value(for name: String) -> ProviderValue? {
        snapshot.values[name] ?? (subscriptions.contains(name) ? .loading(name: name) : nil)
    }

    func accountStatus(for connector: String) -> AccountStatus? {
        guard let requirement = accountRequirements[connector] else { return nil }
        if connector == SpotifyConnector.connectorID {
            return spotify.status(scopes: requirement.scopes)
        }
        if connector == RemindersConnector.connectorID {
            return reminders.status(scopes: requirement.scopes)
        }
        return AccountStatus(connector: connector, state: .unavailable, scopes: requirement.scopes, message: "connector is not available in this host")
    }

    var accountConnector: String? {
        accountRequirements.keys.sorted().first
    }

    func refreshNow() {
        sample()
    }

    func setAuthorizationMessage(_ message: String?) {
        authorizationMessage = message
    }

    func authorize(connector: String, scopes: [String]) async throws {
        switch connector {
        case SpotifyConnector.connectorID:
            _ = try await spotify.authorize(scopes: scopes)
        case RemindersConnector.connectorID:
            _ = try await reminders.authorize(scopes: scopes)
        default:
            throw RemindersConnectorError.unavailable("connector '\(connector)' is not available in this host")
        }
    }

    deinit {
        timer?.invalidate()
        spotifySampleTask?.cancel()
        remindersSampleTask?.cancel()
    }

    private func sample() {
        var values = sampler.sample(subscriptions: subscriptions).values
        let hasSpotify = subscriptions.contains(where: { $0.hasPrefix("spotify.") })
        let hasReminders = subscriptions.contains(where: { $0.hasPrefix("reminders.") })
        guard hasSpotify || hasReminders else {
            snapshot = ProviderSnapshot(values: values)
            return
        }

        if hasSpotify {
            let requirement = accountRequirements[SpotifyConnector.connectorID]
            let status = spotify.status(scopes: requirement?.scopes ?? [])
            values["spotify.account"] = .text(name: "spotify.account", value: accountDisplay(status))
            for provider in subscriptions where provider.hasPrefix("spotify.") && provider != "spotify.account" {
                values[provider] = .loading(name: provider, message: "waiting for Spotify playback")
            }
            snapshot = ProviderSnapshot(values: values)

            if status.state == .connected || status.state == .expired {
                spotifySampleTask?.cancel()
                spotifySampleTask = Task { [weak self] in
                    do {
                        let playback = try await self?.spotify.playback()
                        guard let self, let playback else { return }
                        await MainActor.run { self.apply(playback: playback) }
                    } catch {
                        guard let self else { return }
                        await MainActor.run { self.applySpotifyFailure(error) }
                    }
                }
            }
        }
        sampleRemindersIfNeeded()
    }

    private func sampleRemindersIfNeeded() {
        guard subscriptions.contains(where: { $0.hasPrefix("reminders.") }) else { return }
        let requirement = accountRequirements[RemindersConnector.connectorID]
        let status = reminders.status(scopes: requirement?.scopes ?? [])
        var values = snapshot.values
        values["reminders.account"] = .text(name: "reminders.account", value: accountDisplay(status))
        for provider in subscriptions where provider.hasPrefix("reminders.") && provider != "reminders.account" {
            values[provider] = .loading(name: provider, message: "waiting for Reminders permission")
        }
        snapshot = ProviderSnapshot(values: values)

        guard status.state == .connected else { return }
        remindersSampleTask?.cancel()
        remindersSampleTask = Task { [weak self] in
            do {
                let reminders = try await self?.reminders.reminders()
                guard let self, let reminders else { return }
                self.apply(reminders: reminders)
            } catch {
                guard let self else { return }
                self.applyRemindersFailure(error)
            }
        }
    }

    private func apply(reminders: [ReminderRecord]) {
        var values = snapshot.values
        let incomplete = reminders.filter { !$0.completed }
        values["reminders.account"] = .text(name: "reminders.account", value: "Connected")
        values["reminders.items"] = .structured(
            name: "reminders.items",
            value: .array(reminders.map { reminder in
                .object([
                    "id": .string(reminder.id),
                    "title": .string(reminder.title),
                    "subtitle": .string(reminder.listName),
                    "completed": .boolean(reminder.completed)
                ])
            })
        )
        values["reminders.incompleteCount"] = .available(name: "reminders.incompleteCount", value: Double(incomplete.count))
        if let next = incomplete.first {
            values["reminders.next.title"] = .text(name: "reminders.next.title", value: next.title)
            if let dueDate = next.dueDate {
                values["reminders.next.dueDate"] = .text(name: "reminders.next.dueDate", value: Self.iso8601.string(from: dueDate))
            } else {
                values["reminders.next.dueDate"] = .unavailable(name: "reminders.next.dueDate", message: "next reminder has no due date")
            }
        } else {
            values["reminders.next.title"] = .unavailable(name: "reminders.next.title", message: "no incomplete reminders")
            values["reminders.next.dueDate"] = .unavailable(name: "reminders.next.dueDate", message: "no incomplete reminders")
        }
        snapshot = ProviderSnapshot(values: values)
    }

    private func applyRemindersFailure(_ error: Error) {
        var values = snapshot.values
        let message = error.localizedDescription
        for provider in subscriptions where provider.hasPrefix("reminders.") && provider != "reminders.account" {
            values[provider] = .unavailable(name: provider, message: message)
        }
        snapshot = ProviderSnapshot(values: values)
    }

    private func apply(playback: SpotifyPlaybackState) {
        var values = snapshot.values
        values["spotify.account"] = .text(name: "spotify.account", value: "Connected")
        if let title = playback.title {
            values["spotify.track.title"] = .text(name: "spotify.track.title", value: title)
        } else {
            values["spotify.track.title"] = .unavailable(name: "spotify.track.title", message: "no Spotify track is playing")
        }
        if let artist = playback.artist {
            values["spotify.track.artist"] = .text(name: "spotify.track.artist", value: artist)
        } else {
            values["spotify.track.artist"] = .unavailable(name: "spotify.track.artist", message: "no Spotify artist is available")
        }
        values["spotify.playback.isPlaying"] = .text(
            name: "spotify.playback.isPlaying",
            value: playback.isPlaying ? "Playing" : "Paused"
        )
        if let progressMs = playback.progressMs, let durationMs = playback.durationMs, durationMs > 0 {
            values["spotify.playback.progress"] = .available(
                name: "spotify.playback.progress",
                value: min(max(progressMs / durationMs * 100, 0), 100)
            )
        } else {
            values["spotify.playback.progress"] = .unavailable(name: "spotify.playback.progress", message: "track progress is unavailable")
        }
        if let volume = playback.volumePercent {
            values["spotify.playback.volume"] = .available(name: "spotify.playback.volume", value: min(max(volume, 0), 100))
        } else {
            values["spotify.playback.volume"] = .unavailable(name: "spotify.playback.volume", message: "device volume is unavailable")
        }
        snapshot = ProviderSnapshot(values: values)
    }

    private func applySpotifyFailure(_ error: Error) {
        var values = snapshot.values
        let message = error.localizedDescription
        for provider in subscriptions where provider.hasPrefix("spotify.") && provider != "spotify.account" {
            values[provider] = .unavailable(name: provider, message: message)
        }
        snapshot = ProviderSnapshot(values: values)
    }

    private func accountDisplay(_ status: AccountStatus) -> String {
        switch status.state {
        case .connected: return status.displayName.map { "Connected: \($0)" } ?? "Connected"
        case .needsAuthorization: return "Connect \(displayName(for: status.connector))"
        case .denied: return "\(displayName(for: status.connector)) permission denied"
        case .expired: return "Reconnect \(displayName(for: status.connector))"
        case .revoked: return "\(displayName(for: status.connector)) access revoked"
        case .unavailable: return "\(displayName(for: status.connector)) unavailable"
        }
    }

    private func displayName(for connector: String) -> String {
        switch connector {
        case SpotifyConnector.connectorID: return "Spotify"
        case RemindersConnector.connectorID: return "Reminders"
        default: return connector.replacingOccurrences(of: ".", with: " ").capitalized
        }
    }

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
