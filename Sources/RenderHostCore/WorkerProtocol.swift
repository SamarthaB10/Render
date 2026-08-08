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

public struct WorkerRenderSize: Codable, Equatable, Sendable {
    public let width: Double
    public let height: Double

    public init(width: Double, height: Double) {
        self.width = width
        self.height = height
    }
}

public struct WorkerMessage: Codable, Equatable, Sendable {
    public static let currentProtocolVersion = RenderWidgetContract.workerProtocolVersion

    public let protocolVersion: Int
    public let kind: WorkerMessageKind
    public let messageID: String
    public let workerID: String
    public let supportedVersions: [Int]?
    public let selectedVersion: Int?
    public let workspace: String?
    public let sourcePath: String?
    public let state: [String: WidgetJSONValue]?
    public let mode: String?
    public let size: WorkerRenderSize?
    public let tree: WidgetTree?
    public let manifest: WidgetJSONValue?
    public let diagnostics: [WorkerDiagnostic]?

    public init(
        kind: WorkerMessageKind,
        messageID: String,
        workerID: String = "supervisor",
        supportedVersions: [Int]? = nil,
        selectedVersion: Int? = nil,
        workspace: String? = nil,
        sourcePath: String? = nil,
        state: [String: WidgetJSONValue]? = nil,
        mode: String? = nil,
        size: WorkerRenderSize? = nil,
        tree: WidgetTree? = nil,
        manifest: WidgetJSONValue? = nil,
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
        self.state = state
        self.mode = mode
        self.size = size
        self.tree = tree
        self.manifest = manifest
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
        let kindIssueStart = issues.count
        if kind == .hello && supportedVersions?.isEmpty != false {
            issues.append(.init(path: "supportedVersions", message: "hello messages require at least one supported protocol version"))
        }
        if kind == .helloAck && selectedVersion != Self.currentProtocolVersion {
            issues.append(.init(path: "selectedVersion", message: "helloAck must select the current worker protocol version"))
        }
        if kind == .render {
            let isRequest = sourcePath?.isEmpty == false && tree == nil && manifest == nil
            let isResponse = sourcePath == nil && tree != nil && manifest != nil
            if !isRequest && !isResponse {
                issues.append(.init(
                    path: "render",
                    message: "render messages must be a sourcePath request or a tree and manifest response"
                ))
            }
        }
        if kind == .failure && diagnostics?.isEmpty != false {
            issues.append(.init(path: "diagnostics", message: "failure messages require diagnostics"))
        }
        if let manifest {
            if case .object = manifest {} else {
                issues.append(.init(path: "manifest", message: "worker manifests must be objects"))
            }
        }
        let shapeStatus = canonicalShapeStatus()
        if !shapeStatus.unexpectedFields.isEmpty {
            issues.append(.init(
                path: "kind",
                message: "canonical \(kind.rawValue) messages forbid fields: \(shapeStatus.unexpectedFields.sorted().joined(separator: ", "))"
            ))
        } else if issues.count == kindIssueStart && !shapeStatus.matches {
            issues.append(.init(
                path: "kind",
                message: "worker message fields do not match the canonical \(kind.rawValue) shape"
            ))
        }
        return issues
    }

    private func canonicalShapeStatus() -> (matches: Bool, unexpectedFields: Set<String>) {
        var fields: Set<String> = ["protocolVersion", "kind", "messageID", "workerID"]
        if supportedVersions != nil { fields.insert("supportedVersions") }
        if selectedVersion != nil { fields.insert("selectedVersion") }
        if workspace != nil { fields.insert("workspace") }
        if sourcePath != nil { fields.insert("sourcePath") }
        if state != nil { fields.insert("state") }
        if mode != nil { fields.insert("mode") }
        if size != nil { fields.insert("size") }
        if tree != nil { fields.insert("tree") }
        if manifest != nil { fields.insert("manifest") }
        if diagnostics != nil { fields.insert("diagnostics") }
        let shapes = RenderWidgetContract.workerMessageShapes[kind.rawValue] ?? []
        let allowedFields = shapes.reduce(into: Set<String>()) { result, shape in
            result.formUnion(shape.allowedFields)
        }
        let matches = shapes.contains(where: { shape in
            shape.requiredFields.isSubset(of: fields) && fields.isSubset(of: shape.allowedFields)
        })
        return (matches, fields.subtracting(allowedFields))
    }
}
