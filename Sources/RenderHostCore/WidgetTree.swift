import Foundation

public enum WidgetNodeKind: String, Codable, Sendable {
    case column
    case row
    case stack
    case box
    case glassPanel
    case mediaCard
    case spacer
    case divider
    case text
    case textField
    case toggle
    case shape
    case icon
    case image
    case button
    case gauge
    case progress
    case grid
    case timer
    case taskList
    case list
    case visualizer
    case youtubePlayer
    case scrollView
    case textEditor
    case dateTime
    case dateTimePicker
}

public enum WidgetLength: Codable, Equatable, Sendable {
    case points(Double)
    case fill
    case fit

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let points = try? container.decode(Double.self) {
            self = .points(points)
            return
        }
        switch try container.decode(String.self) {
        case "fill": self = .fill
        case "fit": self = .fit
        default:
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "length must be a number, fill, or fit")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .points(let value): try container.encode(value)
        case .fill: try container.encode("fill")
        case .fit: try container.encode("fit")
        }
    }
}

public struct WidgetInsets: Codable, Equatable, Sendable {
    public let top: Double?
    public let right: Double?
    public let bottom: Double?
    public let left: Double?

    public init(top: Double? = nil, right: Double? = nil, bottom: Double? = nil, left: Double? = nil) {
        self.top = top
        self.right = right
        self.bottom = bottom
        self.left = left
    }
}

public enum WidgetSpacing: Codable, Equatable, Sendable {
    case points(Double)
    case insets(WidgetInsets)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let points = try? container.decode(Double.self) {
            self = .points(points)
        } else {
            self = .insets(try container.decode(WidgetInsets.self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .points(let value): try container.encode(value)
        case .insets(let value): try container.encode(value)
        }
    }
}

public enum WidgetAlignment: String, Codable, Equatable, Sendable {
    case leading
    case center
    case trailing
    case top
    case bottom
    case fill
    case spaceBetween = "space-between"
}

public enum WidgetFontWeight: String, Codable, Equatable, Sendable {
    case regular
    case medium
    case semibold
    case bold
}

public enum WidgetStyleToken: String, Codable, Equatable, Sendable {
    case surface
    case surfaceElevated = "surface.elevated"
    case surfacePanel = "surface.panel"
    case surfaceControl = "surface.control"
    case surfaceStatus = "surface.status"
    case textPrimary = "text.primary"
    case textSecondary = "text.secondary"
    case textTertiary = "text.tertiary"
    case borderSubtle = "border.subtle"
    case accent
    case accentMuted = "accent.muted"
    case danger
    case success
    case mono
}

public enum WidgetMaterial: String, Codable, Equatable, Sendable {
    case solid
    case thin
    case thick
}

public enum WidgetSemanticRole: String, Codable, Equatable, Sendable {
    case surface
    case panel
    case control
    case status
    case media
}

public enum WidgetDensity: String, Codable, Equatable, Sendable {
    case compact
    case comfortable
}

public struct WidgetFont: Codable, Equatable, Sendable {
    public let family: String?
    public let size: Double?
    public let weight: WidgetFontWeight?
    public let monospace: Bool?

    public init(family: String? = nil, size: Double? = nil, weight: WidgetFontWeight? = nil, monospace: Bool? = nil) {
        self.family = family
        self.size = size
        self.weight = weight
        self.monospace = monospace
    }
}

public struct WidgetBorder: Codable, Equatable, Sendable {
    public let color: String?
    public let width: Double?
    public let radius: Double?

    public init(color: String? = nil, width: Double? = nil, radius: Double? = nil) {
        self.color = color
        self.width = width
        self.radius = radius
    }
}

public struct WidgetShadow: Codable, Equatable, Sendable {
    public let color: String?
    public let radius: Double?
    public let x: Double?
    public let y: Double?
    public let opacity: Double?

