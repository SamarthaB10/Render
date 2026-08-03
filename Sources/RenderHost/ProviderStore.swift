import Combine
import Foundation
import RenderHostCore

final class ProviderStore: ObservableObject {
    @Published private(set) var snapshot = ProviderSnapshot()
    @Published private(set) var authorizationMessage: String?

    private let subscriptions: Set<String>
    private let accountRequirements: [String: WidgetAccountRequirement]
    private let spotify: SpotifyConnector
    private var sampler = SystemMetricsSampler()
    private var timer: Timer?
    private var spotifySampleTask: Task<Void, Never>?

    init(
        subscriptions: Set<String>,
        accountRequirements: [WidgetAccountRequirement] = [],
        spotify: SpotifyConnector = SpotifyConnector()
    ) {
        self.subscriptions = subscriptions
        self.accountRequirements = Dictionary(uniqueKeysWithValues: accountRequirements.map { ($0.connector, $0) })
        self.spotify = spotify
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
        return AccountStatus(connector: connector, state: .unavailable, scopes: requirement.scopes, message: "connector is not available in this host")
    }

    func refreshNow() {
        sample()
    }

    func setAuthorizationMessage(_ message: String?) {
        authorizationMessage = message
    }

    deinit {
        timer?.invalidate()
        spotifySampleTask?.cancel()
    }

    private func sample() {
        var values = sampler.sample(subscriptions: subscriptions).values
        guard subscriptions.contains(where: { $0.hasPrefix("spotify.") }) else {
            snapshot = ProviderSnapshot(values: values)
            return
        }

        let requirement = accountRequirements[SpotifyConnector.connectorID]
        let status = spotify.status(scopes: requirement?.scopes ?? [])
        values["spotify.account"] = .text(name: "spotify.account", value: accountDisplay(status))
        for provider in subscriptions where provider.hasPrefix("spotify.") && provider != "spotify.account" {
            values[provider] = .loading(name: provider, message: "waiting for Spotify playback")
        }
        snapshot = ProviderSnapshot(values: values)

        guard status.state == .connected || status.state == .expired else { return }
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
        case .needsAuthorization: return "Connect Spotify"
        case .denied: return "Spotify permission denied"
        case .expired: return "Reconnect Spotify"
        case .revoked: return "Spotify access revoked"
        case .unavailable: return "Spotify unavailable"
        }
    }
}
