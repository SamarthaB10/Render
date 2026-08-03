import Foundation

public enum AccountState: String, Codable, Equatable, Sendable {
    case connected
    case needsAuthorization = "needs-authorization"
    case denied
    case expired
    case revoked
    case unavailable
}

public struct WidgetAccountRequirement: Codable, Equatable, Sendable {
    public let connector: String
    public let scopes: [String]

    public init(connector: String, scopes: [String]) {
        self.connector = connector
        self.scopes = scopes
    }

    public func validationIssues() -> [RuntimeProtocolIssue] {
        var issues: [RuntimeProtocolIssue] = []
        if connector.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            issues.append(.init(path: "connector", message: "connector must be non-empty"))
        }
        if scopes.isEmpty {
            issues.append(.init(path: "scopes", message: "scopes must contain at least one scope"))
        }
        var seen = Set<String>()
        for (index, scope) in scopes.enumerated() {
            if scope.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                issues.append(.init(path: "scopes[\(index)]", message: "scope must be non-empty"))
            }
            if !seen.insert(scope).inserted {
                issues.append(.init(path: "scopes[\(index)]", message: "scope must not be duplicated"))
            }
        }
        return issues
    }
}

/// Deliberately contains only redacted account state. Credentials live in the
/// host keychain and never cross into a widget tree or worker message.
public struct AccountStatus: Codable, Equatable, Sendable {
    public let connector: String
    public let state: AccountState
    public let scopes: [String]
    public let displayName: String?
    public let message: String?

    public init(
        connector: String,
        state: AccountState,
        scopes: [String] = [],
        displayName: String? = nil,
        message: String? = nil
    ) {
        self.connector = connector
        self.state = state
        self.scopes = scopes
        self.displayName = displayName
        self.message = message
    }
}

public final class AccountAuthStateMachine {
    public private(set) var status: AccountStatus

    public init(connector: String, scopes: [String] = []) {
        status = AccountStatus(
            connector: connector,
            state: .needsAuthorization,
            scopes: scopes,
            message: "Authorization is required"
        )
    }

    public func markConnected(displayName: String? = nil) {
        status = AccountStatus(
            connector: status.connector,
            state: .connected,
            scopes: status.scopes,
            displayName: displayName,
            message: nil
        )
    }

    public func markDenied(message: String) {
        update(state: .denied, message: message)
    }

    public func markExpired(message: String) {
        update(state: .expired, message: message)
    }

    public func markRevoked(message: String) {
        update(state: .revoked, message: message)
    }

    public func markUnavailable(message: String) {
        update(state: .unavailable, message: message)
    }

    public func requestAuthorization() {
        update(state: .needsAuthorization, message: "Authorization is required")
    }

    private func update(state: AccountState, message: String) {
        status = AccountStatus(
            connector: status.connector,
            state: state,
            scopes: status.scopes,
            displayName: status.displayName,
            message: message
        )
    }
}
