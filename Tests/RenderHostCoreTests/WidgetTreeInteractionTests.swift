#if canImport(XCTest)
import Foundation
import XCTest
@testable import RenderHostCore

final class WidgetTreeInteractionTests: XCTestCase {
    func testInteractionAndSliderWireFieldsRoundTrip() throws {
        let data = Data(#"""
        {
          "kind": "column",
          "children": [
            {
              "kind": "button",
              "disabled": true,
              "children": [{
                "kind": "icon",
                "name": "play",
                "style": {
                  "interaction": {
                    "pressed": { "color": "#b6b6b6" }
                  }
                }
              }],
              "action": { "type": "invoke", "name": "widget.refresh" },
              "style": {
                "interaction": {
                  "cursor": "pointer",
                  "hover": { "backgroundColor": "#262626" },
                  "pressed": {
                    "backgroundColor": "#141414",
                    "opacity": 0.8,
                    "scale": 0.98,
                    "borderColor": "#ffffff",
                    "shadow": {
                      "color": "#000000",
                      "radius": 4,
                      "y": 2,
                      "opacity": 0.3,
                      "kind": "inset"
                    }
                  }
                }
              }
            },
            {
              "kind": "slider",
              "value": 38,
              "minimum": 0,
              "maximum": 100,
              "step": 1,
              "state": { "key": "level", "initial": 38 }
            }
          ]
        }
        """#.utf8)

        let tree = try JSONDecoder().decode(WidgetTree.self, from: data)

        XCTAssertEqual(tree.children[0].disabled, true)
        XCTAssertEqual(tree.children[0].style?.interaction?.cursor, .pointer)
        XCTAssertEqual(tree.children[0].style?.interaction?.pressed?.scale, 0.98)
        XCTAssertEqual(tree.children[0].children[0].style?.interaction?.pressed?.color, "#b6b6b6")
        XCTAssertEqual(tree.children[1].kind, .slider)
        XCTAssertEqual(tree.children[1].minimum, 0)
        XCTAssertEqual(tree.children[1].maximum, 100)
        XCTAssertEqual(tree.children[1].step, 1)
        XCTAssertTrue(tree.validationIssues().isEmpty)

        let encoded = try JSONEncoder().encode(tree)
        XCTAssertEqual(try JSONDecoder().decode(WidgetTree.self, from: encoded), tree)
    }

    func testSliderAndInteractionValidationAreActionable() {
        let slider = WidgetTree(kind: .slider, value: 5, minimum: 10, maximum: 2, step: 0)
        let issues = slider.validationIssues()

        XCTAssertTrue(issues.contains { $0.path == "root.maximum" && $0.message.contains("greater than minimum") })
        XCTAssertTrue(issues.contains { $0.path == "root.step" && $0.message.contains("greater than zero") })
    }
}
#endif
