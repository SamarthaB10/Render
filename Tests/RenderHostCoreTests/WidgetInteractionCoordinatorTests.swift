#if canImport(XCTest)
import SwiftUI
import XCTest
@testable import RenderHost

final class WidgetInteractionCoordinatorTests: XCTestCase {
    func testTracksOverlappingInteractiveHoverRegions() {
        let coordinator = WidgetInteractionCoordinator()
        let first = UUID()
        let second = UUID()

        coordinator.setHovered(true, controlID: first)
        coordinator.setHovered(true, controlID: second)
        coordinator.setHovered(false, controlID: first)

        XCTAssertTrue(coordinator.isPointerOverControl)

        coordinator.setHovered(false, controlID: second)
        XCTAssertFalse(coordinator.isPointerOverControl)
    }

    @MainActor
    func testHostingViewUsesManualDragInsteadOfWindowBackgroundDrag() {
        let view = DraggableHostingView(rootView: AnyView(EmptyView()))

        XCTAssertFalse(view.mouseDownCanMoveWindow)
    }
}
#endif
