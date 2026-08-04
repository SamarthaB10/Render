import Foundation

public enum WidgetNodeKind: String, Codable, Sendable {
    case column
    case row
    case stack
    case box
    case spacer
    case divider
    case text
    case textField
    case toggle
    case shape
    case icon
    case image
    case button
    case slider
    case gauge
    case progress
    case grid
    case gradient
    case texture
    case clip
    case transform
    case segmentedProgress
    case spectrum
}

public struct WidgetGradientStop: Codable, Equatable, Sendable {
    public let color: String
    public let position: Double?

    public init(color: String, position: Double? = nil) {
        self.color = color
        self.position = position
    }
}

public enum WidgetTextureSource: Codable, Equatable, Sendable {
    case builtIn(name: String)
    case asset(name: String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .kind) {
        case "builtin", "builtIn": self = .builtIn(name: try container.decode(String.self, forKey: .name))
        case "asset": self = .asset(name: try container.decode(String.self, forKey: .name))
        default: throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "texture source kind must be builtin or asset")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .builtIn(let name):
            try container.encode("builtin", forKey: .kind)
            try container.encode(name, forKey: .name)
        case .asset(let name):
            try container.encode("asset", forKey: .kind)
            try container.encode(name, forKey: .name)
        }
    }

    private enum CodingKeys: String, CodingKey { case kind, name }
}

public struct WidgetTransform: Codable, Equatable, Sendable {
    public let offsetX: Double?
    public let offsetY: Double?
    public let scale: Double?
    public let rotation: Double?

    public init(offsetX: Double? = nil, offsetY: Double? = nil, scale: Double? = nil, rotation: Double? = nil) {
        self.offsetX = offsetX
        self.offsetY = offsetY
        self.scale = scale
        self.rotation = rotation
    }
}

public enum WidgetAnimationRepeat: Codable, Equatable, Sendable {
    case count(Int)
    case forever

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let count = try? container.decode(Int.self), count >= 0 {
            self = .count(count)
            return
        }
        if let value = try? container.decode(String.self), value == "forever" {
            self = .forever
            return
        }
        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "animation repeat must be a non-negative integer or forever"
        )
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .count(let count): try container.encode(count)
        case .forever: try container.encode("forever")
        }
    }
}

public struct WidgetAnimation: Codable, Equatable, Sendable {
    public let property: String
    public let from: Double
    public let to: Double
    public let duration: Double
    public let delay: Double?
    public let `repeat`: WidgetAnimationRepeat?
    public let easing: String?

    public init(
        property: String,
        from: Double,
        to: Double,
        duration: Double,
        delay: Double? = nil,
        repeat: WidgetAnimationRepeat? = nil,
        easing: String? = nil
    ) {
        self.property = property
        self.from = from
        self.to = to
        self.duration = duration
        self.delay = delay
        self.`repeat` = `repeat`
        self.easing = easing
    }
}

public enum WidgetImageFit: String, Codable, Equatable, Sendable {
    case contain
    case cover
    case fill
}

public enum WidgetImageRepeat: String, Codable, Equatable, Sendable {
    case none
    case x
    case y
    case both
}

public struct WidgetImageOptions: Codable, Equatable, Sendable {
    public let fit: WidgetImageFit?
    public let `repeat`: WidgetImageRepeat?
    public let position: String?
    public let tint: String?

    public init(
        fit: WidgetImageFit? = nil,
        repeat: WidgetImageRepeat? = nil,
        position: String? = nil,
        tint: String? = nil
    ) {
        self.fit = fit
        self.`repeat` = `repeat`
        self.position = position
        self.tint = tint
    }
}

public enum WidgetLength: Codable, Equatable, Sendable {
    case points(Double)
    case fill
    case fit
    case auto
    case percent(Double)
    case fraction(Double)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let points = try? container.decode(Double.self) {
            self = .points(points)
            return
        }
        if let value = try? container.decode(String.self) {
            switch value {
            case "fill": self = .fill
            case "fit": self = .fit
            case "auto": self = .auto
            default:
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "length must be a number, fill, fit, auto, percent, or fraction")
            }
            return
        }
        let object = try decoder.container(keyedBy: ObjectCodingKeys.self)
        let value = try object.decode(Double.self, forKey: .value)
        switch try object.decode(String.self, forKey: .unit) {
        case "percent": self = .percent(value)
        case "fraction": self = .fraction(value)
        default: throw DecodingError.dataCorruptedError(forKey: .unit, in: object, debugDescription: "length unit must be percent or fraction")
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .points(let value): var container = encoder.singleValueContainer(); try container.encode(value)
        case .fill: var container = encoder.singleValueContainer(); try container.encode("fill")
        case .fit: var container = encoder.singleValueContainer(); try container.encode("fit")
        case .auto: var container = encoder.singleValueContainer(); try container.encode("auto")
        case .percent(let value):
            var container = encoder.container(keyedBy: ObjectCodingKeys.self)
            try container.encode("percent", forKey: .unit)
            try container.encode(value, forKey: .value)
        case .fraction(let value):
            var container = encoder.container(keyedBy: ObjectCodingKeys.self)
            try container.encode("fraction", forKey: .unit)
            try container.encode(value, forKey: .value)
        }
    }

    private enum ObjectCodingKeys: String, CodingKey { case unit, value }
}

