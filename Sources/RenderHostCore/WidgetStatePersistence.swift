import Foundation

public struct WidgetStateSnapshot: Codable, Equatable, Sendable {
    public static let currentSchemaVersion = 1

    public let schemaVersion: Int
    public let values: [String: WidgetJSONValue]

    public init(
        schemaVersion: Int = WidgetStateSnapshot.currentSchemaVersion,
        values: [String: WidgetJSONValue]
    ) {
        self.schemaVersion = schemaVersion
        self.values = values
    }
}

public struct WidgetStateLoadResult: Equatable, Sendable {
    public let values: [String: WidgetJSONValue]
    public let issue: String?

    public init(values: [String: WidgetJSONValue], issue: String? = nil) {
        self.values = values
        self.issue = issue
    }
}

public enum WidgetStatePersistence {
    public static func load(from url: URL) -> WidgetStateLoadResult {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return WidgetStateLoadResult(values: [:])
        }
        do {
            let data = try Data(contentsOf: url)
            let snapshot = try JSONDecoder().decode(WidgetStateSnapshot.self, from: data)
            guard snapshot.schemaVersion == WidgetStateSnapshot.currentSchemaVersion else {
                return WidgetStateLoadResult(
                    values: [:],
                    issue: "unsupported schema version \(snapshot.schemaVersion); expected \(WidgetStateSnapshot.currentSchemaVersion)"
                )
            }
            return WidgetStateLoadResult(values: snapshot.values)
        } catch {
            return WidgetStateLoadResult(values: [:], issue: error.localizedDescription)
        }
    }

    public static func save(_ values: [String: WidgetJSONValue], to url: URL) throws {
        let snapshot = WidgetStateSnapshot(values: values)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(snapshot)
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: url, options: .atomic)
    }
}
