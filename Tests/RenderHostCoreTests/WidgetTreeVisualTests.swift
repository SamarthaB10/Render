#if canImport(XCTest)
import Foundation
import XCTest
@testable import RenderHostCore

final class WidgetTreeVisualTests: XCTestCase {
    func testExpandedStyleWireContractDecodesAndRoundTrips() throws {
        let data = Data(#"""
        {"kind":"text","text":"1234","style":{
          "width":{"unit":"percent","value":75},"height":"auto",
          "minWidth":120,"maxWidth":"fill","aspectRatio":1.5,
          "flexGrow":1,"flexShrink":0,"flexBasis":{"unit":"fraction","value":2},
          "flexWrap":"wrap","alignSelf":"trailing","overflow":"clip",
          "padding":{"horizontal":12,"vertical":8,"left":16},
          "margin":{"top":-4},
          "radius":{"topLeft":4,"topRight":8,"bottomRight":12,"bottomLeft":16},
          "font":{"size":14,"leading":3,"tracking":0.5,"alignment":"center","lineLimit":2,"tabularNumbers":true,"truncation":"middle"},
          "shadows":[{"kind":"inset","color":"#000000","radius":3},{"kind":"text","x":1,"y":1}]
        }}
        """#.utf8)

        let tree = try JSONDecoder().decode(WidgetTree.self, from: data)
        XCTAssertEqual(tree.style?.width, .percent(75))
        XCTAssertEqual(tree.style?.height, .auto)
        XCTAssertEqual(tree.style?.flexBasis, .fraction(2))
        XCTAssertEqual(tree.style?.padding, .insets(WidgetInsets(left: 16, horizontal: 12, vertical: 8)))
        XCTAssertEqual(tree.style?.radius, .corners(WidgetCornerRadii(topLeft: 4, topRight: 8, bottomRight: 12, bottomLeft: 16)))
        XCTAssertEqual(tree.style?.font?.tabularNumbers, true)
        XCTAssertEqual(tree.style?.shadows?.map(\.kind), ["inset", "text"])
        XCTAssertTrue(tree.validationIssues().isEmpty)

        let roundTrip = try JSONDecoder().decode(WidgetTree.self, from: JSONEncoder().encode(tree))
        XCTAssertEqual(roundTrip, tree)
    }

    func testVisualNodesRoundTripWithContractFields() throws {
        let animation = WidgetAnimation(
            property: "opacity",
            from: 0,
            to: 1,
            duration: 240,
            delay: 40,
            repeat: .forever,
            easing: "easeInOut"
        )
        let tree = WidgetTree(
            kind: .column,
            children: [
                WidgetTree(
                    kind: .gradient,
                    gradientStops: [
                        WidgetGradientStop(color: "#101820", position: 0),
                        WidgetGradientStop(color: "#304050", position: 1)
                    ],
                    gradientDirection: "horizontal",
                    animation: animation
                ),
                WidgetTree(
                    kind: .texture,
                    textureSource: .builtIn(name: "grain")
                ),
                WidgetTree(
                    kind: .transform,
                    children: [WidgetTree(kind: .text, text: "Transformed")],
                    transform: WidgetTransform(offsetX: 4, offsetY: -2, scale: 1.25, rotation: 15)
                ),
                WidgetTree(kind: .segmentedProgress, value: 3, maximum: 10, segments: 5),
                WidgetTree(kind: .spectrum, values: [0.2, 0.5, 0.8]),
                WidgetTree(
                    kind: .image,
                    source: .asset(name: "album-art"),
                    imageFit: .cover,
                    imageRepeat: .both,
                    imagePosition: "center",
                    tint: "#ffffff"
                )
            ]
        )

        let data = try JSONEncoder().encode(tree)
        let decoded = try JSONDecoder().decode(WidgetTree.self, from: data)

        XCTAssertEqual(decoded, tree)
        XCTAssertTrue(decoded.validationIssues().isEmpty)

        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        let children = try XCTUnwrap(json["children"] as? [[String: Any]])
        let textureSource = try XCTUnwrap(children[1]["source"] as? [String: Any])
        XCTAssertEqual(textureSource["kind"] as? String, "builtin")
        XCTAssertEqual(textureSource["name"] as? String, "grain")
        let imageOptions = try XCTUnwrap(children[5]["options"] as? [String: Any])
        XCTAssertEqual(imageOptions["fit"] as? String, "cover")
        XCTAssertEqual(imageOptions["repeat"] as? String, "both")
    }

    func testExistingTreeJSONStillDecodesWithNewFieldsAbsent() throws {
        let data = Data(#"{"kind":"image","source":{"kind":"asset","name":"legacy-art"}}"#.utf8)

        let tree = try JSONDecoder().decode(WidgetTree.self, from: data)

        XCTAssertEqual(tree.kind, .image)
        XCTAssertEqual(tree.source, .asset(name: "legacy-art"))
        XCTAssertNil(tree.gradientStops)
        XCTAssertNil(tree.textureSource)
        XCTAssertNil(tree.transform)
        XCTAssertNil(tree.animation)
        XCTAssertTrue(tree.validationIssues().isEmpty)
    }

    func testWorkerWireKeysDecodeVisualNodes() throws {
        let data = Data(#"""
        {
          "kind":"column",
          "children":[
            {"kind":"gradient","stops":[{"color":"#000000","position":0},{"color":"#ffffff","position":1}]},
            {"kind":"texture","source":{"kind":"builtin","name":"grain"}},
            {"kind":"image","source":{"kind":"asset","name":"cover"},"options":{"fit":"cover","repeat":"none","position":"center","tint":"#ffffff"}},
            {"kind":"text","text":"animated","animation":{"property":"opacity","from":0.2,"to":1,"duration":600,"repeat":2}}
          ]
        }
        """#.utf8)

        let tree = try JSONDecoder().decode(WidgetTree.self, from: data)

        XCTAssertEqual(tree.children[0].gradientStops?.count, 2)
        XCTAssertEqual(tree.children[1].textureSource, .builtIn(name: "grain"))
        XCTAssertEqual(tree.children[2].options?.fit, .cover)
        XCTAssertEqual(tree.children[3].animation?.duration, 600)
        XCTAssertEqual(tree.children[3].animation?.repeat, .count(2))
        XCTAssertTrue(tree.validationIssues().isEmpty)
    }

    func testValidationHandlesDeepWidgetTreesWithoutRecursiveStackGrowth() {
        var tree = WidgetTree(kind: .text, text: "leaf")
        for _ in 0..<128 {
            tree = WidgetTree(kind: .box, children: [tree])
        }

        XCTAssertTrue(tree.validationIssues().isEmpty)
    }

    func testVisualValidationReportsActionablePaths() {
        let tree = WidgetTree(
            kind: .column,
            children: [
                WidgetTree(
                    kind: .gradient,
                    gradientStops: [WidgetGradientStop(color: "", position: 1.5)],
                    gradientDirection: "",
            animation: WidgetAnimation(property: "", from: 0, to: 1, duration: 0, delay: -1, repeat: .count(0), easing: "")
                ),
                WidgetTree(kind: .texture, textureSource: .asset(name: "")),
                WidgetTree(kind: .transform, transform: WidgetTransform(scale: 0)),
                WidgetTree(kind: .segmentedProgress, value: 4, maximum: 10, segments: 0),
                WidgetTree(kind: .spectrum, values: []),
                WidgetTree(
                    kind: .image,
                    source: .asset(name: ""),
                    imagePosition: "",
                    tint: ""
                )
            ]
        )

        let issues = tree.validationIssues()

        assertIssue(issues, path: "root.children[0].gradientStops[0].color", containing: "non-empty")
        assertIssue(issues, path: "root.children[0].gradientStops[0].position", containing: "between zero and one")
        assertIssue(issues, path: "root.children[0].gradientDirection", containing: "non-empty")
        assertIssue(issues, path: "root.children[0].animation.property", containing: "non-empty")
        assertIssue(issues, path: "root.children[0].animation.duration", containing: "greater than zero")
        assertIssue(issues, path: "root.children[0].animation.delay", containing: "zero or greater")
        assertIssue(issues, path: "root.children[0].animation.easing", containing: "non-empty")
        assertIssue(issues, path: "root.children[1].textureSource.name", containing: "non-empty")
        assertIssue(issues, path: "root.children[2].transform.scale", containing: "greater than zero")
        assertIssue(issues, path: "root.children[3].segments", containing: "positive segment count")
        assertIssue(issues, path: "root.children[4].values", containing: "non-empty")
        assertIssue(issues, path: "root.children[5].source.name", containing: "non-empty")
        assertIssue(issues, path: "root.children[5].imagePosition", containing: "non-empty")
        assertIssue(issues, path: "root.children[5].tint", containing: "non-empty")
    }

    private func assertIssue(
        _ issues: [WidgetTreeValidationIssue],
        path: String,
        containing message: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertTrue(
            issues.contains { $0.path == path && $0.message.contains(message) },
            "Expected validation issue at \(path) containing \(message), got \(issues)",
            file: file,
            line: line
        )
    }
}

#endif
