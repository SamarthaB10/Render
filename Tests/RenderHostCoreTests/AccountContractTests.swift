 #if canImport(XCTest)
import Foundation
import XCTest
@testable import RenderHostCore

final class AccountContractTests: XCTestCase {
    func testAccountRequirementValidatesConnectorAndScopesShape() {
        let requirement = WidgetAccountRequirement(
            connector: "spotify",
            scopes: ["user-read-playback-state", "user-modify-playback-state"]
        )

        XCTAssertTrue(requirement.validationIssues().isEmpty)
    }

    func testAccountStatusIsSerializableWithoutCredentialFields() throws {
        let status = AccountStatus(
            connector: "spotify",
            state: .needsAuthorization,
            scopes: ["user-read-playback-state"],
            displayName: nil,
            message: "Connect Spotify to continue"
        )

        let data = try JSONEncoder().encode(status)
        let json = String(decoding: data, as: UTF8.self)

        XCTAssertFalse(json.contains("accessToken"))
        XCTAssertFalse(json.contains("refreshToken"))
        XCTAssertTrue(json.contains("needs-authorization"))
    }

    func testAuthStateMachineKeepsPermissionStatesExplicit() {
        let machine = AccountAuthStateMachine(connector: "spotify")

        XCTAssertEqual(machine.status.state, .needsAuthorization)
        machine.markDenied(message: "User cancelled authorization")
        XCTAssertEqual(machine.status.state, .denied)
        machine.markConnected(displayName: "Samartha")
        XCTAssertEqual(machine.status.state, .connected)
        machine.markExpired(message: "Spotify token expired")
        XCTAssertEqual(machine.status.state, .expired)
    }
}

#endif
