#if canImport(XCTest)
import XCTest
@testable import RenderHostCore

final class RestartPolicyTests: XCTestCase {
    func testFirstFourFailuresRemainQuietAndFifthBecomesVisible() {
        var policy = RestartPolicy()

        for count in 1..<RestartPolicy.userVisibleFailureThreshold {
            XCTAssertEqual(policy.recordFailure(), .retry(consecutiveFailures: count))
        }
        XCTAssertEqual(
            policy.recordFailure(),
            .userVisibleFailure(consecutiveFailures: RestartPolicy.userVisibleFailureThreshold)
        )
    }

    func testSuccessfulRecoveryResetsTheFailureCount() {
        var policy = RestartPolicy()

        _ = policy.recordFailure()
        _ = policy.recordFailure()
        policy.recordSuccess()

        XCTAssertEqual(policy.recordFailure(), .retry(consecutiveFailures: 1))
    }
}
#endif
