#if canImport(XCTest)
import Foundation
import AppKit
import XCTest
@testable import RenderHostCore

final class DesktopWindowPolicyTests: XCTestCase {
    func testDefaultPolicyMatchesFirstPrototype() throws {
        let policy = DesktopWindowPolicy()

        XCTAssertEqual(policy.level, .desktop)
        XCTAssertEqual(policy.anchor, .topLeft)
        XCTAssertEqual(policy.offsetX, 24)
        XCTAssertEqual(policy.offsetY, 24)
        XCTAssertFalse(policy.ignoresMouseEvents)
        XCTAssertTrue(policy.joinsAllSpaces)
    }

    func testInteractiveWidgetLayerIsAboveFinderDesktopButBelowNormalWindows() {
        XCTAssertGreaterThan(
            DesktopWindowLevel.interactive,
            Int(CGWindowLevelForKey(.desktopIconWindow))
        )
        XCTAssertLessThan(
            DesktopWindowLevel.interactive,
            Int(CGWindowLevelForKey(.normalWindow))
        )
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

    func testProviderLoadingStateIsExplicit() {
        XCTAssertEqual(
            ProviderValue.loading(name: "system.cpu"),
            ProviderValue(name: "system.cpu", state: .loading, message: "waiting for provider")
        )
    }

    func testRuntimeProtocolRejectsMissingRenderPayload() {
        let message = RuntimeMessage(kind: .render, messageID: "message-1", widgetID: "widget-1")

        XCTAssertEqual(
            message.validationIssues(),
            [.init(path: "tree", message: "render messages require a tree")]
        )
    }

    func testWorkerHelloRequiresSupportedVersions() {
        let message = WorkerMessage(kind: .hello, messageID: "hello-1", workerID: "worker-1")

        XCTAssertEqual(
            message.validationIssues(),
            [.init(path: "supportedVersions", message: "hello messages require at least one supported protocol version")]
        )
    }

    func testWorkerHelloAckRejectsUnsupportedSelection() {
        let message = WorkerMessage(
            kind: .helloAck,
            messageID: "ack-1",
            workerID: "supervisor",
            selectedVersion: 99
        )

        XCTAssertEqual(
            message.validationIssues(),
            [.init(path: "selectedVersion", message: "helloAck must select the current worker protocol version")]
        )
    }

    func testWorkerFailureRequiresActionableDiagnostics() {
        let message = WorkerMessage(
            kind: .failure,
            messageID: "failure-1",
            workerID: "worker-1",
            diagnostics: []
        )

        XCTAssertEqual(
            message.validationIssues(),
            [.init(path: "diagnostics", message: "failure messages require diagnostics")]
        )
    }

    func testWorkerRenderRequestAcceptsASourcePath() {
        let message = WorkerMessage(
            kind: .render,
            messageID: "render-1",
            workerID: "supervisor",
            sourcePath: "/tmp/widget.tsx"
        )

        XCTAssertTrue(message.validationIssues().isEmpty)
    }

    func testTreeDecodesLeafWithoutChildrenField() throws {
        let data = Data(#"{"kind":"text","text":"CPU"}"#.utf8)

        let tree = try JSONDecoder().decode(WidgetTree.self, from: data)

        XCTAssertEqual(tree.children, [])
        XCTAssertEqual(tree.text, "CPU")
    }

    func testPhaseNineTreeDecodesStylesActionsAndKeyTypes() throws {
        let data = Data(#"""
          "kind": "button",
          "key": 7,
          "children": [{ "kind": "icon", "name": "play.fill" }],
          "style": {
            "backgroundColor": "#1565c0",
            "padding": { "top": 8, "left": 12 },
            "font": { "size": 14, "weight": "semibold" }
          },
          "action": { "type": "invoke", "name": "widget.refresh", "payload": { "source": "widget" } }
        }
        """#.utf8)

        let tree = try JSONDecoder().decode(WidgetTree.self, from: data)

        XCTAssertEqual(tree.key, .number(7))
        XCTAssertEqual(tree.children.first?.kind, .icon)
        XCTAssertEqual(tree.action, .invoke(name: "widget.refresh", payload: .object(["source": .string("widget")])))
        XCTAssertTrue(tree.validationIssues().isEmpty)
    }

    func testPhaseNineValidationUsesActionablePaths() {
        let tree = WidgetTree(
            kind: .button,
            action: .invoke(name: "", payload: nil),
            children: [WidgetTree(kind: .icon)]
        )

        XCTAssertEqual(
            tree.validationIssues(),
            [
                .init(path: "root.action.name", message: "action name must be non-empty"),
                .init(path: "root.children[0].name", message: "icon nodes require a non-empty symbol name")
            ]
        )
    }

    func testActionRoundTripsAsSerializableData() throws {
        let action = WidgetAction.set(name: "widget.mode", value: .string("compact"))
        let data = try JSONEncoder().encode(action)

        XCTAssertEqual(try JSONDecoder().decode(WidgetAction.self, from: data), action)
    }

    func testWidgetPlacementRoundTripsAsSerializableData() throws {
        let placement = WidgetPlacement(screenID: 123, originX: 480, originY: 720)
        let data = try JSONEncoder().encode(placement)

        XCTAssertEqual(try JSONDecoder().decode(WidgetPlacement.self, from: data), placement)
    }
}

#endif
