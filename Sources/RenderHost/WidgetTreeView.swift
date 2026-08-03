import AppKit
import SwiftUI
import RenderHostCore

struct WidgetTreeView: View {
    let tree: WidgetTree
    @ObservedObject var providers: ProviderStore
    let workspace: String?
    let declaredAssets: Set<String>?
    var onAction: ((WidgetAction) -> Void)?
    @State private var animationStartDate: Date

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    init(
        tree: WidgetTree,
        providers: ProviderStore,
        workspace: String? = nil,
        declaredAssets: Set<String>? = nil,
        onAction: ((WidgetAction) -> Void)? = nil
    ) {
        self.tree = tree
        self.providers = providers
        self.workspace = workspace
        self.declaredAssets = declaredAssets
        self.onAction = onAction
        _animationStartDate = State(initialValue: Date())
    }

    var body: some View {
        if let animation = animation {
            TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { context in
                surface(animationValue: animation.value(at: context.date, startDate: animationStartDate))
            }
        } else {
            surface(animationValue: nil)
        }
    }

    private func surface(animationValue: Double?) -> AnyView {
        var result = AnyView(content)
        result = AnyView(result
            .frame(width: fixedWidth, height: fixedHeight, alignment: frameAlignment)
            .frame(
                maxWidth: expandsWidth ? .infinity : nil,
                maxHeight: expandsHeight ? .infinity : nil,
                alignment: frameAlignment
            )
            .padding(edgeInsets(tree.style?.padding))
            .padding(edgeInsets(tree.style?.margin))
            .foregroundColor(foregroundColor)
            .font(nativeFont)
            .background(backgroundShape)
            .overlay(borderShape)
            .shadow(
                color: shadowColor,
                radius: CGFloat(tree.style?.shadow?.radius ?? 0),
                x: CGFloat(tree.style?.shadow?.x ?? 0),
                y: CGFloat(tree.style?.shadow?.y ?? 0)
            )
        )

        let transform = WidgetTransformValues(tree: tree)
        result = AnyView(result
            .scaleEffect(transform.scale)
            .rotationEffect(transform.rotation)
            .offset(x: transform.x, y: transform.y)
        )

        var opacity = tree.style?.opacity ?? 1
        if let animationValue, animation?.property == "opacity" {
            opacity *= animationValue
        }
        result = AnyView(result.opacity(opacity))

        if let animationValue, let animation {
            switch animation.property {
            case "rotation": result = AnyView(result.rotationEffect(.degrees(animationValue)))
            case "scale": result = AnyView(result.scaleEffect(animationValue))
            case "offsetx": result = AnyView(result.offset(x: animationValue))
            case "offsety": result = AnyView(result.offset(y: animationValue))
            default: break
            }
        }

        if tree.kind.rawValue == "clip" {
            result = AnyView(result.clipShape(RoundedRectangle(cornerRadius: clipRadius)))
        }
        return result
    }

