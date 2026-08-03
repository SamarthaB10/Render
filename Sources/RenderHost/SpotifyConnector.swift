import AppKit
import CryptoKit
import Foundation
import Network
import RenderHostCore
import Security

struct SpotifyConnectorConfiguration {
    let clientID: String

    static func fromEnvironment(_ environment: [String: String] = ProcessInfo.processInfo.environment) -> SpotifyConnectorConfiguration? {
        guard let clientID = environment["RENDER_SPOTIFY_CLIENT_ID"], !clientID.isEmpty else {
            return nil
        }
        return SpotifyConnectorConfiguration(clientID: clientID)
    }
}

struct SpotifyPlaybackState: Equatable, Sendable {
    let isPlaying: Bool
    let title: String?
    let artist: String?
    let progressMs: Double?
    let durationMs: Double?
    let volumePercent: Double?
}

enum SpotifyPlaybackCommand: Sendable {
    case play
    case pause
    case next
    case previous
    case setVolume(Int)
}

enum SpotifyConnectorError: LocalizedError {
    case notConfigured
    case authorizationRequired
    case authorizationDenied(String)
    case invalidCallback
    case invalidResponse
    case http(status: Int, message: String)
    case rateLimited(seconds: Int?)
    case missingRefreshToken

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Spotify is not configured for this Render installation"
        case .authorizationRequired:
            return "Connect a Spotify account before using playback"
        case .authorizationDenied(let message):
            return "Spotify authorization was denied: \(message)"
        case .invalidCallback:
            return "Spotify returned an invalid authorization callback"
        case .invalidResponse:
            return "Spotify returned an invalid response"
        case .http(let status, let message):
            return "Spotify returned HTTP \(status): \(message)"
        case .rateLimited(let seconds):
            if let seconds { return "Spotify rate limited this widget; retry after \(seconds) seconds" }
            return "Spotify rate limited this widget"
        case .missingRefreshToken:
            return "Spotify did not provide a refresh token; reconnect the account"
        }
    }
}

final class SpotifyConnector {
    static let connectorID = "spotify"
    static let supportedScopes = [
        "user-read-private",
        "user-read-playback-state",
        "user-read-currently-playing",
        "user-modify-playback-state"
    ]

    private let configuration: SpotifyConnectorConfiguration?
    private let credentials: CredentialStore
    private let session: URLSession
    private let baseURL = URL(string: "https://api.spotify.com/v1")!
    private let authorizationURL = URL(string: "https://accounts.spotify.com/authorize")!
    private let tokenURL = URL(string: "https://accounts.spotify.com/api/token")!

    init(
        configuration: SpotifyConnectorConfiguration? = .fromEnvironment(),
        credentials: CredentialStore = KeychainCredentialStore(),
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.credentials = credentials
        self.session = session
    }

    func status(scopes: [String]) -> AccountStatus {
        guard configuration != nil else {
            return AccountStatus(
                connector: Self.connectorID,
                state: .unavailable,
                scopes: scopes,
                message: "Set RENDER_SPOTIFY_CLIENT_ID for local Spotify authorization"
            )
        }
        guard let credential = try? credentials.load(connector: Self.connectorID) else {
            return AccountStatus(
                connector: Self.connectorID,
                state: .needsAuthorization,
                scopes: scopes,
                message: "Connect Spotify to continue"
            )
        }
        if credential.isExpired {
            return AccountStatus(
                connector: Self.connectorID,
                state: .expired,
                scopes: scopes,
                message: "Spotify authorization needs to be refreshed"
            )
        }
        return AccountStatus(connector: Self.connectorID, state: .connected, scopes: scopes)
    }