    public init(color: String? = nil, radius: Double? = nil, x: Double? = nil, y: Double? = nil, opacity: Double? = nil) {
        self.color = color
        self.radius = radius
        self.x = x
        self.y = y
        self.opacity = opacity
    }
}

public struct WidgetStyle: Codable, Equatable, Sendable {
    public let width: WidgetLength?
    public let height: WidgetLength?
    public let color: String?
    public let backgroundColor: String?
    public let opacity: Double?
    public let padding: WidgetSpacing?
    public let margin: WidgetSpacing?
    public let gap: Double?
    public let alignItems: WidgetAlignment?
    public let justifyContent: WidgetAlignment?
    public let radius: Double?
    public let border: WidgetBorder?
    public let shadow: WidgetShadow?
    public let font: WidgetFont?
    public let material: WidgetMaterial?
    public let role: WidgetSemanticRole?
    public let density: WidgetDensity?
    public let tokens: [WidgetStyleToken]?

    // Numeric initializers preserve the original native-host call sites.
    public init(
        width: Double? = nil,
        height: Double? = nil,
        color: String? = nil,
        backgroundColor: String? = nil,
        opacity: Double? = nil,
        padding: WidgetSpacing? = nil,
        margin: WidgetSpacing? = nil,
        gap: Double? = nil,
        alignItems: WidgetAlignment? = nil,
        justifyContent: WidgetAlignment? = nil,
        radius: Double? = nil,
        border: WidgetBorder? = nil,
        shadow: WidgetShadow? = nil,
        font: WidgetFont? = nil,
        material: WidgetMaterial? = nil,
        role: WidgetSemanticRole? = nil,
        density: WidgetDensity? = nil,
        tokens: [WidgetStyleToken]? = nil
    ) {
        self.width = width.map(WidgetLength.points)
        self.height = height.map(WidgetLength.points)
        self.color = color
        self.backgroundColor = backgroundColor
        self.opacity = opacity
        self.padding = padding
        self.margin = margin
        self.gap = gap
        self.alignItems = alignItems
        self.justifyContent = justifyContent
        self.radius = radius
        self.border = border
        self.shadow = shadow
        self.font = font
        self.material = material
        self.role = role
        self.density = density
        self.tokens = tokens
    }

    public init(
        width: WidgetLength,
        height: WidgetLength? = nil,
        color: String? = nil,
        backgroundColor: String? = nil,
        opacity: Double? = nil,
        padding: WidgetSpacing? = nil,
        margin: WidgetSpacing? = nil,
        gap: Double? = nil,
        alignItems: WidgetAlignment? = nil,
        justifyContent: WidgetAlignment? = nil,
        radius: Double? = nil,
        border: WidgetBorder? = nil,
        shadow: WidgetShadow? = nil,
        font: WidgetFont? = nil,
        material: WidgetMaterial? = nil,
        role: WidgetSemanticRole? = nil,
        density: WidgetDensity? = nil,
        tokens: [WidgetStyleToken]? = nil
    ) {
        self.width = width
        self.height = height
        self.color = color
        self.backgroundColor = backgroundColor
        self.opacity = opacity
        self.padding = padding
        self.margin = margin
        self.gap = gap
        self.alignItems = alignItems
        self.justifyContent = justifyContent
        self.radius = radius
        self.border = border
        self.shadow = shadow
        self.font = font
        self.material = material
        self.role = role
        self.density = density
        self.tokens = tokens
    }
}

public enum WidgetJSONValue: Codable, Equatable, Sendable {
    case string(String)
    case number(Double)
    case boolean(Bool)
    case null
    case array([WidgetJSONValue])
    case object([String: WidgetJSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null; return }
        if let value = try? container.decode(String.self) { self = .string(value); return }
        if let value = try? container.decode(Bool.self) { self = .boolean(value); return }
        if let value = try? container.decode(Double.self) { self = .number(value); return }
        if let value = try? container.decode([WidgetJSONValue].self) { self = .array(value); return }
        if let value = try? container.decode([String: WidgetJSONValue].self) { self = .object(value); return }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "action values must be JSON-compatible")
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .boolean(let value): try container.encode(value)
        case .null: try container.encodeNil()
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }
}

