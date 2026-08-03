import Foundation
import RenderHostCore

/// The native action boundary. Widget trees carry descriptors; this object is
/// the only place where a descriptor can become a host operation.
final class WidgetActionDispatcher {
    private let capabilities: Set<String>
    private let spotify: SpotifyConnector
    private let hasSpotifyAccount: Bool

    init(capabilities: [String], spotify: SpotifyConnector = SpotifyConnector(), hasSpotifyAccount: Bool = false) {
        self.capabilities = Set(capabilities)
        self.spotify = spotify
        self.hasSpotifyAccount = hasSpotifyAccount
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
            if name.hasPrefix("spotify.") {
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
            if name == "spotify.set-volume" {
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
        ["widget.refresh", "widget.reload", "spotify.play", "spotify.pause", "spotify.next", "spotify.previous", "spotify.set-volume"].contains(name)
    }

    private func performSpotify(_ command: SpotifyPlaybackCommand) {
        Task {
            do {
                try await spotify.perform(command)
                NSLog("Render Spotify action completed")
            } catch {
                NSLog("Render Spotify action unavailable: %@", error.localizedDescription)
            }
        }
    }
}
