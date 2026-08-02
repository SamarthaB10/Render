public enum WidgetAnchor: String, Codable, Equatable, Sendable {
    case topLeft = "top-left"
    case topRight = "top-right"
    case bottomLeft = "bottom-left"
    case bottomRight = "bottom-right"
}

public struct WidgetPlacement: Codable, Equatable, Sendable {
    public let screenID: UInt32?
    public let originX: Double
    public let originY: Double

    public init(screenID: UInt32? = nil, originX: Double, originY: Double) {
        self.screenID = screenID
        self.originX = originX
        self.originY = originY
    }
}