    func authorize(scopes: [String]) async throws -> AccountStatus {
        guard let configuration else { throw SpotifyConnectorError.notConfigured }
        let challenge = try PKCEChallenge()
        let callback = LoopbackCallbackServer()
        let redirectURI = try await callback.start()
        defer { callback.stop() }

        var components = URLComponents(url: authorizationURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "client_id", value: configuration.clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: redirectURI.absoluteString),
            URLQueryItem(name: "scope", value: scopes.joined(separator: " ")),
            URLQueryItem(name: "state", value: challenge.state),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "code_challenge", value: challenge.codeChallenge)
        ]
        guard let url = components?.url else { throw SpotifyConnectorError.invalidCallback }
        guard NSWorkspace.shared.open(url) else { throw SpotifyConnectorError.authorizationDenied("could not open the browser") }

        let callbackURL = try await callback.waitForCallback()
        guard let callbackComponents = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              callbackComponents.queryItems?.first(where: { $0.name == "state" })?.value == challenge.state
        else { throw SpotifyConnectorError.invalidCallback }
        if let error = callbackComponents.queryItems?.first(where: { $0.name == "error" })?.value {
            throw SpotifyConnectorError.authorizationDenied(error)
        }
        guard let code = callbackComponents.queryItems?.first(where: { $0.name == "code" })?.value else {
            throw SpotifyConnectorError.invalidCallback
        }

        let credential = try await exchange(code: code, verifier: challenge.verifier, redirectURI: redirectURI, clientID: configuration.clientID)
        try credentials.save(credential, connector: Self.connectorID)
        return AccountStatus(connector: Self.connectorID, state: .connected, scopes: scopes)
    }

    func playback() async throws -> SpotifyPlaybackState {
        let (data, response) = try await request(path: "/me/player", method: "GET")
        if response.statusCode == 204 {
            return SpotifyPlaybackState(isPlaying: false, title: nil, artist: nil, progressMs: nil, durationMs: nil, volumePercent: nil)
        }
        try validate(response: response, data: data)
        let payload = try JSONDecoder().decode(PlaybackResponse.self, from: data)
        return payload.playbackState
    }

    func perform(_ command: SpotifyPlaybackCommand) async throws {
        let operation: (path: String, method: String, query: [URLQueryItem])
        switch command {
        case .play: operation = ("/me/player/play", "PUT", [])
        case .pause: operation = ("/me/player/pause", "PUT", [])
        case .next: operation = ("/me/player/next", "POST", [])
        case .previous: operation = ("/me/player/previous", "POST", [])
        case .setVolume(let value):
            guard (0...100).contains(value) else { throw SpotifyConnectorError.invalidResponse }
            operation = ("/me/player/volume", "PUT", [URLQueryItem(name: "volume_percent", value: String(value))])
        }
        let (data, response) = try await request(path: operation.path, method: operation.method, query: operation.query)
        try validate(response: response, data: data)
    }

    private func request(path: String, method: String, query: [URLQueryItem] = [], retrying: Bool = false) async throws -> (Data, HTTPURLResponse) {
        let token = try await accessToken()
        let endpoint = baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        guard var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            throw SpotifyConnectorError.invalidResponse
        }
        components.queryItems = query.isEmpty ? nil : query
        guard let requestURL = components.url else { throw SpotifyConnectorError.invalidResponse }
        var urlRequest = URLRequest(url: requestURL)
        urlRequest.httpMethod = method
        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: urlRequest)
        guard let response = response as? HTTPURLResponse else { throw SpotifyConnectorError.invalidResponse }
        if response.statusCode == 401 && !retrying {
            _ = try await refreshAccessToken()
            return try await request(path: path, method: method, query: query, retrying: true)
        }
        return (data, response)
    }

    private func accessToken() async throws -> String {
        guard let credential = try credentials.load(connector: Self.connectorID) else {
            throw SpotifyConnectorError.authorizationRequired
        }
        if !credential.isExpired { return credential.accessToken }
        return try await refreshAccessToken().accessToken
    }

    private func refreshAccessToken() async throws -> OAuthCredential {
        guard let configuration, let existing = try credentials.load(connector: Self.connectorID), let refreshToken = existing.refreshToken else {
            throw SpotifyConnectorError.missingRefreshToken
        }
        let body = formEncoded([
            ("grant_type", "refresh_token"),
            ("refresh_token", refreshToken),
            ("client_id", configuration.clientID)
        ])
        var request = URLRequest(url: tokenURL)
        request.httpMethod = "POST"
        request.httpBody = body.data(using: .utf8)
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        let payload = try JSONDecoder().decode(TokenResponse.self, from: data)
        let credential = OAuthCredential(
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken ?? refreshToken,
            expiresAt: Date().addingTimeInterval(TimeInterval(payload.expiresIn))
        )
        try credentials.save(credential, connector: Self.connectorID)
        return credential
    }

    private func exchange(code: String, verifier: String, redirectURI: URL, clientID: String) async throws -> OAuthCredential {
        let body = formEncoded([
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirectURI.absoluteString),
            ("client_id", clientID),
            ("code_verifier", verifier)
        ])
        var request = URLRequest(url: tokenURL)
        request.httpMethod = "POST"
        request.httpBody = body.data(using: .utf8)
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        let payload = try JSONDecoder().decode(TokenResponse.self, from: data)
        return OAuthCredential(
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            expiresAt: Date().addingTimeInterval(TimeInterval(payload.expiresIn))
        )
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let response = response as? HTTPURLResponse else { throw SpotifyConnectorError.invalidResponse }
        if response.statusCode == 429 {
            let retryAfter = response.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init)
            throw SpotifyConnectorError.rateLimited(seconds: retryAfter)
        }
        guard (200..<300).contains(response.statusCode) else {
            let message = (try? JSONDecoder().decode(SpotifyErrorResponse.self, from: data).error.message) ?? "request failed"
            throw SpotifyConnectorError.http(status: response.statusCode, message: message)
        }
    }

    private func formEncoded(_ values: [(String, String)]) -> String {
        values.map { "\(urlEncode($0.0))=\(urlEncode($0.1))" }.joined(separator: "&")
    }

    private func urlEncode(_ value: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "+&=")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

