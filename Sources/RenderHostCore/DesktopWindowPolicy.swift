public struct DesktopWindowPolicy: Codable, Equatable, Sendable {
    public enum Level: String, Codable, Sendable {
        case desktop
    }

    public enum Anchor: String, Codable, Sendable {
        case topLeft = "top-left"
    }

    public let level: Level
    public let anchor: Anchor
    public let offsetX: Double
    public let offsetY: Double
    public let ignoresMouseEvents: Bool
    public let joinsAllSpaces: Bool

    public init(
        level: Level = .desktop,
        anchor: Anchor = .topLeft,
        offsetX: Double = 24,
        offsetY: Double = 24,
        ignoresMouseEvents: Bool = true,
        joinsAllSpaces: Bool = true
    ) {
        self.level = level
        self.anchor = anchor
        self.offsetX = offsetX
        self.offsetY = offsetY
        self.ignoresMouseEvents = ignoresMouseEvents
        self.joinsAllSpaces = joinsAllSpaces
    }
}