    private var content: AnyView {
        switch tree.kind.rawValue {
        case "column":
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    child(tree.children[index])
                    if tree.style?.justifyContent == .spaceBetween && index < tree.children.count - 1 {
                        Spacer(minLength: 0)
                    }
                }
            })
        case "row":
            return AnyView(HStack(alignment: verticalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    child(tree.children[index])
                    if tree.style?.justifyContent == .spaceBetween && index < tree.children.count - 1 {
                        Spacer(minLength: 0)
                    }
                }
            })
        case "stack":
            return childStack
        case "box":
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    child(tree.children[index])
                }
            })
        case "grid":
            return AnyView(LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: gap), count: max(tree.columns ?? 1, 1)),
                alignment: horizontalAlignment,
                spacing: gap
            ) {
                ForEach(tree.children.indices, id: \.self) { index in
                    child(tree.children[index])
                }
            })
        case "spacer":
            return AnyView(SwiftUI.Spacer(minLength: 0))
        case "divider":
            return AnyView(
                Rectangle()
                    .fill(foregroundColor ?? Color.secondary)
                    .frame(
                        width: tree.orientation == "vertical" ? 1 : nil,
                        height: tree.orientation == "vertical" ? nil : 1
                    )
            )
        case "text":
            return AnyView(Text(displayedText))
        case "textField":
            return AnyView(EditableTextField(initialText: tree.text ?? "", style: tree.style))
        case "toggle":
            return AnyView(EditableToggle(initialValue: (tree.value ?? 0) == 1))
        case "shape":
            return AnyView(RoundedRectangle(cornerRadius: CGFloat(tree.style?.radius ?? 12)).fill(foregroundColor ?? Color.secondary))
        case "icon":
            return AnyView(iconContent)
        case "image":
            return AnyView(imageContent)
        case "button":
            return AnyView(Button(action: {
                guard let action = tree.action else { return }
                onAction?(action)
            }) {
                HStack(spacing: gap) {
                    ForEach(tree.children.indices, id: \.self) { index in
                        child(tree.children[index])
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(tree.action == nil))
        case "gauge":
            return AnyView(gaugeContent)
        case "progress":
            return AnyView(progressContent)
        case "gradient":
            return gradientContent
        case "texture":
            return textureContent
        case "clip", "transform":
            return childStack
        case "segmentedProgress":
            return segmentedProgressContent
        case "spectrum":
            return spectrumContent
        default:
            return AnyView(Text("Node unavailable").accessibilityLabel("Node unavailable"))
        }
    }

    private func child(_ tree: WidgetTree) -> some View {
        WidgetTreeView(
            tree: tree,
            providers: providers,
            workspace: workspace,
            declaredAssets: declaredAssets,
            onAction: onAction
        )
    }

    private var childStack: AnyView {
        AnyView(ZStack(alignment: frameAlignment) {
            ForEach(tree.children.indices, id: \.self) { index in
                child(tree.children[index])
            }
        })
    }

    private var gradientContent: AnyView {
        guard let descriptor = WidgetGradientDescriptor(tree: tree) else {
            return AnyView(ZStack { Color.clear; childStack })
        }
        let stops = descriptor.stops.compactMap { stop -> Gradient.Stop? in
            guard let color = nativeColor(stop.color) else { return nil }
            return Gradient.Stop(color: color, location: stop.location)
        }
        guard !stops.isEmpty else { return AnyView(ZStack { Color.clear; childStack }) }
        let points = gradientPoints(descriptor.direction)
        return AnyView(ZStack {
            LinearGradient(gradient: Gradient(stops: stops), startPoint: points.start, endPoint: points.end)
            childStack
        })
    }

    private var textureContent: AnyView {
        guard let descriptor = WidgetTextureDescriptor(tree: tree) else {
            return AnyView(ZStack { Text("Texture unavailable").accessibilityLabel("Texture unavailable"); childStack })
        }
        switch descriptor.kind {
        case .grain, .grid:
            return AnyView(ZStack {
                WidgetTexturePattern(kind: descriptor.kind, color: foregroundColor ?? .primary)
                childStack
            })
        case .asset(let name):
            guard let image = loadImage(named: name) else {
                return AnyView(ZStack { Text("Texture unavailable").accessibilityLabel("Texture unavailable"); childStack })
            }
            return AnyView(ZStack {
                WidgetRepeatedImage(image: image, repeatMode: .both, tint: foregroundColor)
                    .accessibilityLabel(name)
                childStack
            })
        }
    }

    private var segmentedProgressContent: AnyView {
        if let state = providerValue?.state, state != .available {
            return AnyView(Text(state == .loading ? "Loading…" : "Unavailable"))
        }
        let maximum = max(tree.maximum ?? 1, 0.0001)
        let value = min(max(providerValue?.value ?? tree.value ?? 0, 0), maximum)
        let segments = max(tree.segments ?? 5, 1)
        return AnyView(WidgetSegmentedProgress(
            value: value,
            maximum: maximum,
            segments: segments,
            color: foregroundColor ?? .accentColor
        ))
    }

    private var spectrumContent: AnyView {
        if let state = providerValue?.state, state != .available {
            return AnyView(Text(state == .loading ? "Loading…" : "Unavailable"))
        }
        let values = tree.values ?? []
        guard !values.isEmpty else { return AnyView(Text("Spectrum unavailable").accessibilityLabel("Spectrum unavailable")) }
        let maximum = max(tree.maximum ?? 1, 0.0001)
        return AnyView(WidgetSpectrumBars(values: values, maximum: maximum, color: foregroundColor ?? .accentColor))
    }

    private var gaugeContent: AnyView {
        if let provider = providerValue {
            switch provider.state {
            case .loading: return AnyView(Text("Loading…"))
            case .unavailable: return AnyView(Text("Unavailable"))
            case .available: break
            }
        }
        let maximum = max(tree.maximum ?? 1, 0.0001)
        let value = min(max(providerValue?.value ?? tree.value ?? 0, 0), maximum)
        return AnyView(SwiftUI.Gauge(value: value, in: 0...maximum) { Text("") })
    }

    private var progressContent: AnyView {
        if let provider = providerValue {
            switch provider.state {
            case .loading: return AnyView(Text("Loading…"))
            case .unavailable: return AnyView(Text("Unavailable"))
            case .available: break
            }
        }
        let maximum = max(tree.maximum ?? 100, 0.0001)
        let value = min(max(providerValue?.value ?? tree.value ?? 0, 0), maximum)
        return AnyView(ProgressView(value: value, total: maximum).progressViewStyle(LinearProgressViewStyle()))
    }

    private var iconContent: AnyView {
        guard let name = tree.name else {
            return AnyView(Text("Icon unavailable").accessibilityLabel("Icon unavailable"))
        }
        if LucideIconView.supports(name) {
            return AnyView(LucideIconView(name: name, color: foregroundColor ?? .primary))
        }
        guard let image = NSImage(systemSymbolName: name, accessibilityDescription: name) else {
            return AnyView(Text("Icon unavailable").accessibilityLabel("Icon unavailable"))
        }
        return AnyView(Image(nsImage: image).renderingMode(.template).accessibilityLabel(name))
    }

    private var imageContent: AnyView {
        guard let source = tree.source else { return AnyView(Text("Image unavailable").accessibilityLabel("Image unavailable")) }
        switch source {
        case .asset(let name):
            guard let image = loadImage(named: name) else {
                return AnyView(Text("Image unavailable").accessibilityLabel("Image unavailable"))
            }
            let options = WidgetImageOptions(tree: tree, color: nativeColor)
            let imageAlignment = alignment(for: options.position)
            if options.repeatMode == .none {
                return AnyView(WidgetFittedImage(
                    image: image,
                    fit: options.fit,
                    alignment: imageAlignment,
                    tint: options.tint
                ).accessibilityLabel(name))
            }
            return AnyView(WidgetRepeatedImage(image: image, repeatMode: options.repeatMode, tint: options.tint)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: imageAlignment)
                .accessibilityLabel(name))
        case .url, .provider:
            return AnyView(Text("Image unavailable").accessibilityLabel("Image unavailable"))
        }
    }

    private var providerValue: ProviderValue? {
        guard let provider = tree.provider else { return nil }
        return providers.value(for: provider)
    }

    private var displayedText: String {
        guard let provider = providerValue else { return tree.text ?? "" }
        guard provider.state == .available else {
            return provider.state == .loading ? "Loading…" : "Unavailable"
        }
        if let text = provider.text { return text }
        guard let value = provider.value else { return "Unavailable" }
        if provider.name == "system.time" {
            return Self.timeFormatter.string(from: Date(timeIntervalSince1970: value))
        }
        return "\(Int(value.rounded()))%"
    }

    private var fixedWidth: CGFloat? { points(tree.style?.width) }
    private var fixedHeight: CGFloat? { points(tree.style?.height) }
    private var expandsWidth: Bool { tree.style?.width == .fill }
    private var expandsHeight: Bool { tree.style?.height == .fill }
    private var gap: CGFloat { CGFloat(tree.style?.gap ?? ((tree.kind.rawValue == "column" || tree.kind.rawValue == "row") ? 8 : 0)) }

    private var horizontalAlignment: HorizontalAlignment {
        switch tree.style?.alignItems {
        case .trailing: return .trailing
        case .center: return .center
        default: return .leading
        }
    }

    private var verticalAlignment: VerticalAlignment {
        switch tree.style?.alignItems {
        case .top: return .top
        case .bottom: return .bottom
        default: return .center
        }
    }

    private var frameAlignment: Alignment {
        switch tree.style?.justifyContent {
        case .trailing: return .trailing
        case .bottom: return .bottom
        case .center: return .center
        case .top: return .top
        default: return .leading
        }
    }

    private var foregroundColor: Color? {
        if let color = nativeColor(tree.style?.color) { return color }
        for token in tree.style?.tokens ?? [] {
            switch token {
            case .accent: return .accentColor
            case .danger: return .red
            case .success: return .green
            case .textSecondary: return .secondary
            case .textPrimary: return .primary
            default: continue
            }
        }
        return nil
    }

    private var backgroundColor: Color? {
        if let color = nativeColor(tree.style?.backgroundColor) { return color }
        for token in tree.style?.tokens ?? [] {
            if token == .surface { return Color.black.opacity(0.12) }
            if token == .surfaceElevated { return Color.black.opacity(0.2) }
        }
        return nil
    }

    private var backgroundShape: some View {
        RoundedRectangle(cornerRadius: CGFloat(tree.style?.radius ?? 0)).fill(backgroundColor ?? .clear)
    }

    private var borderShape: some View {
        let border = tree.style?.border
        return RoundedRectangle(cornerRadius: CGFloat(border?.radius ?? tree.style?.radius ?? 0))
            .stroke(nativeColor(border?.color) ?? .clear, lineWidth: CGFloat(border?.width ?? 0))
    }

    private var shadowColor: Color {
        nativeColor(tree.style?.shadow?.color)?.opacity(tree.style?.shadow?.opacity ?? 0.25) ?? .clear
    }

    private var nativeFont: Font? {
        guard let font = tree.style?.font, let size = font.size else { return nil }
        if font.monospace == true {
            return .system(size: CGFloat(size), weight: fontWeight(font.weight), design: .monospaced)
        }
        if let family = font.family {
            return .custom(family, size: CGFloat(size)).weight(fontWeight(font.weight))
        }
        return .system(size: CGFloat(size), weight: fontWeight(font.weight))
    }

    private func fontWeight(_ weight: WidgetFontWeight?) -> Font.Weight {
        switch weight {
        case .medium: return .medium
        case .semibold: return .semibold
        case .bold: return .bold
        default: return .regular
        }
    }

    private func points(_ length: WidgetLength?) -> CGFloat? {
        guard case .points(let value) = length else { return nil }
        return CGFloat(value)
    }

    private func edgeInsets(_ spacing: WidgetSpacing?) -> EdgeInsets {
        switch spacing {
        case .points(let value):
            return EdgeInsets(top: value, leading: value, bottom: value, trailing: value)
        case .insets(let insets):
            return EdgeInsets(
                top: insets.top ?? 0,
                leading: insets.left ?? 0,
                bottom: insets.bottom ?? 0,
                trailing: insets.right ?? 0
            )
        default:
            return EdgeInsets()
        }
    }

    private func nativeColor(_ value: String?) -> Color? {
        guard let value else { return nil }
        let normalized = value.lowercased()
        switch normalized {
        case "black": return .black
        case "white": return .white
        case "red": return .red
        case "green": return .green
        case "blue": return .blue
        case "yellow": return .yellow
        case "orange": return .orange
        case "purple": return .purple
        case "pink": return .pink
        case "gray", "grey": return .gray
        default: break
        }
        guard normalized.hasPrefix("#") else { return nil }
        let digits = String(normalized.dropFirst())
        let expanded = digits.count == 3 ? digits.map { "\($0)\($0)" }.joined() : digits
        guard expanded.count == 6 || expanded.count == 8, let number = UInt64(expanded, radix: 16) else { return nil }
        let red = Double((number >> (expanded.count == 8 ? 24 : 16)) & 0xff) / 255
        let green = Double((number >> (expanded.count == 8 ? 16 : 8)) & 0xff) / 255
        let blue = Double((number >> (expanded.count == 8 ? 8 : 0)) & 0xff) / 255
        let alpha = expanded.count == 8 ? Double(number & 0xff) / 255 : 1
        return Color(red: red, green: green, blue: blue, opacity: alpha)
    }

    private var animation: WidgetNativeAnimation? { WidgetNativeAnimation(tree: tree) }

    private var clipRadius: CGFloat {
        CGFloat(tree.style?.radius ?? 0)
    }

    private func gradientPoints(_ direction: String) -> (start: UnitPoint, end: UnitPoint) {
        let value = direction.lowercased().replacingOccurrences(of: "-", with: "")
        switch value {
        case "leftRight", "leftright": return (.leading, .trailing)
        case "rightLeft", "rightleft": return (.trailing, .leading)
        case "bottomTop", "bottomtop": return (.bottom, .top)
        case "topleft", "topleading": return (.topLeading, .bottomTrailing)
        case "topright", "toptrailing": return (.topTrailing, .bottomLeading)
        case "bottomleft", "bottomleading": return (.bottomLeading, .topTrailing)
        case "bottomright", "bottomtrailing": return (.bottomTrailing, .topLeading)
        default: return (.top, .bottom)
        }
    }

    private func alignment(for position: String) -> Alignment {
        let value = position.lowercased().replacingOccurrences(of: "-", with: "")
        switch value {
        case "topleft", "topleading": return .topLeading
        case "topright", "toptrailing": return .topTrailing
        case "bottomleft", "bottomleading": return .bottomLeading
        case "bottomright", "bottomtrailing": return .bottomTrailing
        case "top": return .top
        case "bottom": return .bottom
        case "left", "leading": return .leading
        case "right", "trailing": return .trailing
        default: return .center
        }
    }

    private func loadImage(named name: String) -> NSImage? {
        return WidgetAssetResolver(
            workspace: workspace.map { URL(fileURLWithPath: $0) },
            declaredAssets: declaredAssets
        ).image(named: name)
    }
}

private struct EditableTextField: View {
    let initialText: String
    let style: WidgetStyle?
    @State private var value: String

    init(initialText: String, style: WidgetStyle?) {
        self.initialText = initialText
        self.style = style
        _value = State(initialValue: initialText)
    }

    var body: some View {
        TextField("", text: $value)
            .textFieldStyle(.plain)
            .padding(8)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: CGFloat(style?.radius ?? 8)))
            .foregroundColor(.primary)
    }
}

private struct EditableToggle: View {
    @State private var value: Bool

    init(initialValue: Bool) {
        _value = State(initialValue: initialValue)
    }

    var body: some View {
        Toggle("", isOn: $value)
            .labelsHidden()
            .toggleStyle(.checkbox)
            .controlSize(.small)
    }
}
