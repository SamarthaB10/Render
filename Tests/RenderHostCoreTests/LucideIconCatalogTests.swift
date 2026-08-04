#if canImport(XCTest)
import XCTest
@testable import RenderHost

final class LucideIconCatalogTests: XCTestCase {
    func testPinnedCatalogResolvesBroadNamesAndCompatibilityAliases() {
        XCTAssertNotNil(LucideIconCatalog.scalar(for: "activity"))
        XCTAssertNotNil(LucideIconCatalog.scalar(for: "badge-check"))
        XCTAssertNotNil(LucideIconCatalog.scalar(for: "github"))
        XCTAssertEqual(LucideIconCatalog.codePoint(for: "play.fill"), LucideIconCatalog.codePoint(for: "play"))
        XCTAssertNil(LucideIconCatalog.scalar(for: "host-only-symbol"))
    }
}
#endif
