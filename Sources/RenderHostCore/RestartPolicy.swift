import Foundation

public enum RestartDecision: Equatable, Sendable {
    case retry(consecutiveFailures: Int)
    case userVisibleFailure(consecutiveFailures: Int)
}

public struct RestartPolicy: Equatable, Sendable {
    public static let userVisibleFailureThreshold = 5

    public private(set) var consecutiveFailures = 0

    public init() {}

    public mutating func recordFailure() -> RestartDecision {
        consecutiveFailures += 1
        if consecutiveFailures >= Self.userVisibleFailureThreshold {
            return .userVisibleFailure(consecutiveFailures: consecutiveFailures)
        }
        return .retry(consecutiveFailures: consecutiveFailures)
    }

    public mutating func recordSuccess() {
        consecutiveFailures = 0
    }
}
