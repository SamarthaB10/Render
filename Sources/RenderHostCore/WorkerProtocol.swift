public enum WorkerMessageKind: String, Codable, Sendable {
    case hello
    case helloAck
    case ready
    case render
    case failure
    case shutdown
}

public struct WorkerDiagnostic: Codable, Equatable, Sendable {
    public let code: String
    public let path: String
    public let message: String

    public init(code: String, path: String, message: String) {
        self.code = code
        self.path = path
        self.message = message
    }
}

public struct WorkerMessage: Codable, Equatable, Sendable {
    public static let currentProtocolVersion = 1

    public let protocolVersion: Int
    public let kind: WorkerMessageKind
    public let messageID: String
    public let workerID: String
    public let supportedVersions: [Int]?
    public let selectedVersion: Int?
    public let workspace: String?
    public let sourcePath: String?
    public let tree: WidgetTree?
    public let diagnostics: [WorkerDiagnostic]?

    public init(
        kind: WorkerMessageKind,
        messageID: String,
        workerID: String = "supervisor",
        supportedVersions: [Int]? = nil,
        selectedVersion: Int? = nil,
        workspace: String? = nil,
        sourcePath: String? = nil,
        tree: WidgetTree? = nil,
        diagnostics: [WorkerDiagnostic]? = nil,
        protocolVersion: Int = WorkerMessage.currentProtocolVersion
    ) {
        self.protocolVersion = protocolVersion
        self.kind = kind
        self.messageID = messageID
        self.workerID = workerID
        self.supportedVersions = supportedVersions
        self.selectedVersion = selectedVersion
        self.workspace = workspace
        self.sourcePath = sourcePath
        self.tree = tree
        self.diagnostics = diagnostics
    }

    public func validationIssues() -> [RuntimeProtocolIssue] {
        var issues: [RuntimeProtocolIssue] = []
        if protocolVersion != Self.currentProtocolVersion {
            issues.append(.init(path: "protocolVersion", message: "unsupported worker protocol version"))
        }
        if messageID.isEmpty {
            issues.append(.init(path: "messageID", message: "messageID must be non-empty"))
        }
        if workerID.isEmpty {
            issues.append(.init(path: "workerID", message: "workerID must be non-empty"))
        }
        if kind == .hello && supportedVersions?.isEmpty != false {
            issues.append(.init(path: "supportedVersions", message: "hello messages require at least one supported protocol version"))
        }
        if kind == .helloAck && selectedVersion != Self.currentProtocolVersion {
            issues.append(.init(path: "selectedVersion", message: "helloAck must select the current worker protocol version"))
        }
        let hasSourcePath = sourcePath?.isEmpty == false
        if kind == .render && tree == nil && diagnostics == nil && !hasSourcePath {
            issues.append(.init(path: "sourcePath", message: "render requests require sourcePath; render responses require a tree or diagnostics"))
        }
        if kind == .failure && diagnostics?.isEmpty != false {
            issues.append(.init(path: "diagnostics", message: "failure messages require diagnostics"))
        }
        return issues
    }
}
