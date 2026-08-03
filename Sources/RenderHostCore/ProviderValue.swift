public enum ProviderState: String, Codable, Equatable, Sendable {
    case loading
    case available
    case unavailable
}

public struct ProviderValue: Codable, Equatable, Sendable {
    public let name: String
    public let state: ProviderState
    public let value: Double?
    public let message: String?

    public init(name: String, state: ProviderState, value: Double? = nil, message: String? = nil) {
        self.name = name
        self.state = state
        self.value = value
        self.message = message
    }

    public static func available(name: String, value: Double) -> ProviderValue {
        ProviderValue(name: name, state: .available, value: value)
    }

    public static func loading(name: String, message: String = "waiting for provider") -> ProviderValue {
        ProviderValue(name: name, state: .loading, message: message)
    }

    public static func unavailable(name: String, message: String) -> ProviderValue {
        ProviderValue(name: name, state: .unavailable, message: message)
    }
}

public struct ProviderSnapshot: Codable, Equatable, Sendable {
    public let values: [String: ProviderValue]

    public init(values: [String: ProviderValue] = [:]) {
        self.values = values
    }
}
