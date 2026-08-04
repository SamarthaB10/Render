#if canImport(XCTest)
import XCTest
@testable import RenderHostCore

final class WidgetContractTests: XCTestCase {
    func testNativeNodeKindsMatchTheCanonicalContract() {
        XCTAssertEqual(
            Set(WidgetNodeKind.allCases.map(\.rawValue)),
            RenderWidgetContract.nodeKinds
        )
        XCTAssertEqual(RenderWidgetContract.version, 1)
    }
}
#endif
