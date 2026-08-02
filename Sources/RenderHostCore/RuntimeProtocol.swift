public enum RuntimeMessageKind: String, Codable, Sendable {
    case hello
    case render
    case providers
    case failure
    case shutdown
}

public struct RuntimeProtocolIssue: Codable, Equatable, Sendable {
    public let path: String
    public let message: String

    public init(path: String, message: String) {
        self.path = path
        self.message = message
    }
}

public struct RuntimeMessage: Codable, Equatable, Sendable {
    public static let currentProtocolVersion = 1

    public let protocolVersion: Int
    public let kind: RuntimeMessageKind
    public let messageID: String
    public let widgetID: String
    public let tree: WidgetTree?
    public let providers: ProviderSnapshot?
    public let diagnostics: [RuntimeProtocolIssue]?

    public init(
        kind: RuntimeMessageKind,
        messageID: String,
        widgetID: String,
        tree: WidgetTree? = nil,
        providers: ProviderSnapshot? = nil,
        diagnostics: [RuntimeProtocolIssue]? = nil,
        protocolVersion: Int = RuntimeMessage.currentProtocolVersion
    ) {
        self.protocolVersion = protocolVersion
        self.kind = kind
        self.messageID = messageID
        self.widgetID = widgetID
        self.tree = tree
        self.providers = providers
        self.diagnostics = diagnostics
    }

    public func validationIssues() -> [RuntimeProtocolIssue] {
        var issues: [RuntimeProtocolIssue] = []
        if protocolVersion != Self.currentProtocolVersion {
            issues.append(.init(path: "protocolVersion", message: "unsupported runtime protocol version"))
        }
        if messageID.isEmpty {
            issues.append(.init(path: "messageID", message: "messageID must be non-empty"))
        }
        if widgetID.isEmpty {
            issues.append(.init(path: "widgetID", message: "widgetID must be non-empty"))
        }

        switch kind {
        case .render where tree == nil:
            issues.append(.init(path: "tree", message: "render messages require a tree"))
        case .providers where providers == nil:
            issues.append(.init(path: "providers", message: "provider messages require a snapshot"))
        case .failure where diagnostics?.isEmpty != false:
            issues.append(.init(path: "diagnostics", message: "failure messages require diagnostics"))
        default:
            break
        }
        return issues
    }
}
