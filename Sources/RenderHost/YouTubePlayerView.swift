import AppKit
import SwiftUI
import WebKit

struct YouTubePlayerView: View {
    let path: String
    let initialVideoID: String?
    let allowLinkInput: Bool
    let controls: Bool
    let autoplay: Bool
    let startSeconds: Double?
    @ObservedObject var store: WidgetInteractionStore

    @State private var linkInputEnabled: Bool
    @State private var linkText: String
    @State private var activeVideoID: String?

    init(path: String, initialVideoID: String?, allowLinkInput: Bool, controls: Bool, autoplay: Bool, startSeconds: Double?, store: WidgetInteractionStore) {
        self.path = path
        self.initialVideoID = initialVideoID
        self.allowLinkInput = allowLinkInput
        self.controls = controls
        self.autoplay = autoplay
        self.startSeconds = startSeconds
        self.store = store
        let storedValue = store.youtubeURL(path: path, defaultValue: initialVideoID)
        _linkInputEnabled = State(initialValue: allowLinkInput && store.youtubeLinkInputIsEnabled(path: path, defaultValue: initialVideoID == nil))
        _linkText = State(initialValue: storedValue ?? "")
        _activeVideoID = State(initialValue: Self.extractVideoID(from: storedValue ?? "") ?? initialVideoID)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if allowLinkInput {
                Toggle("Paste YouTube link", isOn: $linkInputEnabled)
                    .toggleStyle(.switch)
                    .controlSize(.small)
                    .onChange(of: linkInputEnabled) { enabled in
                        store.saveYouTubeLinkInput(path: path, enabled: enabled)
                    }
                if linkInputEnabled {
                    HStack(spacing: 6) {
                        TextField("https://youtube.com/watch?v=…", text: $linkText)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit(loadLink)
                        Button("Load", action: loadLink)
                            .buttonStyle(.bordered)
                            .disabled(Self.extractVideoID(from: linkText) == nil)
                    }
                }
            }
            if let activeVideoID {
                YouTubePlayerSurface(videoID: activeVideoID, controls: controls, autoplay: autoplay, startSeconds: startSeconds)
            } else {
                Text("Paste a YouTube link to begin")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 120)
            }
        }
        .onDisappear { store.saveYouTubeURL(path: path, value: linkText) }
    }

    private func loadLink() {
        guard let videoID = Self.extractVideoID(from: linkText) else { return }
        activeVideoID = videoID
        store.saveYouTubeURL(path: path, value: linkText)
    }

    private static func extractVideoID(from input: String) -> String? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), url.scheme?.lowercased() == "https", let host = url.host?.lowercased() else { return nil }
        let allowedHost = host == "youtu.be" || host == "youtube.com" || host.hasSuffix(".youtube.com")
        guard allowedHost else { return nil }
        if host == "youtu.be" {
            return validVideoID(String(url.path.drop(while: { $0 == "/" })))
        }
        if let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "v" })?.value {
            return validVideoID(value)
        }
        let parts = url.path.split(separator: "/")
        if let marker = parts.first, ["embed", "shorts", "live"].contains(String(marker)), parts.count > 1 {
            return validVideoID(String(parts[1]))
        }
        return nil
    }

    private static func validVideoID(_ value: String) -> String? {
        value.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) == nil ? nil : value
    }
}

private struct YouTubePlayerSurface: NSViewRepresentable {
    let videoID: String
    let controls: Bool
    let autoplay: Bool
    let startSeconds: Double?

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        if #available(macOS 10.15, *) {
            configuration.mediaTypesRequiringUserActionForPlayback = autoplay ? [] : [.audio, .video]
        }
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        load(webView, context: context)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.signature != configurationSignature else { return }
        load(webView, context: context)
    }

    private var configurationSignature: String {
        let start = startSeconds.map { String($0) } ?? ""
        return [videoID, String(controls), String(autoplay), start].joined(separator: "|")
    }

    private func load(_ webView: WKWebView, context: Context) {
        context.coordinator.signature = configurationSignature
        let autoplayValue = autoplay ? 1 : 0
        let controlsValue = controls ? 1 : 0
        let startQuery = startSeconds.map { "&start=\(max(0, Int($0.rounded(.down))))" } ?? ""
        let html = """
        <!doctype html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
        <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}iframe{display:block;width:100%;height:100%;border:0}</style>
        </head><body><iframe src="https://www.youtube.com/embed/\(videoID)?enablejsapi=1&origin=https%3A%2F%2Frender.local&playsinline=1&autoplay=\(autoplayValue)&controls=\(controlsValue)\(startQuery)" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>
        """
        webView.loadHTMLString(html, baseURL: URL(string: "https://render.local"))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var signature: String?

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let host = navigationAction.request.url?.host?.lowercased() else {
                decisionHandler(.cancel)
                return
            }
            let allowed = host == "render.local" || host == "youtube.com" || host.hasSuffix(".youtube.com") || host == "youtube-nocookie.com" || host.hasSuffix(".youtube-nocookie.com")
            decisionHandler(allowed ? .allow : .cancel)
        }
    }
}