public enum WidgetAction: Codable, Equatable, Sendable {
    case invoke(name: String, payload: WidgetJSONValue?)
    case set(name: String, value: WidgetJSONValue)

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .type) {
        case "invoke": self = .invoke(name: try container.decode(String.self, forKey: .name), payload: try container.decodeIfPresent(WidgetJSONValue.self, forKey: .payload))
        case "set": self = .set(name: try container.decode(String.self, forKey: .name), value: try container.decode(WidgetJSONValue.self, forKey: .value))
        default: throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "action type must be invoke or set")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .invoke(let name, let payload):
            try container.encode("invoke", forKey: .type)
            try container.encode(name, forKey: .name)
            try container.encodeIfPresent(payload, forKey: .payload)
        case .set(let name, let value):
            try container.encode("set", forKey: .type)
            try container.encode(name, forKey: .name)
            try container.encode(value, forKey: .value)
        }
    }

    private enum CodingKeys: String, CodingKey { case type, name, payload, value }
}

public enum ImageSource: Codable, Equatable, Sendable {
    case asset(name: String)
    case url(url: String)
    case provider(name: String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .kind) {
        case "asset": self = .asset(name: try container.decode(String.self, forKey: .name))
        case "url": self = .url(url: try container.decode(String.self, forKey: .url))
        case "provider": self = .provider(name: try container.decode(String.self, forKey: .name))
        default: throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "image source kind must be asset, url, or provider")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .asset(let name): try container.encode("asset", forKey: .kind); try container.encode(name, forKey: .name)
        case .url(let url): try container.encode("url", forKey: .kind); try container.encode(url, forKey: .url)
        case .provider(let name): try container.encode("provider", forKey: .kind); try container.encode(name, forKey: .name)
        }
    }

    private enum CodingKeys: String, CodingKey { case kind, name, url }
}

public enum WidgetKey: Codable, Equatable, Sendable {
    case string(String)
    case number(Int)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) {
            self = .string(value)
            return
        }
        if let value = try? container.decode(Int.self) {
            self = .number(value)
            return
        }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "key must be a string or integer")
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        }
    }
}

public struct WidgetTaskItem: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let text: String
    public let completed: Bool

    public init(id: String, text: String, completed: Bool = false) {
        self.id = id
        self.text = text
        self.completed = completed
    }
}

public struct WidgetListItem: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let subtitle: String?
    public let completed: Bool

    public init(id: String, title: String, subtitle: String? = nil, completed: Bool = false) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.completed = completed
    }
}

public struct WidgetTree: Codable, Equatable, Sendable {
    public let kind: WidgetNodeKind
    public let key: WidgetKey?
    public let children: [WidgetTree]
    public let text: String?
    public let provider: String?
    public let style: WidgetStyle?
    public let value: Double?
    public let maximum: Double?
    public let orientation: String?
    public let name: String?
    public let source: ImageSource?
    public let action: WidgetAction?
    public let columns: Int?
    public let durationSeconds: Int?
    public let tasks: [WidgetTaskItem]?
    public let items: [WidgetListItem]?
    public let videoId: String?
    public let allowLinkInput: Bool?
    public let autoplay: Bool?
    public let controls: Bool?
    public let startSeconds: Double?
    public let placeholder: String?
    public let dateTime: String?
    public let dateTimeMode: String?
    public let visualizerMode: String?
    public let visualizerTempo: Double?

