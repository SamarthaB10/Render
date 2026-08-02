public enum WidgetNodeKind: String, Codable, Sendable {
    case column
    case row
    case stack
    case text
    case shape
    case gauge
}

public struct WidgetStyle: Codable, Equatable, Sendable {
    public let width: Double?
    public let height: Double?
    public let color: String?

    public init(width: Double? = nil, height: Double? = nil, color: String? = nil) {
        self.width = width
        self.height = height
        self.color = color
    }
}

public struct WidgetTree: Codable, Equatable, Sendable {
    public let kind: WidgetNodeKind
    public let children: [WidgetTree]
    public let text: String?
    public let style: WidgetStyle?
    public let value: Double?
    public let maximum: Double?

    public init(
        kind: WidgetNodeKind,
        children: [WidgetTree] = [],
        text: String? = nil,
        style: WidgetStyle? = nil,
        value: Double? = nil,
        maximum: Double? = nil
    ) {
        self.kind = kind
        self.children = children
        self.text = text
        self.style = style
        self.value = value
        self.maximum = maximum
    }

    public func validationIssues(path: String = "root") -> [WidgetTreeValidationIssue] {
        var issues: [WidgetTreeValidationIssue] = []
        let isContainer = kind == .column || kind == .row || kind == .stack

        if isContainer && text != nil {
            issues.append(.init(path: path, message: "container nodes cannot define text"))
        }
        if !isContainer && !children.isEmpty {
            issues.append(.init(path: path, message: "leaf nodes cannot define children"))
        }
        if kind == .text && (text == nil || text?.isEmpty == true) {
            issues.append(.init(path: path, message: "text nodes require non-empty text"))
        }
        if kind == .gauge {
            if value == nil || maximum == nil {
                issues.append(.init(path: path, message: "gauge nodes require value and maximum"))
            } else if let value, let maximum, value < 0 || value > maximum || maximum <= 0 {
                issues.append(.init(path: path, message: "gauge value must be within a positive maximum"))
            }
        }
        if let width = style?.width, width <= 0 {
            issues.append(.init(path: "\(path).style.width", message: "width must be greater than zero"))
        }
        if let height = style?.height, height <= 0 {
            issues.append(.init(path: "\(path).style.height", message: "height must be greater than zero"))
        }

        for (index, child) in children.enumerated() {
            issues.append(contentsOf: child.validationIssues(path: "\(path).children[\(index)]"))
        }
        return issues
    }
}

public struct WidgetTreeValidationIssue: Codable, Equatable, Sendable {
    public let path: String
    public let message: String

    public init(path: String, message: String) {
        self.path = path
        self.message = message
    }
}
