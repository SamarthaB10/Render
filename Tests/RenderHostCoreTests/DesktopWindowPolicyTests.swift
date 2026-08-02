#if canImport(XCTest)
import Foundation
import XCTest
@testable import RenderHostCore

final class DesktopWindowPolicyTests: XCTestCase {
    func testDefaultPolicyMatchesFirstPrototype() throws {
        let policy = DesktopWindowPolicy()

        XCTAssertEqual(policy.level, .desktop)
        XCTAssertEqual(policy.anchor, .topLeft)
        XCTAssertEqual(policy.offsetX, 24)
        XCTAssertEqual(policy.offsetY, 24)
        XCTAssertTrue(policy.ignoresMouseEvents)
        XCTAssertTrue(policy.joinsAllSpaces)
    }

    func testPolicyRoundTripsAsSerializableData() throws {
        let policy = DesktopWindowPolicy(offsetX: 48, offsetY: 16, ignoresMouseEvents: false)
        let data = try JSONEncoder().encode(policy)
        let decoded = try JSONDecoder().decode(DesktopWindowPolicy.self, from: data)

        XCTAssertEqual(decoded, policy)
    }

    func testInvalidTreeReportsActionablePaths() {
        let tree = WidgetTree(
            kind: .column,
            children: [WidgetTree(kind: .text, style: WidgetStyle(width: 0))],
            text: "not allowed"
        )

        XCTAssertEqual(
            tree.validationIssues(),
            [
                .init(path: "root", message: "container nodes cannot define text"),
                .init(path: "root.children[0]", message: "text nodes require non-empty text or a provider"),
                .init(path: "root.children[0].style.width", message: "width must be greater than zero")
            ]
        )
    }

    func testProviderUnavailableStateIsExplicit() {
        XCTAssertEqual(
            ProviderValue.unavailable(name: "system.cpu", message: "sampling unavailable"),
            ProviderValue(name: "system.cpu", state: .unavailable, message: "sampling unavailable")
        )
    }

    func testRuntimeProtocolRejectsMissingRenderPayload() {
        let message = RuntimeMessage(kind: .render, messageID: "message-1", widgetID: "widget-1")

        XCTAssertEqual(
            message.validationIssues(),
            [.init(path: "tree", message: "render messages require a tree")]
        )
    }

    func testTreeDecodesLeafWithoutChildrenField() throws {
        let data = Data(#"{"kind":"text","text":"CPU"}"#.utf8)

        let tree = try JSONDecoder().decode(WidgetTree.self, from: data)

        XCTAssertEqual(tree.children, [])
        XCTAssertEqual(tree.text, "CPU")
    }
}
#endif