    public init(
        kind: WidgetNodeKind,
        key: WidgetKey? = nil,
        children: [WidgetTree] = [],
        text: String? = nil,
        provider: String? = nil,
        style: WidgetStyle? = nil,
        value: Double? = nil,
        maximum: Double? = nil,
        orientation: String? = nil,
        name: String? = nil,
        source: ImageSource? = nil,
        action: WidgetAction? = nil,
        columns: Int? = nil,
        durationSeconds: Int? = nil,
        tasks: [WidgetTaskItem]? = nil,
        items: [WidgetListItem]? = nil,
        videoId: String? = nil,
        allowLinkInput: Bool? = nil,
        autoplay: Bool? = nil,
        controls: Bool? = nil,
        startSeconds: Double? = nil,
        placeholder: String? = nil,
        dateTime: String? = nil,
        dateTimeMode: String? = nil,
        visualizerMode: String? = nil,
        visualizerTempo: Double? = nil
    ) {
        self.kind = kind
        self.key = key
        self.children = children
        self.text = text
        self.provider = provider
        self.style = style
        self.value = value
        self.maximum = maximum
        self.orientation = orientation
        self.name = name
        self.source = source
        self.action = action
        self.columns = columns
        self.durationSeconds = durationSeconds
        self.tasks = tasks
        self.items = items
        self.videoId = videoId
        self.allowLinkInput = allowLinkInput
        self.autoplay = autoplay
        self.controls = controls
        self.startSeconds = startSeconds
        self.placeholder = placeholder
        self.dateTime = dateTime
        self.dateTimeMode = dateTimeMode
        self.visualizerMode = visualizerMode
        self.visualizerTempo = visualizerTempo
    }

    private enum CodingKeys: String, CodingKey {
        case kind, key, children, text, provider, style, value, maximum, orientation, name, source, action, columns, durationSeconds, tasks, items, videoId, allowLinkInput, autoplay, controls, startSeconds, placeholder, dateTime, dateTimeMode, visualizerMode, visualizerTempo
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decode(WidgetNodeKind.self, forKey: .kind)
        key = try container.decodeIfPresent(WidgetKey.self, forKey: .key)
        children = try container.decodeIfPresent([WidgetTree].self, forKey: .children) ?? []
        text = try container.decodeIfPresent(String.self, forKey: .text)
        provider = try container.decodeIfPresent(String.self, forKey: .provider)
        style = try container.decodeIfPresent(WidgetStyle.self, forKey: .style)
        value = try container.decodeIfPresent(Double.self, forKey: .value)
        maximum = try container.decodeIfPresent(Double.self, forKey: .maximum)
        orientation = try container.decodeIfPresent(String.self, forKey: .orientation)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        source = try container.decodeIfPresent(ImageSource.self, forKey: .source)
        action = try container.decodeIfPresent(WidgetAction.self, forKey: .action)
        columns = try container.decodeIfPresent(Int.self, forKey: .columns)
        durationSeconds = try container.decodeIfPresent(Int.self, forKey: .durationSeconds)
        tasks = try container.decodeIfPresent([WidgetTaskItem].self, forKey: .tasks)
        items = try container.decodeIfPresent([WidgetListItem].self, forKey: .items)
        videoId = try container.decodeIfPresent(String.self, forKey: .videoId)
        allowLinkInput = try container.decodeIfPresent(Bool.self, forKey: .allowLinkInput)
        autoplay = try container.decodeIfPresent(Bool.self, forKey: .autoplay)
        controls = try container.decodeIfPresent(Bool.self, forKey: .controls)
        startSeconds = try container.decodeIfPresent(Double.self, forKey: .startSeconds)
        placeholder = try container.decodeIfPresent(String.self, forKey: .placeholder)
        dateTime = try container.decodeIfPresent(String.self, forKey: .dateTime)
        dateTimeMode = try container.decodeIfPresent(String.self, forKey: .dateTimeMode)
        visualizerMode = try container.decodeIfPresent(String.self, forKey: .visualizerMode)
        visualizerTempo = try container.decodeIfPresent(Double.self, forKey: .visualizerTempo)
    }