private struct TokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

private struct SpotifyErrorResponse: Decodable {
    let error: ErrorBody

    struct ErrorBody: Decodable {
        let message: String
    }
}

private struct PlaybackResponse: Decodable {
    let isPlaying: Bool
    let progressMs: Int?
    let item: Track?
    let device: Device?

    enum CodingKeys: String, CodingKey {
        case isPlaying = "is_playing"
        case progressMs = "progress_ms"
        case item
        case device
    }

    var playbackState: SpotifyPlaybackState {
        SpotifyPlaybackState(
            isPlaying: isPlaying,
            title: item?.name,
            artist: item?.artists.first?.name,
            progressMs: progressMs.map(Double.init),
            durationMs: item?.durationMs.map(Double.init),
            volumePercent: device?.volumePercent.map(Double.init)
        )
    }
}

private struct Track: Decodable {
    let name: String
    let durationMs: Int?
    let artists: [Artist]

    enum CodingKeys: String, CodingKey {
        case name
        case durationMs = "duration_ms"
        case artists
    }
}

private struct Artist: Decodable {
    let name: String
}

private struct Device: Decodable {
    let volumePercent: Int?

    enum CodingKeys: String, CodingKey {
        case volumePercent = "volume_percent"
    }
}

private struct PKCEChallenge {
    let verifier: String
    let codeChallenge: String
    let state: String

    init() throws {
        let alphabet = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        var bytes = [UInt8](repeating: 0, count: 64)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw SpotifyConnectorError.invalidResponse
        }
        verifier = String(bytes.map { alphabet[Int($0) % alphabet.count] })
        codeChallenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .trimmingCharacters(in: CharacterSet(charactersIn: "="))
        state = UUID().uuidString
    }
}

private final class LoopbackCallbackServer {
    private let queue = DispatchQueue(label: "com.samarthab.Render.spotify-oauth")
    private var listener: NWListener?
    private var readyContinuation: CheckedContinuation<URL, Error>?
    private var callbackContinuation: CheckedContinuation<URL, Error>?
    private var callbackError: Error?

    func start() async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            readyContinuation = continuation
            do {
                let parameters = NWParameters.tcp
                parameters.requiredInterfaceType = .loopback
                let listener = try NWListener(using: parameters, on: .any)
                self.listener = listener
                listener.stateUpdateHandler = { [weak self] state in
                    guard let self else { return }
                    switch state {
                    case .ready:
                        guard let port = listener.port?.rawValue else {
                            self.resumeReady(with: .failure(SpotifyConnectorError.invalidCallback))
                            return
                        }
                        self.resumeReady(with: .success(URL(string: "http://127.0.0.1:\(port)")!))
                    case .failed(let error):
                        self.resumeReady(with: .failure(error))
                        self.resumeCallback(with: .failure(error))
                    default:
                        break
                    }
                }
                listener.newConnectionHandler = { [weak self] connection in
                    self?.accept(connection)
                }
                listener.start(queue: queue)
            } catch {
                resumeReady(with: .failure(error))
            }
        }
    }

    func waitForCallback() async throws -> URL {
        if let callbackError { throw callbackError }
        return try await withCheckedThrowingContinuation { continuation in
            callbackContinuation = continuation
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self, weak connection] data, _, _, _ in
            guard let self, let connection, let data, let request = String(data: data, encoding: .utf8) else { return }
            let path = request.split(separator: "\n").first?.split(separator: " ").dropFirst().first.map(String.init)
            guard let path, let url = URL(string: "http://127.0.0.1\(path)") else {
                self.reply(to: connection, body: "Authorization failed")
                self.resumeCallback(with: .failure(SpotifyConnectorError.invalidCallback))
                return
            }
            self.reply(to: connection, body: "You can close this window and return to Render.")
            self.resumeCallback(with: .success(url))
        }
    }

    private func reply(to connection: NWConnection, body: String) {
        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: \(body.utf8.count)\r\nConnection: close\r\n\r\n\(body)"
        connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in connection.cancel() })
    }

    private func resumeReady(with result: Result<URL, Error>) {
        guard let continuation = readyContinuation else { return }
        readyContinuation = nil
        switch result {
        case .success(let url): continuation.resume(returning: url)
        case .failure(let error): continuation.resume(throwing: error)
        }
    }

    private func resumeCallback(with result: Result<URL, Error>) {
        callbackError = result.failure
        guard let continuation = callbackContinuation else { return }
        callbackContinuation = nil
        switch result {
        case .success(let url): continuation.resume(returning: url)
        case .failure(let error): continuation.resume(throwing: error)
        }
    }
}

private extension Result where Success == URL, Failure == Error {
    var failure: Error? {
        if case .failure(let error) = self { return error }
        return nil
    }
}