public struct WidgetInsets: Codable, Equatable, Sendable {
    public let top: Double?
    public let right: Double?
    public let bottom: Double?
    public let left: Double?
    public let horizontal: Double?
    public let vertical: Double?

    public init(top: Double? = nil, right: Double? = nil, bottom: Double? = nil, left: Double? = nil, horizontal: Double? = nil, vertical: Double? = nil) {
        self.top = top
        self.right = right
        self.bottom = bottom
        self.left = left
        self.horizontal = horizontal
        self.vertical = vertical
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

public struct WidgetCornerRadii: Codable, Equatable, Sendable {
    public let topLeft: Double?
    public let topRight: Double?
    public let bottomRight: Double?
    public let bottomLeft: Double?

    public init(topLeft: Double? = nil, topRight: Double? = nil, bottomRight: Double? = nil, bottomLeft: Double? = nil) {
        self.topLeft = topLeft
        self.topRight = topRight
        self.bottomRight = bottomRight
        self.bottomLeft = bottomLeft
    }
}

public enum WidgetRadius: Codable, Equatable, Sendable {
    case uniform(Double)
    case corners(WidgetCornerRadii)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(Double.self) { self = .uniform(value) }
        else { self = .corners(try container.decode(WidgetCornerRadii.self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .uniform(let value): try container.encode(value)
        case .corners(let value): try container.encode(value)
        }
    }
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
    case textPrimary = "text.primary"
    case textSecondary = "text.secondary"
    case accent
    case danger
    case success
    case mono
}

public struct WidgetFont: Codable, Equatable, Sendable {
    public let family: String?
    public let size: Double?
    public let weight: WidgetFontWeight?
    public let monospace: Bool?
    public let leading: Double?
    public let tracking: Double?
    public let alignment: String?
    public let lineLimit: Int?
    public let tabularNumbers: Bool?
    public let truncation: String?

    public init(family: String? = nil, size: Double? = nil, weight: WidgetFontWeight? = nil, monospace: Bool? = nil, leading: Double? = nil, tracking: Double? = nil, alignment: String? = nil, lineLimit: Int? = nil, tabularNumbers: Bool? = nil, truncation: String? = nil) {
        self.family = family
        self.size = size
        self.weight = weight
        self.monospace = monospace
        self.leading = leading
        self.tracking = tracking
        self.alignment = alignment
        self.lineLimit = lineLimit
        self.tabularNumbers = tabularNumbers
        self.truncation = truncation
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
    public let kind: String
    public let color: String?
    public let radius: Double?
    public let x: Double?
    public let y: Double?
    public let opacity: Double?

    public init(kind: String = "outset", color: String? = nil, radius: Double? = nil, x: Double? = nil, y: Double? = nil, opacity: Double? = nil) {
        self.kind = kind
        self.color = color
        self.radius = radius
        self.x = x
        self.y = y
        self.opacity = opacity
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decodeIfPresent(String.self, forKey: .kind) ?? "outset"
        color = try container.decodeIfPresent(String.self, forKey: .color)
        radius = try container.decodeIfPresent(Double.self, forKey: .radius)
        x = try container.decodeIfPresent(Double.self, forKey: .x)
        y = try container.decodeIfPresent(Double.self, forKey: .y)
        opacity = try container.decodeIfPresent(Double.self, forKey: .opacity)
    }

    private enum CodingKeys: String, CodingKey { case kind, color, radius, x, y, opacity }
}

public enum WidgetCursor: String, Codable, Equatable, Sendable {
    case `default`
    case pointer
    case text
    case crosshair
    case move
    case notAllowed = "not-allowed"
}

public struct WidgetInteractionAppearance: Codable, Equatable, Sendable {
    public let color: String?
    public let backgroundColor: String?
    public let opacity: Double?
    public let borderColor: String?
    public let shadow: WidgetShadow?
    public let scale: Double?

    public init(
        color: String? = nil,
        backgroundColor: String? = nil,
        opacity: Double? = nil,
        borderColor: String? = nil,
        shadow: WidgetShadow? = nil,
        scale: Double? = nil
    ) {
        self.color = color
        self.backgroundColor = backgroundColor
        self.opacity = opacity
        self.borderColor = borderColor
        self.shadow = shadow
        self.scale = scale
    }
}

public struct WidgetInteractionStyle: Codable, Equatable, Sendable {
    public let cursor: WidgetCursor?
    public let hover: WidgetInteractionAppearance?
    public let pressed: WidgetInteractionAppearance?
    public let focus: WidgetInteractionAppearance?
    public let disabled: WidgetInteractionAppearance?

    public init(
        cursor: WidgetCursor? = nil,
        hover: WidgetInteractionAppearance? = nil,
        pressed: WidgetInteractionAppearance? = nil,
        focus: WidgetInteractionAppearance? = nil,
        disabled: WidgetInteractionAppearance? = nil
    ) {
        self.cursor = cursor
        self.hover = hover
        self.pressed = pressed
        self.focus = focus
        self.disabled = disabled
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
    public let minWidth: WidgetLength?
    public let maxWidth: WidgetLength?
    public let minHeight: WidgetLength?
    public let maxHeight: WidgetLength?
    public let aspectRatio: Double?
    public let flexGrow: Double?
    public let flexShrink: Double?
    public let flexBasis: WidgetLength?
    public let flexWrap: String?
    public let alignSelf: WidgetAlignment?
    public let radius: WidgetRadius?
    public let border: WidgetBorder?
    public let shadow: WidgetShadow?
    public let shadows: [WidgetShadow]?
    public let font: WidgetFont?
    public let tokens: [WidgetStyleToken]?
    public let overflow: String?
    public let interaction: WidgetInteractionStyle?

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
        tokens: [WidgetStyleToken]? = nil,
        minWidth: WidgetLength? = nil, maxWidth: WidgetLength? = nil,
        minHeight: WidgetLength? = nil, maxHeight: WidgetLength? = nil,
        aspectRatio: Double? = nil, flexGrow: Double? = nil, flexShrink: Double? = nil,
        flexBasis: WidgetLength? = nil, flexWrap: String? = nil, alignSelf: WidgetAlignment? = nil,
        shadows: [WidgetShadow]? = nil, overflow: String? = nil,
        interaction: WidgetInteractionStyle? = nil
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
        self.minWidth = minWidth; self.maxWidth = maxWidth; self.minHeight = minHeight; self.maxHeight = maxHeight
        self.aspectRatio = aspectRatio; self.flexGrow = flexGrow; self.flexShrink = flexShrink
        self.flexBasis = flexBasis; self.flexWrap = flexWrap; self.alignSelf = alignSelf
        self.radius = radius.map(WidgetRadius.uniform)
        self.border = border
        self.shadow = shadow
        self.shadows = shadows
        self.font = font
        self.tokens = tokens
        self.overflow = overflow
        self.interaction = interaction
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
        tokens: [WidgetStyleToken]? = nil,
        minWidth: WidgetLength? = nil, maxWidth: WidgetLength? = nil,
        minHeight: WidgetLength? = nil, maxHeight: WidgetLength? = nil,
        aspectRatio: Double? = nil, flexGrow: Double? = nil, flexShrink: Double? = nil,
        flexBasis: WidgetLength? = nil, flexWrap: String? = nil, alignSelf: WidgetAlignment? = nil,
        shadows: [WidgetShadow]? = nil, overflow: String? = nil,
        interaction: WidgetInteractionStyle? = nil
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
        self.minWidth = minWidth; self.maxWidth = maxWidth; self.minHeight = minHeight; self.maxHeight = maxHeight
        self.aspectRatio = aspectRatio; self.flexGrow = flexGrow; self.flexShrink = flexShrink
        self.flexBasis = flexBasis; self.flexWrap = flexWrap; self.alignSelf = alignSelf
        self.radius = radius.map(WidgetRadius.uniform)
        self.border = border
        self.shadow = shadow
        self.shadows = shadows
        self.font = font
        self.tokens = tokens
        self.overflow = overflow
        self.interaction = interaction
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

public struct WidgetStateReference: Codable, Equatable, Sendable {
    public let key: String
    public let initial: WidgetJSONValue

    public init(key: String, initial: WidgetJSONValue) {
        self.key = key
        self.initial = initial
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

public struct WidgetTree: Codable, Equatable, Sendable {
    public let kind: WidgetNodeKind
    public let key: WidgetKey?
    public let children: [WidgetTree]
    public let text: String?
    public let provider: String?
    public let style: WidgetStyle?
    public let value: Double?
    public let minimum: Double?
    public let maximum: Double?
    public let step: Double?
    public let orientation: String?
    public let name: String?
    public let source: ImageSource?
    public let options: WidgetImageOptions?
    public let action: WidgetAction?
    public let disabled: Bool?
    public let columns: Int?
    public let gradientStops: [WidgetGradientStop]?
    public let gradientDirection: String?
    public let textureSource: WidgetTextureSource?
    public let transform: WidgetTransform?
    public let animation: WidgetAnimation?
    public let imageFit: WidgetImageFit?
    public let imageRepeat: WidgetImageRepeat?
    public let imagePosition: String?
    public let tint: String?
    public let segments: Int?
    public let values: [Double]?
    public let state: WidgetStateReference?

    public init(
        kind: WidgetNodeKind,
        key: WidgetKey? = nil,
        children: [WidgetTree] = [],
        text: String? = nil,
        provider: String? = nil,
        style: WidgetStyle? = nil,
        value: Double? = nil,
        minimum: Double? = nil,
        maximum: Double? = nil,
        step: Double? = nil,
        orientation: String? = nil,
        name: String? = nil,
        source: ImageSource? = nil,
        options: WidgetImageOptions? = nil,
        action: WidgetAction? = nil,
        disabled: Bool? = nil,
        columns: Int? = nil,
        gradientStops: [WidgetGradientStop]? = nil,
        gradientDirection: String? = nil,
        textureSource: WidgetTextureSource? = nil,
        transform: WidgetTransform? = nil,
        animation: WidgetAnimation? = nil,
        imageFit: WidgetImageFit? = nil,
        imageRepeat: WidgetImageRepeat? = nil,
        imagePosition: String? = nil,
        tint: String? = nil,
        segments: Int? = nil,
        values: [Double]? = nil,
        state: WidgetStateReference? = nil
    ) {
        self.kind = kind
        self.key = key
        self.children = children
        self.text = text
        self.provider = provider
        self.style = style
        self.value = value
        self.minimum = minimum
        self.maximum = maximum
        self.step = step
        self.orientation = orientation
        self.name = name
        self.source = source
        self.options = options
        self.action = action
        self.disabled = disabled
        self.columns = columns
        self.gradientStops = gradientStops
        self.gradientDirection = gradientDirection
        self.textureSource = textureSource
        self.transform = transform
        self.animation = animation
        self.imageFit = imageFit
        self.imageRepeat = imageRepeat
        self.imagePosition = imagePosition
        self.tint = tint
        self.segments = segments
        self.values = values
        self.state = state
    }

    private enum CodingKeys: String, CodingKey {
        case kind, key, children, text, provider, style, value, minimum, maximum, step, orientation, name, source, options, action, disabled, columns
        case stops, direction, textureSource, legacyGradientStops = "gradientStops", transform, animation
        case imageFit, imageRepeat, imagePosition, tint, segments, values, state
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
        minimum = try container.decodeIfPresent(Double.self, forKey: .minimum)
        maximum = try container.decodeIfPresent(Double.self, forKey: .maximum)
        step = try container.decodeIfPresent(Double.self, forKey: .step)
        orientation = try container.decodeIfPresent(String.self, forKey: .orientation)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        if kind == .texture {
            source = nil
            let currentTextureSource = try container.decodeIfPresent(WidgetTextureSource.self, forKey: .source)
            if let currentTextureSource {
                textureSource = currentTextureSource
            } else {
                textureSource = try container.decodeIfPresent(WidgetTextureSource.self, forKey: .textureSource)
            }
        } else {
            source = try container.decodeIfPresent(ImageSource.self, forKey: .source)
            textureSource = try container.decodeIfPresent(WidgetTextureSource.self, forKey: .textureSource)
        }
        options = try container.decodeIfPresent(WidgetImageOptions.self, forKey: .options)
        action = try container.decodeIfPresent(WidgetAction.self, forKey: .action)
        disabled = try container.decodeIfPresent(Bool.self, forKey: .disabled)
        columns = try container.decodeIfPresent(Int.self, forKey: .columns)
        gradientStops = try container.decodeIfPresent([WidgetGradientStop].self, forKey: .stops)
            ?? container.decodeIfPresent([WidgetGradientStop].self, forKey: .legacyGradientStops)
        gradientDirection = try container.decodeIfPresent(String.self, forKey: .direction)
        transform = try container.decodeIfPresent(WidgetTransform.self, forKey: .transform)
        animation = try container.decodeIfPresent(WidgetAnimation.self, forKey: .animation)
        imageFit = try container.decodeIfPresent(WidgetImageFit.self, forKey: .imageFit)
        imageRepeat = try container.decodeIfPresent(WidgetImageRepeat.self, forKey: .imageRepeat)
        imagePosition = try container.decodeIfPresent(String.self, forKey: .imagePosition)
        tint = try container.decodeIfPresent(String.self, forKey: .tint)
        segments = try container.decodeIfPresent(Int.self, forKey: .segments)
        values = try container.decodeIfPresent([Double].self, forKey: .values)
        state = try container.decodeIfPresent(WidgetStateReference.self, forKey: .state)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(kind, forKey: .kind)
        try container.encodeIfPresent(key, forKey: .key)
        try container.encode(children, forKey: .children)
        try container.encodeIfPresent(text, forKey: .text)
        try container.encodeIfPresent(provider, forKey: .provider)
        try container.encodeIfPresent(style, forKey: .style)
        try container.encodeIfPresent(value, forKey: .value)
        try container.encodeIfPresent(minimum, forKey: .minimum)
        try container.encodeIfPresent(maximum, forKey: .maximum)
        try container.encodeIfPresent(step, forKey: .step)
        try container.encodeIfPresent(orientation, forKey: .orientation)
        try container.encodeIfPresent(name, forKey: .name)
        if kind == .texture {
            try container.encodeIfPresent(textureSource, forKey: .source)
        } else {
            try container.encodeIfPresent(source, forKey: .source)
        }
        try container.encodeIfPresent(options, forKey: .options)
        try container.encodeIfPresent(action, forKey: .action)
        try container.encodeIfPresent(disabled, forKey: .disabled)
        try container.encodeIfPresent(columns, forKey: .columns)
        try container.encodeIfPresent(gradientStops, forKey: .stops)
        try container.encodeIfPresent(gradientDirection, forKey: .direction)
        try container.encodeIfPresent(transform, forKey: .transform)
        try container.encodeIfPresent(animation, forKey: .animation)
        try container.encodeIfPresent(imageFit, forKey: .imageFit)
        try container.encodeIfPresent(imageRepeat, forKey: .imageRepeat)
        try container.encodeIfPresent(imagePosition, forKey: .imagePosition)
        try container.encodeIfPresent(tint, forKey: .tint)
        try container.encodeIfPresent(segments, forKey: .segments)
        try container.encodeIfPresent(values, forKey: .values)
        try container.encodeIfPresent(state, forKey: .state)
    }

    public func validationIssues(path: String = "root") -> [WidgetTreeValidationIssue] {
        var issues: [WidgetTreeValidationIssue] = []
        var pending: [(node: WidgetTree, path: String)] = [(self, path)]
        while let current = pending.popLast() {
            issues.append(contentsOf: current.node.localValidationIssues(path: current.path))
            for index in current.node.children.indices.reversed() {
                pending.append((
                    current.node.children[index],
                    "\(current.path).children[\(index)]"
                ))
            }
        }
        return issues
    }

    private func localValidationIssues(path: String) -> [WidgetTreeValidationIssue] {
        var issues: [WidgetTreeValidationIssue] = []
        let isContainer = [.column, .row, .stack, .box, .grid, .button, .gradient, .clip, .transform].contains(kind)

        if isContainer && text != nil {
            issues.append(.init(path: path, message: "container nodes cannot define text"))
        }
        if !isContainer && !children.isEmpty {
            issues.append(.init(path: path, message: "leaf nodes cannot define children"))
        }
        if kind == .text || kind == .textField {
            if (text == nil || text?.isEmpty == true) && provider == nil && state == nil {
                issues.append(.init(path: path, message: "\(kind.rawValue) nodes require non-empty text"))
            }
            if kind == .textField && provider != nil {
                issues.append(.init(path: "\(path).provider", message: "textField nodes cannot bind to a provider"))
            }
        }
        if kind == .toggle && value != 0 && value != 1 {
            issues.append(.init(path: "\(path).value", message: "toggle value must be zero or one"))
        }
        if let provider, provider.isEmpty {
            issues.append(.init(path: "\(path).provider", message: "provider name must be non-empty"))
        }
        if let state, state.key.isEmpty {
            issues.append(.init(path: "\(path).state.key", message: "state key must be non-empty"))
        }
        if state != nil && ![.text, .textField, .toggle, .slider, .gauge, .progress, .segmentedProgress].contains(kind) {
            issues.append(.init(path: "\(path).state", message: "state bindings are supported only by text, textField, toggle, slider, gauge, progress, and segmentedProgress nodes"))
        }
        if let state {
            validateStateValue(state.initial, for: kind, minimum: minimum, maximum: maximum, path: "\(path).state.initial", issues: &issues)
        }
        if kind == .gauge || kind == .progress || kind == .segmentedProgress {
            if (value == nil && provider == nil) || maximum == nil {
                issues.append(.init(path: path, message: "\(kind.rawValue) nodes require value or a provider and maximum"))
            } else if let value, let maximum, value < 0 || value > maximum || maximum <= 0 {
                issues.append(.init(path: "\(path).value", message: "\(kind.rawValue) value must be within a positive maximum"))
            }
        }
        if kind == .segmentedProgress && (segments == nil || segments ?? 0 <= 0) {
            issues.append(.init(path: "\(path).segments", message: "segmentedProgress nodes require a positive segment count"))
        }
        if kind == .slider {
            if minimum == nil || maximum == nil || value == nil {
                issues.append(.init(path: path, message: "slider nodes require value, minimum, and maximum"))
            } else if let minimum, let maximum, !minimum.isFinite || !maximum.isFinite || maximum <= minimum {
                issues.append(.init(path: "\(path).maximum", message: "slider maximum must be greater than minimum"))
            } else if let value, let minimum, let maximum, !value.isFinite || value < minimum || value > maximum {
                issues.append(.init(path: "\(path).value", message: "slider value must be between minimum and maximum"))
            }
            if let step, !step.isFinite || step <= 0 {
                issues.append(.init(path: "\(path).step", message: "slider step must be greater than zero"))
            }
        }
        if kind == .spectrum && values == nil && provider == nil {
            issues.append(.init(path: path, message: "spectrum nodes require values or a provider"))
        }
        if kind == .spectrum, let values, values.isEmpty {
            issues.append(.init(path: "\(path).values", message: "spectrum values must be non-empty"))
        }
        if kind == .spectrum, let maximum {
            if !maximum.isFinite || maximum <= 0 {
                issues.append(.init(path: "\(path).maximum", message: "spectrum maximum must be a positive finite number"))
            } else if let values {
                for (index, value) in values.enumerated() {
                    if !value.isFinite {
                        issues.append(.init(path: "\(path).values[\(index)]", message: "spectrum values must be finite numbers"))
                    } else if value < 0 || value > maximum {
                        issues.append(.init(path: "\(path).values[\(index)]", message: "spectrum values must be between zero and maximum"))
                    }
                }
            }
        } else if kind == .spectrum, let values {
            for (index, value) in values.enumerated() where !value.isFinite {
                issues.append(.init(path: "\(path).values[\(index)]", message: "spectrum values must be finite numbers"))
            }
        }
        if kind == .gradient {
            if gradientStops == nil || gradientStops?.isEmpty == true {
                issues.append(.init(path: "\(path).gradientStops", message: "gradient nodes require at least one color stop"))
            }
            if let gradientStops {
                for (index, stop) in gradientStops.enumerated() {
                    if stop.color.isEmpty {
                        issues.append(.init(path: "\(path).gradientStops[\(index)].color", message: "gradient stop color must be non-empty"))
                    }
                    if let position = stop.position, !(0...1).contains(position) {
                        issues.append(.init(path: "\(path).gradientStops[\(index)].position", message: "gradient stop position must be between zero and one"))
                    }
                }
            }
            if let gradientDirection, gradientDirection.isEmpty {
                issues.append(.init(path: "\(path).gradientDirection", message: "gradient direction must be non-empty"))
            }
        }
        if kind == .texture {
            if textureSource == nil {
                issues.append(.init(path: "\(path).textureSource", message: "texture nodes require an explicit builtIn or asset source"))
            } else if case .builtIn(let name) = textureSource, name.isEmpty {
                issues.append(.init(path: "\(path).textureSource.name", message: "texture builtIn name must be non-empty"))
            } else if case .asset(let name) = textureSource, name.isEmpty {
                issues.append(.init(path: "\(path).textureSource.name", message: "texture asset name must be non-empty"))
            }
        }
        if kind == .transform {
            if transform == nil {
                issues.append(.init(path: "\(path).transform", message: "transform nodes require a transform descriptor"))
            } else if let transform {
                let values = [("offsetX", transform.offsetX), ("offsetY", transform.offsetY), ("scale", transform.scale), ("rotation", transform.rotation)]
                for (name, value) in values {
                    if let value, !value.isFinite {
                        issues.append(.init(path: "\(path).transform.\(name)", message: "transform value must be finite"))
                    }
                }
                if let scale = transform.scale, scale.isFinite && scale <= 0 {
                    issues.append(.init(path: "\(path).transform.scale", message: "transform scale must be greater than zero"))
                }
            }
        }
        if let animation {
            if animation.property.isEmpty {
                issues.append(.init(path: "\(path).animation.property", message: "animation property must be non-empty"))
            }
            if !animation.from.isFinite {
                issues.append(.init(path: "\(path).animation.from", message: "animation from value must be finite"))
            }
            if !animation.to.isFinite {
                issues.append(.init(path: "\(path).animation.to", message: "animation to value must be finite"))
            }
            if !animation.duration.isFinite || animation.duration <= 0 {
                issues.append(.init(path: "\(path).animation.duration", message: "animation duration must be greater than zero"))
            }
            if let delay = animation.delay, !delay.isFinite || delay < 0 {
                issues.append(.init(path: "\(path).animation.delay", message: "animation delay must be zero or greater"))
            }
            if let easing = animation.easing, easing.isEmpty {
                issues.append(.init(path: "\(path).animation.easing", message: "animation easing must be non-empty"))
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
            if let imagePosition, imagePosition.isEmpty {
                issues.append(.init(path: "\(path).imagePosition", message: "image position must be non-empty"))
            }
            if let tint, tint.isEmpty {
                issues.append(.init(path: "\(path).tint", message: "image tint must be non-empty"))
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
        if disabled != nil && ![.button, .slider, .textField, .toggle].contains(kind) {
            issues.append(.init(path: "\(path).disabled", message: "only interactive controls may be disabled"))
        }
        if kind != .slider && minimum != nil { issues.append(.init(path: "\(path).minimum", message: "only slider nodes may define minimum")) }
        if kind != .slider && step != nil { issues.append(.init(path: "\(path).step", message: "only slider nodes may define step")) }
        if kind != .icon && name != nil { issues.append(.init(path: "\(path).name", message: "only icon nodes may define a name")) }
        if kind != .image && source != nil { issues.append(.init(path: "\(path).source", message: "only image nodes may define a source")) }
        if kind != .image && options != nil { issues.append(.init(path: "\(path).options", message: "only image nodes may define image options")) }
        if kind != .divider && orientation != nil { issues.append(.init(path: "\(path).orientation", message: "only divider nodes may define an orientation")) }
        if kind != .grid && columns != nil { issues.append(.init(path: "\(path).columns", message: "only grid nodes may define columns")) }
        if kind != .gradient && gradientStops != nil { issues.append(.init(path: "\(path).gradientStops", message: "only gradient nodes may define gradient stops")) }
        if kind != .gradient && gradientDirection != nil { issues.append(.init(path: "\(path).gradientDirection", message: "only gradient nodes may define a gradient direction")) }
        if kind != .texture && textureSource != nil { issues.append(.init(path: "\(path).textureSource", message: "only texture nodes may define a texture source")) }
        if kind != .transform && transform != nil { issues.append(.init(path: "\(path).transform", message: "only transform nodes may define a transform descriptor")) }
        if kind != .image && imageFit != nil { issues.append(.init(path: "\(path).imageFit", message: "only image nodes may define image fit")) }
        if kind != .image && imageRepeat != nil { issues.append(.init(path: "\(path).imageRepeat", message: "only image nodes may define image repeat")) }
        if kind != .image && imagePosition != nil { issues.append(.init(path: "\(path).imagePosition", message: "only image nodes may define an image position")) }
        if kind != .image && tint != nil { issues.append(.init(path: "\(path).tint", message: "only image nodes may define a tint")) }
        if kind != .segmentedProgress && segments != nil { issues.append(.init(path: "\(path).segments", message: "only segmentedProgress nodes may define segments")) }
        if kind != .spectrum && values != nil { issues.append(.init(path: "\(path).values", message: "only spectrum nodes may define values")) }
        switch action {
        case .invoke(let name, _), .set(let name, _):
            if name.isEmpty { issues.append(.init(path: "\(path).action.name", message: "action name must be non-empty")) }
        case nil: break
        }

        validateLength(style?.width, path: "\(path).style.width", issues: &issues)
        validateLength(style?.height, path: "\(path).style.height", issues: &issues)
        validateLength(style?.minWidth, path: "\(path).style.minWidth", issues: &issues)
        validateLength(style?.maxWidth, path: "\(path).style.maxWidth", issues: &issues)
        validateLength(style?.minHeight, path: "\(path).style.minHeight", issues: &issues)
        validateLength(style?.maxHeight, path: "\(path).style.maxHeight", issues: &issues)
        validateLength(style?.flexBasis, path: "\(path).style.flexBasis", issues: &issues)
        validateSpacing(style?.padding, path: "\(path).style.padding", allowNegative: false, issues: &issues)
        validateSpacing(style?.margin, path: "\(path).style.margin", allowNegative: true, issues: &issues)
        if let gap = style?.gap, gap < 0 { issues.append(.init(path: "\(path).style.gap", message: "gap must be zero or greater")) }
        if let opacity = style?.opacity, !(0...1).contains(opacity) { issues.append(.init(path: "\(path).style.opacity", message: "opacity must be between zero and one")) }
        validateRadius(style?.radius, path: "\(path).style.radius", issues: &issues)
        if let ratio = style?.aspectRatio, !ratio.isFinite || ratio <= 0 { issues.append(.init(path: "\(path).style.aspectRatio", message: "aspect ratio must be greater than zero")) }
        if let grow = style?.flexGrow, !grow.isFinite || grow < 0 { issues.append(.init(path: "\(path).style.flexGrow", message: "flex grow must be zero or greater")) }
        if let shrink = style?.flexShrink, !shrink.isFinite || shrink < 0 { issues.append(.init(path: "\(path).style.flexShrink", message: "flex shrink must be zero or greater")) }
        if let wrap = style?.flexWrap, wrap != "nowrap" && wrap != "wrap" { issues.append(.init(path: "\(path).style.flexWrap", message: "flex wrap must be nowrap or wrap")) }
        if let overflow = style?.overflow, !["visible", "hidden", "clip"].contains(overflow) { issues.append(.init(path: "\(path).style.overflow", message: "overflow must be visible, hidden, or clip")) }
        if let border = style?.border {
            if let width = border.width, width < 0 { issues.append(.init(path: "\(path).style.border.width", message: "border width must be zero or greater")) }
            if let radius = border.radius, radius < 0 { issues.append(.init(path: "\(path).style.border.radius", message: "border radius must be zero or greater")) }
        }
        let shadows = style?.shadow.map { [("\(path).style.shadow", $0)] } ?? []
            + (style?.shadows ?? []).enumerated().map { ("\(path).style.shadows[\($0.offset)]", $0.element) }
        for (shadowPath, shadow) in shadows {
            if let radius = shadow.radius, !radius.isFinite || radius < 0 { issues.append(.init(path: "\(shadowPath).radius", message: "shadow radius must be zero or greater")) }
            if let opacity = shadow.opacity, !opacity.isFinite || !(0...1).contains(opacity) { issues.append(.init(path: "\(shadowPath).opacity", message: "shadow opacity must be between zero and one")) }
            if let x = shadow.x, !x.isFinite { issues.append(.init(path: "\(shadowPath).x", message: "shadow offset must be finite")) }
            if let y = shadow.y, !y.isFinite { issues.append(.init(path: "\(shadowPath).y", message: "shadow offset must be finite")) }
            if !["outset", "inset", "text"].contains(shadow.kind) { issues.append(.init(path: "\(shadowPath).kind", message: "shadow kind must be outset, inset, or text")) }
        }
        if let font = style?.font {
            if let size = font.size, !size.isFinite || size <= 0 { issues.append(.init(path: "\(path).style.font.size", message: "font size must be greater than zero")) }
            if let leading = font.leading, !leading.isFinite || leading < 0 { issues.append(.init(path: "\(path).style.font.leading", message: "font leading must be zero or greater")) }
            if let tracking = font.tracking, !tracking.isFinite { issues.append(.init(path: "\(path).style.font.tracking", message: "font tracking must be finite")) }
            if let alignment = font.alignment, !["leading", "center", "trailing", "justified"].contains(alignment) { issues.append(.init(path: "\(path).style.font.alignment", message: "font alignment must be leading, center, trailing, or justified")) }
            if let lineLimit = font.lineLimit, lineLimit <= 0 { issues.append(.init(path: "\(path).style.font.lineLimit", message: "font line limit must be greater than zero")) }
            if let truncation = font.truncation, !["head", "middle", "tail", "clip"].contains(truncation) { issues.append(.init(path: "\(path).style.font.truncation", message: "font truncation must be head, middle, tail, or clip")) }
        }
        if let interaction = style?.interaction {
            let states: [(String, WidgetInteractionAppearance?)] = [
                ("hover", interaction.hover),
                ("pressed", interaction.pressed),
                ("focus", interaction.focus),
                ("disabled", interaction.disabled)
            ]
            for (name, appearance) in states {
                validateInteractionAppearance(appearance, path: "\(path).style.interaction.\(name)", issues: &issues)
            }
        }

        return issues
    }

    private func validateSpacing(_ spacing: WidgetSpacing?, path: String, allowNegative: Bool, issues: inout [WidgetTreeValidationIssue]) {
        switch spacing {
        case .points(let value) where !value.isFinite || (!allowNegative && value < 0):
            issues.append(.init(path: path, message: "spacing must be zero or greater"))
        case .insets(let insets):
            let values = [("top", insets.top), ("right", insets.right), ("bottom", insets.bottom), ("left", insets.left), ("horizontal", insets.horizontal), ("vertical", insets.vertical)]
            for (name, value) in values where value.map({ !$0.isFinite || (!allowNegative && $0 < 0) }) == true {
                issues.append(.init(path: "\(path).\(name)", message: "spacing must be zero or greater"))
            }
        default: break
        }
    }

    private func validateLength(_ length: WidgetLength?, path: String, issues: inout [WidgetTreeValidationIssue]) {
        switch length {
        case .points(let value) where !value.isFinite || value <= 0:
            issues.append(.init(path: path, message: "length must be greater than zero"))
        case .percent(let value) where !value.isFinite || value < 0 || value > 100:
            issues.append(.init(path: path, message: "percent length must be between zero and 100"))
        case .fraction(let value) where !value.isFinite || value <= 0:
            issues.append(.init(path: path, message: "fraction length must be greater than zero"))
        default: break
        }
    }

    private func validateRadius(_ radius: WidgetRadius?, path: String, issues: inout [WidgetTreeValidationIssue]) {
        let values: [(String, Double?)]
        switch radius {
        case .uniform(let value): values = [("", value)]
        case .corners(let radii): values = [(".topLeft", radii.topLeft), (".topRight", radii.topRight), (".bottomRight", radii.bottomRight), (".bottomLeft", radii.bottomLeft)]
        case nil: return
        }
        for (suffix, value) in values where value.map({ !$0.isFinite || $0 < 0 }) == true {
            issues.append(.init(path: path + suffix, message: "radius must be zero or greater"))
        }
    }

    private func validateStateValue(
        _ value: WidgetJSONValue,
        for kind: WidgetNodeKind,
        minimum: Double?,
        maximum: Double?,
        path: String,
        issues: inout [WidgetTreeValidationIssue]
    ) {
        switch kind {
        case .text:
            switch value {
            case .string, .boolean: break
            case .number(let number) where number.isFinite: break
            default:
                issues.append(.init(path: path, message: "text state must be a string, number, or boolean"))
            }
        case .textField:
            if case .string = value {} else {
                issues.append(.init(path: path, message: "textField state must start as a string"))
            }
        case .toggle:
            if case .boolean = value {} else {
                issues.append(.init(path: path, message: "toggle state must start as a boolean"))
            }
        case .slider, .gauge, .progress, .segmentedProgress:
            guard case .number(let number) = value, number.isFinite else {
                issues.append(.init(path: path, message: "\(kind.rawValue) state must start as a finite number"))
                return
            }
            let lowerBound = kind == .slider ? minimum : 0
            guard let lowerBound, let maximum else {
                issues.append(.init(path: path, message: "\(kind.rawValue) state must be within its declared range"))
                return
            }
            if !lowerBound.isFinite || !maximum.isFinite || maximum <= lowerBound || number < lowerBound || number > maximum {
                issues.append(.init(path: path, message: "\(kind.rawValue) state must be within its declared range"))
            }
        default:
            break
        }
    }

    private func validateInteractionAppearance(
        _ appearance: WidgetInteractionAppearance?,
        path: String,
        issues: inout [WidgetTreeValidationIssue]
    ) {
        guard let appearance else { return }
        for (name, value) in [
            ("color", appearance.color),
            ("backgroundColor", appearance.backgroundColor),
            ("borderColor", appearance.borderColor)
        ] where value?.isEmpty == true {
            issues.append(.init(path: "\(path).\(name)", message: "color must be non-empty"))
        }
        if let opacity = appearance.opacity, !opacity.isFinite || !(0...1).contains(opacity) {
            issues.append(.init(path: "\(path).opacity", message: "opacity must be between zero and one"))
        }
        if let scale = appearance.scale, !scale.isFinite || scale <= 0 {
            issues.append(.init(path: "\(path).scale", message: "scale must be greater than zero"))
        }
        if let shadow = appearance.shadow {
            if let radius = shadow.radius, !radius.isFinite || radius < 0 { issues.append(.init(path: "\(path).shadow.radius", message: "shadow radius must be zero or greater")) }
            if let opacity = shadow.opacity, !opacity.isFinite || !(0...1).contains(opacity) { issues.append(.init(path: "\(path).shadow.opacity", message: "shadow opacity must be between zero and one")) }
            if let x = shadow.x, !x.isFinite { issues.append(.init(path: "\(path).shadow.x", message: "shadow offset must be finite")) }
            if let y = shadow.y, !y.isFinite { issues.append(.init(path: "\(path).shadow.y", message: "shadow offset must be finite")) }
            if !["outset", "inset", "text"].contains(shadow.kind) { issues.append(.init(path: "\(path).shadow.kind", message: "shadow kind must be outset, inset, or text")) }
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
