#if canImport(XCTest)
import XCTest
@testable import RenderHostCore
@testable import RenderHost

final class WidgetContractTests: XCTestCase {
    func testNativeNodeKindsMatchTheCanonicalContract() {
        XCTAssertEqual(
            Set(WidgetNodeKind.allCases.map(\.rawValue)),
            RenderWidgetContract.nodeKinds
        )
        XCTAssertEqual(RenderWidgetContract.version, 1)
    }

    func testNativeWorkerKindsMatchTheCanonicalContract() {
        XCTAssertEqual(
            Set(WorkerMessageKind.allCases.map(\.rawValue)),
            RenderWidgetContract.workerMessageKinds
        )
        XCTAssertEqual(WorkerMessage.currentProtocolVersion, RenderWidgetContract.workerProtocolVersion)
    }

    func testNativeDecoderAcceptsSharedCanonicalFixture() throws {
        let repositoryRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let fixtureURL = repositoryRoot
            .appendingPathComponent("contracts/fixtures/widget-contract.v1.compatibility.json")
        let fixture = try JSONDecoder().decode(
            CompatibilityFixture.self,
            from: Data(contentsOf: fixtureURL)
        )

        XCTAssertEqual(
            Set(fixture.workerMessages.map(\.kind.rawValue)),
            Set(WorkerMessageKind.allCases.map(\.rawValue))
        )
        XCTAssertEqual(fixture.artifact.manifest.schemaVersion, 1)
        XCTAssertEqual(fixture.artifact.manifest.sdkVersion, "0.1.0")
        XCTAssertNotNil(fixture.workerMessages.first(where: { $0.messageID == "response-1" })?.manifest)
        XCTAssertTrue(fixture.workerMessages.flatMap { $0.validationIssues() }.isEmpty)
        XCTAssertEqual(
            fixture.artifact.tree.children.first(where: { $0.kind == .taskList })?.tasks?.first?.completed,
            false
        )
        XCTAssertEqual(
            fixture.artifact.tree.children.first(where: { $0.kind == .list })?.items?.first?.completed,
            false
        )
    }

    func testNativeWorkerValidationRejectsFieldsFromOtherVariants() {
        let diagnostic = WorkerDiagnostic(code: "fixture", path: "worker", message: "invalid")
        let tree = WidgetTree(kind: .text, text: "Hello")
        let invalidMessages = [
            WorkerMessage(kind: .ready, messageID: "ready-1", diagnostics: [diagnostic]),
            WorkerMessage(kind: .shutdown, messageID: "shutdown-1", tree: tree),
            WorkerMessage(kind: .render, messageID: "render-1", sourcePath: "/tmp/widget.tsx", diagnostics: [diagnostic])
        ]

        for (message, forbiddenField) in zip(invalidMessages, ["diagnostics", "tree", "diagnostics"]) {
            XCTAssertTrue(message.validationIssues().contains(where: {
                $0.message.contains("forbid fields: \(forbiddenField)")
            }))
        }
    }

    func testNativeWorkerValidationReportsSemanticAndForbiddenFieldsTogether() {
        let message = WorkerMessage(
            kind: .hello,
            messageID: "hello-1",
            supportedVersions: [],
            tree: WidgetTree(kind: .text, text: "Unexpected")
        )

        XCTAssertTrue(message.validationIssues().contains(where: { $0.path == "supportedVersions" }))
        XCTAssertTrue(message.validationIssues().contains(where: { $0.message.contains("forbid fields: tree") }))
    }

    private struct CompatibilityFixture: Decodable {
        let artifact: Artifact
        let workerMessages: [WorkerMessage]

        struct Artifact: Decodable {
            let manifest: RuntimeManifest
            let tree: WidgetTree
        }
    }
}
#endif