    public func validationIssues(path: String = "root") -> [WidgetTreeValidationIssue] {
        var issues: [WidgetTreeValidationIssue] = []
        let isContainer = [.column, .row, .stack, .box, .glassPanel, .mediaCard, .scrollView, .grid, .button].contains(kind)

        if isContainer && text != nil {
            issues.append(.init(path: path, message: "container nodes cannot define text"))
        }
        if !isContainer && !children.isEmpty {
            issues.append(.init(path: path, message: "leaf nodes cannot define children"))
        }
        if kind == .text || kind == .textField {
            if (text == nil || text?.isEmpty == true) && provider == nil {
                issues.append(.init(path: path, message: "\(kind.rawValue) nodes require non-empty text"))
            }
            if kind == .textField && provider != nil {
                issues.append(.init(path: "\(path).provider", message: "textField nodes cannot bind to a provider"))
            }
        }
        if kind == .toggle && value != 0 && value != 1 {
            issues.append(.init(path: "\(path).value", message: "toggle value must be zero or one"))
        }
        if kind == .timer && (durationSeconds == nil || durationSeconds ?? 0 <= 0) {
            issues.append(.init(path: "\(path).durationSeconds", message: "timer duration must be a positive integer in seconds"))
        }
        if kind == .taskList {
            guard let tasks else {
                issues.append(.init(path: "\(path).tasks", message: "taskList nodes require an array of items"))
                return issues
            }
            var ids = Set<String>()
            for (index, task) in tasks.enumerated() {
                if task.id.isEmpty { issues.append(.init(path: "\(path).tasks[\(index)].id", message: "task id must be non-empty")) }
                if !ids.insert(task.id).inserted { issues.append(.init(path: "\(path).tasks[\(index)].id", message: "task ids must be unique")) }
                if task.text.isEmpty { issues.append(.init(path: "\(path).tasks[\(index)].text", message: "task text must be non-empty")) }
            }
        }
        if kind == .list, provider == nil {
            guard let items else {
                issues.append(.init(path: "\(path).items", message: "list nodes require an array of items or a provider"))
                return issues
            }
            var ids = Set<String>()
            for (index, item) in items.enumerated() {
                if item.id.isEmpty { issues.append(.init(path: "\(path).items[\(index)].id", message: "list item id must be non-empty")) }
                if !ids.insert(item.id).inserted { issues.append(.init(path: "\(path).items[\(index)].id", message: "list item ids must be unique")) }
                if item.title.isEmpty { issues.append(.init(path: "\(path).items[\(index)].title", message: "list item title must be non-empty")) }
            }
        }
        if kind == .visualizer {
            if let visualizerMode, !["bars", "waveform", "rings"].contains(visualizerMode) {
                issues.append(.init(path: "\(path).visualizerMode", message: "mode must be bars, waveform, or rings"))
            }
            if let visualizerTempo, !visualizerTempo.isFinite || visualizerTempo <= 0 {
                issues.append(.init(path: "\(path).visualizerTempo", message: "tempo must be a positive number"))
            }
        }
        if kind != .visualizer {
            if visualizerMode != nil { issues.append(.init(path: "\(path).visualizerMode", message: "only visualizer nodes may define a visualizer mode")) }
            if visualizerTempo != nil { issues.append(.init(path: "\(path).visualizerTempo", message: "only visualizer nodes may define a visualizer tempo")) }
        }
        if let provider, provider.isEmpty {
            issues.append(.init(path: "\(path).provider", message: "provider name must be non-empty"))
        }
        if kind == .gauge || kind == .progress {
            if (value == nil && provider == nil) || maximum == nil {
                issues.append(.init(path: path, message: "\(kind.rawValue) nodes require value or a provider and maximum"))
            } else if let value, let maximum, value < 0 || value > maximum || maximum <= 0 {
                issues.append(.init(path: "\(path).value", message: "\(kind.rawValue) value must be within a positive maximum"))
            }
        }
        if kind == .icon && (name == nil || name?.isEmpty == true) {
            issues.append(.init(path: "\(path).name", message: "icon nodes require a non-empty symbol name"))
        }
        if kind == .image {
            if source == nil {
                issues.append(.init(path: "\(path).source", message: "image nodes require an explicit asset, URL, or provider source"))
            } else if case .asset(let name) = source, name.isEmpty {
                issues.append(.init(path: "\(path).source.name", message: "asset name must be non-empty"))
            } else if case .url(let url) = source, url.isEmpty {
                issues.append(.init(path: "\(path).source.url", message: "image URL must be non-empty"))
            } else if case .provider(let name) = source, name.isEmpty {
                issues.append(.init(path: "\(path).source.name", message: "image provider name must be non-empty"))
            }
        }
        if kind == .divider, orientation != "horizontal" && orientation != "vertical" {
            issues.append(.init(path: "\(path).orientation", message: "divider orientation must be horizontal or vertical"))
        }
        if kind == .grid, columns == nil || columns ?? 0 <= 0 {
            issues.append(.init(path: "\(path).columns", message: "grid columns must be a positive integer"))
        }
        if kind != .button && action != nil {
            issues.append(.init(path: "\(path).action", message: "only button nodes may define an action"))
        }
        if kind != .icon && name != nil { issues.append(.init(path: "\(path).name", message: "only icon nodes may define a name")) }
        if kind != .image && source != nil { issues.append(.init(path: "\(path).source", message: "only image nodes may define a source")) }
        if kind != .divider && orientation != nil { issues.append(.init(path: "\(path).orientation", message: "only divider nodes may define an orientation")) }
        if kind != .grid && columns != nil { issues.append(.init(path: "\(path).columns", message: "only grid nodes may define columns")) }
        if kind != .timer && durationSeconds != nil { issues.append(.init(path: "\(path).durationSeconds", message: "only timer nodes may define durationSeconds")) }
        if kind != .taskList && tasks != nil { issues.append(.init(path: "\(path).tasks", message: "only taskList nodes may define tasks")) }
        if kind != .list && items != nil { issues.append(.init(path: "\(path).items", message: "only list nodes may define items")) }
        if kind == .youtubePlayer {
            if videoId == nil && allowLinkInput != true {
                issues.append(.init(path: "\(path).videoId", message: "YouTubePlayer requires a video ID or allowLinkInput: true"))
                return issues
            }
            if let videoId, videoId.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) == nil {
                issues.append(.init(path: "\(path).videoId", message: "YouTubePlayer requires an 11-character YouTube video ID"))
                return issues
            }
            if let startSeconds, startSeconds < 0 || !startSeconds.isFinite {
                issues.append(.init(path: "\(path).startSeconds", message: "YouTubePlayer startSeconds must be a non-negative number"))
            }
        }
        if kind != .youtubePlayer {
            if videoId != nil { issues.append(.init(path: "\(path).videoId", message: "only youtubePlayer nodes may define a videoId")) }
            if allowLinkInput != nil { issues.append(.init(path: "\(path).allowLinkInput", message: "only youtubePlayer nodes may define allowLinkInput")) }
            if autoplay != nil { issues.append(.init(path: "\(path).autoplay", message: "only youtubePlayer nodes may define autoplay")) }
            if controls != nil { issues.append(.init(path: "\(path).controls", message: "only youtubePlayer nodes may define controls")) }
            if startSeconds != nil { issues.append(.init(path: "\(path).startSeconds", message: "only youtubePlayer nodes may define startSeconds")) }
        }
        if kind != .textEditor && placeholder != nil { issues.append(.init(path: "\(path).placeholder", message: "only textEditor nodes may define a placeholder")) }
        let dateTimeKinds: Set<WidgetNodeKind> = [.dateTime, .dateTimePicker]
        if let dateTimeMode, !["date", "time", "dateTime"].contains(dateTimeMode) {
            issues.append(.init(path: "\(path).dateTimeMode", message: "mode must be date, time, or dateTime"))
        }
        if kind == .dateTime {
            guard let dateTime, !dateTime.isEmpty else {
                issues.append(.init(path: "\(path).dateTime", message: "dateTime nodes require an ISO date-time string"))
                return issues
            }
            if ISO8601DateFormatter().date(from: dateTime) == nil {
                issues.append(.init(path: "\(path).dateTime", message: "dateTime must be a valid ISO date-time string"))
            }
        } else if kind == .dateTimePicker, let dateTime, ISO8601DateFormatter().date(from: dateTime) == nil {
            issues.append(.init(path: "\(path).dateTime", message: "dateTime picker value must be a valid ISO date-time string"))
        }
        if !dateTimeKinds.contains(kind) && dateTime != nil {
            issues.append(.init(path: "\(path).dateTime", message: "only dateTime nodes may define a date-time value"))
        }
        if !dateTimeKinds.contains(kind) && dateTimeMode != nil {
            issues.append(.init(path: "\(path).dateTimeMode", message: "only dateTime nodes may define a date-time mode"))
        }
        switch action {
        case .invoke(let name, _), .set(let name, _):
            if name.isEmpty { issues.append(.init(path: "\(path).action.name", message: "action name must be non-empty")) }
        case nil: break
        }

