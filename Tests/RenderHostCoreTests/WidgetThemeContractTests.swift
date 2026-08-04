#if canImport(XCTest)
import Foundation
import XCTest
@testable import RenderHostCore

final class WidgetThemeContractTests: XCTestCase {
    func testThemeAwarePatternNodesRoundTripThroughTheNativeContract() throws {
        let tree = WidgetTree(
            kind: .glassPanel,
            children: [
                WidgetTree(
                    kind: .visualizer,
                    provider: "spotify.playback.isPlaying",
                    visualizerMode: "bars",
                    visualizerTempo: 1.2
                )
            ],
            style: WidgetStyle(
                radius: 18,
                material: .thin,
                role: .panel,
                density: .compact,
                tokens: [.surfacePanel, .borderSubtle]
            )
        )

        XCTAssertTrue(tree.validationIssues().isEmpty)
        let data = try JSONEncoder().encode(tree)
        XCTAssertEqual(try JSONDecoder().decode(WidgetTree.self, from: data), tree)
    }

    func testVisualizerRejectsUnsupportedModeAndTempo() {
        let tree = WidgetTree(
            kind: .visualizer,
            visualizerMode: "neon",
            visualizerTempo: 0
        )

        XCTAssertEqual(tree.validationIssues(), [
            WidgetTreeValidationIssue(path: "root.visualizerMode", message: "mode must be bars, waveform, or rings"),
            WidgetTreeValidationIssue(path: "root.visualizerTempo", message: "tempo must be a positive number")
        ])
    }
}
#endif
