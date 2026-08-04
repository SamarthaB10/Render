#if canImport(XCTest)
import Foundation
import XCTest
@testable import RenderHostCore

final class WidgetStatePersistenceTests: XCTestCase {
    func testStateSnapshotRoundTripsJSONValues() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("render-state-\(UUID().uuidString)")
            .appendingPathComponent("state.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        let values: [String: WidgetJSONValue] = [
            "title": .string("Saved"),
            "completed": .boolean(true),
            "progress": .number(75),
            "metadata": .object(["source": .string("test")])
        ]

        try WidgetStatePersistence.save(values, to: url)

        XCTAssertEqual(WidgetStatePersistence.load(from: url).values, values)
    }

    func testInvalidOrUnknownStateSnapshotsResetToEmptyState() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("render-state-\(UUID().uuidString)")
            .appendingPathComponent("state.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(#"{"schemaVersion":99,"values":{"done":true}}"#.utf8).write(to: url)

        let loaded = WidgetStatePersistence.load(from: url)
        XCTAssertEqual(loaded.values, [:])
        XCTAssertNotNil(loaded.issue)
    }

    func testStateReferenceRoundTripsOnWidgetTree() throws {
        let tree = WidgetTree(
            kind: .toggle,
            value: 0,
            state: WidgetStateReference(key: "completed", initial: .boolean(false))
        )

        let data = try JSONEncoder().encode(tree)
        let decoded = try JSONDecoder().decode(WidgetTree.self, from: data)

        XCTAssertEqual(decoded, tree)
        XCTAssertTrue(decoded.validationIssues().isEmpty)
    }

    func testTreeValidationChecksStateValueTypesAtTheNativeBoundary() {
        let text = WidgetTree(
            kind: .text,
            state: WidgetStateReference(key: "title", initial: .array([]))
        )
        let progress = WidgetTree(
            kind: .progress,
            value: 0,
            maximum: 100,
            state: WidgetStateReference(key: "progress", initial: .string("75"))
        )

        let issues = text.validationIssues() + progress.validationIssues()

        XCTAssertTrue(issues.contains(.init(
            path: "root.state.initial",
            message: "text state must be a string, number, or boolean"
        )))
        XCTAssertTrue(issues.contains(.init(
            path: "root.state.initial",
            message: "progress state must start as a finite number"
        )))
    }

    func testWorkerRenderRequestCarriesPersistedState() throws {
        let message = WorkerMessage(
            kind: .render,
            messageID: "render-1",
            sourcePath: "/tmp/widget.tsx",
            state: ["completed": .boolean(true)]
        )

        let data = try JSONEncoder().encode(message)
        let decoded = try JSONDecoder().decode(WorkerMessage.self, from: data)

        XCTAssertEqual(decoded.state, ["completed": .boolean(true)])
        XCTAssertTrue(decoded.validationIssues().isEmpty)
    }
}
#endif