        if let width = style?.width, case .points(let value) = width, value <= 0 {
            issues.append(.init(path: "\(path).style.width", message: "width must be greater than zero"))
        }
        if let height = style?.height, case .points(let value) = height, value <= 0 {
            issues.append(.init(path: "\(path).style.height", message: "height must be greater than zero"))
        }
        validateSpacing(style?.padding, path: "\(path).style.padding", issues: &issues)
        validateSpacing(style?.margin, path: "\(path).style.margin", issues: &issues)
        if let gap = style?.gap, gap < 0 { issues.append(.init(path: "\(path).style.gap", message: "gap must be zero or greater")) }
        if let opacity = style?.opacity, !(0...1).contains(opacity) { issues.append(.init(path: "\(path).style.opacity", message: "opacity must be between zero and one")) }
        if let radius = style?.radius, radius < 0 { issues.append(.init(path: "\(path).style.radius", message: "radius must be zero or greater")) }
        if let border = style?.border {
            if let width = border.width, width < 0 { issues.append(.init(path: "\(path).style.border.width", message: "border width must be zero or greater")) }
            if let radius = border.radius, radius < 0 { issues.append(.init(path: "\(path).style.border.radius", message: "border radius must be zero or greater")) }
        }
        if let shadow = style?.shadow {
            if let radius = shadow.radius, radius < 0 { issues.append(.init(path: "\(path).style.shadow.radius", message: "shadow radius must be zero or greater")) }
            if let opacity = shadow.opacity, !(0...1).contains(opacity) { issues.append(.init(path: "\(path).style.shadow.opacity", message: "shadow opacity must be between zero and one")) }
        }
        if let font = style?.font, let size = font.size, size <= 0 { issues.append(.init(path: "\(path).style.font.size", message: "font size must be greater than zero")) }

        var childKeys = Set<String>()
        for (index, child) in children.enumerated() {
            if let key = child.key {
                let keyName: String
                switch key {
                case .string(let value): keyName = "string:\(value)"
                case .number(let value): keyName = "number:\(value)"
                }
                if !childKeys.insert(keyName).inserted {
                    issues.append(.init(path: "\(path).children[\(index)].key", message: "sibling keys must be unique"))
                }
            }
            issues.append(contentsOf: child.validationIssues(path: "\(path).children[\(index)]"))
        }
        return issues
    }

    private func validateSpacing(_ spacing: WidgetSpacing?, path: String, issues: inout [WidgetTreeValidationIssue]) {
        switch spacing {
        case .points(let value) where value < 0:
            issues.append(.init(path: path, message: "spacing must be zero or greater"))
        case .insets(let insets):
            let values = [("top", insets.top), ("right", insets.right), ("bottom", insets.bottom), ("left", insets.left)]
            for (name, value) in values where value ?? 0 < 0 {
                issues.append(.init(path: "\(path).\(name)", message: "spacing must be zero or greater"))
            }
        default: break
        }
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
