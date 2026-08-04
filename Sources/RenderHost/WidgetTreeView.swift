import AppKit
import SwiftUI
import RenderHostCore

struct WidgetTreeView: View {
    let tree: WidgetTree
    @ObservedObject var providers: ProviderStore
    let workspace: String?
    let declaredAssets: Set<String>?
    let interactionCoordinator: WidgetInteractionCoordinator
    var onAction: ((WidgetAction) -> Void)?
    var onStateChange: ((String, WidgetJSONValue) -> Void)?
    @State private var animationStartDate: Date
    @State private var isHovered = false
    @State private var interactionID = UUID()
    @GestureState private var isPressed = false
    @FocusState private var isFocused: Bool
    @Environment(\.widgetInteractionPhase) private var inheritedInteractionPhase
    private let parentAxis: WidgetParentAxis?

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
        interactionCoordinator: WidgetInteractionCoordinator = WidgetInteractionCoordinator(),
        onAction: ((WidgetAction) -> Void)? = nil,
        onStateChange: ((String, WidgetJSONValue) -> Void)? = nil,
        parentAxis: WidgetParentAxis? = nil
    ) {
        self.tree = tree
        self.providers = providers
        self.workspace = workspace
        self.declaredAssets = declaredAssets
        self.interactionCoordinator = interactionCoordinator
        self.onAction = onAction
        self.onStateChange = onStateChange
        self.parentAxis = parentAxis
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
        var result = AnyView(content
            .environment(\.widgetInteractionPhase, interactionPhase)
            .foregroundColor(foregroundColor)
            .font(nativeFont)
            .padding(edgeInsets(tree.style?.padding))
            .frame(width: fixedWidth, height: fixedHeight, alignment: frameAlignment)
            .frame(
                minWidth: constrainedPoints(tree.style?.minWidth),
                maxWidth: constrainedMax(tree.style?.maxWidth, expands: expandsWidth),
                minHeight: constrainedPoints(tree.style?.minHeight),
                maxHeight: constrainedMax(tree.style?.maxHeight, expands: expandsHeight),
                alignment: selfAlignment
            )
            .aspectRatio(tree.style?.aspectRatio.map { CGFloat($0) }, contentMode: .fit)
            .fixedSize(horizontal: fitsWidth, vertical: fitsHeight)
            .layoutPriority(layoutPriority)
            .frame(
                maxWidth: (expandsWidth || growsInParentWidth || tree.style?.alignSelf == .fill) ? .infinity : nil,
                maxHeight: (expandsHeight || growsInParentHeight || tree.style?.alignSelf == .fill) ? .infinity : nil,
                alignment: selfAlignment
            )
            .background(backgroundShape)
            .overlay(borderShape)
            .padding(edgeInsets(tree.style?.margin))
        )
        if widthPercent != nil || heightPercent != nil {
            result = AnyView(WidgetRelativeFrameLayout(widthPercent: widthPercent, heightPercent: heightPercent) { result })
        }
        for shadow in effectiveShadows where shadow.kind == "outset" {
            result = AnyView(result.shadow(
                color: shadowColor(shadow), radius: CGFloat(shadow.radius ?? 0),
                x: CGFloat(shadow.x ?? 0), y: CGFloat(shadow.y ?? 0)
            ))
        }
        for shadow in effectiveShadows where shadow.kind == "inset" {
            result = AnyView(result.overlay(insetShadow(shadow)))
        }

        let transform = WidgetTransformValues(tree: tree)
        result = AnyView(result
            .scaleEffect(transform.scale * CGFloat(activeAppearance?.scale ?? 1))
            .rotationEffect(transform.rotation)
            .offset(x: transform.x, y: transform.y)
        )

        var opacity = (tree.style?.opacity ?? 1) * (activeAppearance?.opacity ?? 1)
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

        if tree.kind.rawValue == "clip" || tree.style?.overflow == "hidden" || tree.style?.overflow == "clip" {
            result = AnyView(result.clipShape(cornerShape))
        }
        return interactiveSurface(result)
    }

    private var content: AnyView {
        switch tree.kind.rawValue {
        case "column":
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    child(tree.children[index], parentAxis: .vertical)
                        .frame(
                            maxHeight: (tree.children[index].style?.flexGrow ?? 0) > 0 ? .infinity : nil,
                            alignment: childAlignment(tree.children[index])
                        )
                    if tree.style?.justifyContent == .spaceBetween && index < tree.children.count - 1 {
                        Spacer(minLength: 0)
                    }
                }
            })
        case "row":
            if tree.style?.flexWrap == "wrap" {
                return AnyView(WidgetFlowLayout(spacing: gap) {
                    ForEach(tree.children.indices, id: \.self) { index in child(tree.children[index], parentAxis: .horizontal) }
                })
            }
            return AnyView(rowContent)
        case "stack":
            return childStack
        case "box":
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    child(tree.children[index], parentAxis: .vertical)
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
            return styledText
        case "textField":
            return AnyView(EditableTextField(
                initialText: tree.text ?? "",
                style: tree.style,
                disabled: isDisabled,
                onChange: stateChange.map { change in { value in change(.string(value)) } }
            ))
        case "toggle":
            return AnyView(EditableToggle(
                initialValue: (tree.value ?? 0) == 1,
                color: foregroundColor ?? .accentColor,
                disabled: isDisabled,
                onChange: stateChange.map { change in { value in change(.boolean(value)) } }
            ))
        case "shape":
            return AnyView(WidgetCornerShape(tree.style?.radius, fallback: 12).fill(foregroundColor ?? Color.secondary))
        case "icon":
            return AnyView(iconContent)
        case "image":
            return AnyView(imageContent)
        case "button":
            return AnyView(HStack(spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    child(tree.children[index])
                }
            })
        case "slider":
            return AnyView(EditableSlider(
                initialValue: tree.value ?? tree.minimum ?? 0,
                minimum: tree.minimum ?? 0,
                maximum: tree.maximum ?? 1,
                step: tree.step,
                color: foregroundColor ?? .accentColor,
                disabled: isDisabled,
                onChange: stateChange.map { change in { value in change(.number(value)) } }
            ))
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

    private func child(_ tree: WidgetTree, parentAxis: WidgetParentAxis? = nil) -> some View {
        WidgetTreeView(
            tree: tree,
            providers: providers,
            workspace: workspace,
            declaredAssets: declaredAssets,
            interactionCoordinator: interactionCoordinator,
            onAction: onAction,
            onStateChange: onStateChange,
            parentAxis: parentAxis
        )
    }

    private var stateChange: ((WidgetJSONValue) -> Void)? {
        guard let key = tree.state?.key, let onStateChange else { return nil }
        return { value in onStateChange(key, value) }
    }

    private var childStack: AnyView {
        AnyView(ZStack(alignment: frameAlignment) {
            ForEach(tree.children.indices, id: \.self) { index in
                child(tree.children[index])
            }
        })
    }

    private var rowContent: some View {
        HStack(alignment: verticalAlignment, spacing: gap) {
            ForEach(tree.children.indices, id: \.self) { index in
                child(tree.children[index], parentAxis: .horizontal)
                    .frame(
                        maxWidth: (tree.children[index].style?.flexGrow ?? 0) > 0 ? .infinity : nil,
                        alignment: childAlignment(tree.children[index])
                    )
                if tree.style?.justifyContent == .spaceBetween && index < tree.children.count - 1 {
                    Spacer(minLength: 0)
                }
            }
        }
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
        return AnyView(WidgetRingGauge(value: value, maximum: maximum, color: foregroundColor ?? .accentColor))
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
        return AnyView(WidgetLinearProgress(value: value, maximum: maximum, color: foregroundColor ?? .accentColor))
    }

    private var iconContent: AnyView {
        guard let name = tree.name else {
            return AnyView(Text("Icon unavailable").accessibilityLabel("Icon unavailable"))
        }
        if LucideIconView.supports(name) {
            return AnyView(LucideIconView(name: name, color: foregroundColor ?? .primary))
        }
        return AnyView(Text("Icon unavailable").accessibilityLabel("Icon unavailable: unknown SDK icon \(name)"))
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

    private var styledText: AnyView {
        var result = AnyView(Text(displayedText)
            .multilineTextAlignment(textAlignment)
            .lineSpacing(CGFloat(tree.style?.font?.leading ?? 0))
            .tracking(CGFloat(tree.style?.font?.tracking ?? 0))
            .lineLimit(tree.style?.font?.lineLimit)
            .truncationMode(truncationMode)
        )
        if tree.style?.font?.tabularNumbers == true {
            result = AnyView(result.monospacedDigit())
        }
        if tree.style?.font?.truncation == "clip" {
            result = AnyView(result.clipped())
        }
        for shadow in effectiveShadows where shadow.kind == "text" {
            result = AnyView(result.shadow(
                color: shadowColor(shadow), radius: CGFloat(shadow.radius ?? 0),
                x: CGFloat(shadow.x ?? 0), y: CGFloat(shadow.y ?? 0)
            ))
        }
        return result
    }

    private var fixedWidth: CGFloat? { points(tree.style?.width) }
    private var fixedHeight: CGFloat? { points(tree.style?.height) }
    private var expandsWidth: Bool { tree.style?.width == .fill }
    private var expandsHeight: Bool { tree.style?.height == .fill }
    private var growsInParentWidth: Bool { parentAxis == .horizontal && (tree.style?.flexGrow ?? 0) > 0 }
    private var growsInParentHeight: Bool { parentAxis == .vertical && (tree.style?.flexGrow ?? 0) > 0 }
    private var fitsWidth: Bool { tree.style?.width == .fit || tree.style?.flexShrink == 0 }
    private var fitsHeight: Bool { tree.style?.height == .fit || tree.style?.flexShrink == 0 }
    private var layoutPriority: Double {
        tree.style?.flexGrow ?? fraction(tree.style?.flexBasis) ?? fraction(tree.style?.width) ?? fraction(tree.style?.height) ?? 0
    }
    private var widthPercent: Double? { percent(tree.style?.width) }
    private var heightPercent: Double? { percent(tree.style?.height) }
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

    private var selfAlignment: Alignment {
        switch tree.style?.alignSelf {
        case .trailing: return .trailing
        case .center: return .center
        case .top: return .top
        case .bottom: return .bottom
        default: return frameAlignment
        }
    }

    private func childAlignment(_ child: WidgetTree) -> Alignment {
        switch child.style?.alignSelf {
        case .trailing: return .trailing
        case .center: return .center
        case .top: return .top
        case .bottom: return .bottom
        case .fill, .leading, .spaceBetween, nil: return .leading
        }
    }

    private var foregroundColor: Color? {
        if let color = nativeColor(activeAppearance?.color) { return color }
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
        if let color = nativeColor(activeAppearance?.backgroundColor) { return color }
        if let color = nativeColor(tree.style?.backgroundColor) { return color }
        for token in tree.style?.tokens ?? [] {
            if token == .surface { return Color.black.opacity(0.12) }
            if token == .surfaceElevated { return Color.black.opacity(0.2) }
        }
        return nil
    }

    private var cornerShape: WidgetCornerShape {
        WidgetCornerShape(tree.style?.radius, fallback: 0)
    }

    private var backgroundShape: some View {
        cornerShape.fill(backgroundColor ?? .clear)
    }

    private var borderShape: some View {
        let border = tree.style?.border
        let shape = border?.radius.map { WidgetCornerShape(.uniform($0), fallback: 0) } ?? cornerShape
        return shape
            .stroke(nativeColor(activeAppearance?.borderColor ?? border?.color) ?? .clear, lineWidth: CGFloat(border?.width ?? 0))
    }

    private var effectiveShadows: [WidgetShadow] {
        if let shadow = activeAppearance?.shadow { return [shadow] }
        return (tree.style?.shadow.map { [$0] } ?? []) + (tree.style?.shadows ?? [])
    }

    private var localInteractionPhase: WidgetInteractionPhase {
        WidgetInteractionPhase(
            hovered: isHovered,
            pressed: isPressed,
            focused: isFocused,
            disabled: isDisabled
        )
    }

    private var interactionPhase: WidgetInteractionPhase {
        inheritedInteractionPhase.merging(localInteractionPhase)
    }

    private var activeAppearance: WidgetInteractionAppearance? {
        guard let interaction = tree.style?.interaction else { return nil }
        if interactionPhase.disabled, let appearance = interaction.disabled { return appearance }
        if interactionPhase.pressed, let appearance = interaction.pressed { return appearance }
        if interactionPhase.focused, let appearance = interaction.focus { return appearance }
        if interactionPhase.hovered, let appearance = interaction.hover { return appearance }
        return nil
    }

    private var isInteractiveControl: Bool {
        [.button, .slider, .textField, .toggle].contains(tree.kind)
    }

    private var isDisabled: Bool {
        tree.disabled == true || (tree.kind == .button && tree.action == nil)
    }

    private func interactiveSurface(_ content: AnyView) -> AnyView {
        guard isInteractiveControl else { return content }
        var result = AnyView(content
            .contentShape(Rectangle())
            .onHover { hovering in
                isHovered = hovering
                interactionCoordinator.setHovered(hovering, controlID: interactionID)
            }
            .onDisappear {
                interactionCoordinator.setHovered(false, controlID: interactionID)
            }
            .modifier(WidgetCursorModifier(
                cursor: isDisabled ? .notAllowed : tree.style?.interaction?.cursor,
                enabled: true
            ))
            .environment(\.widgetInteractionPhase, interactionPhase)
            .opacity(isDisabled && tree.style?.interaction?.disabled == nil ? 0.45 : 1)
            .allowsHitTesting(!isDisabled)
        )
        if tree.kind == .button {
            result = AnyView(result
                .onTapGesture {
                    guard !isDisabled, let action = tree.action else { return }
                    onAction?(action)
                }
                .accessibilityAddTraits(.isButton)
            )
        }
        if tree.kind != .textField {
            result = AnyView(result
                .focusable(!isDisabled)
                .focused($isFocused)
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .updating($isPressed) { _, pressed, _ in pressed = true }
                )
            )
            if #available(macOS 14.0, *) {
                result = AnyView(result.focusEffectDisabled())
            }
        }
        return result
    }

    private func shadowColor(_ shadow: WidgetShadow) -> Color {
        (nativeColor(shadow.color) ?? .black).opacity(shadow.opacity ?? 0.25)
    }

    private func insetShadow(_ shadow: WidgetShadow) -> some View {
        cornerShape
            .stroke(shadowColor(shadow), lineWidth: max(CGFloat(shadow.radius ?? 0) * 2, 1))
            .blur(radius: CGFloat(shadow.radius ?? 0))
            .offset(x: CGFloat(shadow.x ?? 0), y: CGFloat(shadow.y ?? 0))
            .clipShape(cornerShape)
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

    private func constrainedPoints(_ length: WidgetLength?) -> CGFloat? { points(length) }

    private func constrainedMax(_ length: WidgetLength?, expands: Bool) -> CGFloat? {
        if let value = points(length) { return value }
        if length == .fill || expands { return .infinity }
        return nil
    }

    private func fraction(_ length: WidgetLength?) -> Double? {
        guard case .fraction(let value) = length else { return nil }
        return value
    }

    private func percent(_ length: WidgetLength?) -> Double? {
        guard case .percent(let value) = length else { return nil }
        return value
    }

    private func edgeInsets(_ spacing: WidgetSpacing?) -> EdgeInsets {
        switch spacing {
        case .points(let value):
            return EdgeInsets(top: value, leading: value, bottom: value, trailing: value)
        case .insets(let insets):
            return EdgeInsets(
                top: insets.top ?? insets.vertical ?? 0,
                leading: insets.left ?? insets.horizontal ?? 0,
                bottom: insets.bottom ?? insets.vertical ?? 0,
                trailing: insets.right ?? insets.horizontal ?? 0
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

    private var textAlignment: TextAlignment {
        switch tree.style?.font?.alignment {
        case "center": return .center
        case "trailing": return .trailing
        default: return .leading // SwiftUI has no deterministic justified Text alignment.
        }
    }

    private var truncationMode: Text.TruncationMode {
        switch tree.style?.font?.truncation {
        case "head": return .head
        case "middle": return .middle
        default: return .tail
        }
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

private struct WidgetCornerShape: Shape {
    let topLeft: CGFloat
    let topRight: CGFloat
    let bottomRight: CGFloat
    let bottomLeft: CGFloat

    init(_ radius: WidgetRadius?, fallback: Double) {
        switch radius {
        case .uniform(let value):
            topLeft = value; topRight = value; bottomRight = value; bottomLeft = value
        case .corners(let values):
            topLeft = values.topLeft ?? fallback
            topRight = values.topRight ?? fallback
            bottomRight = values.bottomRight ?? fallback
            bottomLeft = values.bottomLeft ?? fallback
        case nil:
            topLeft = fallback; topRight = fallback; bottomRight = fallback; bottomLeft = fallback
        }
    }

    func path(in rect: CGRect) -> Path {
        let limit = min(rect.width, rect.height) / 2
        let tl = min(max(topLeft, 0), limit), tr = min(max(topRight, 0), limit)
        let br = min(max(bottomRight, 0), limit), bl = min(max(bottomLeft, 0), limit)
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + tl, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - tr, y: rect.minY))
        path.addArc(center: CGPoint(x: rect.maxX - tr, y: rect.minY + tr), radius: tr, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - br))
        path.addArc(center: CGPoint(x: rect.maxX - br, y: rect.maxY - br), radius: br, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
        path.addLine(to: CGPoint(x: rect.minX + bl, y: rect.maxY))
        path.addArc(center: CGPoint(x: rect.minX + bl, y: rect.maxY - bl), radius: bl, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + tl))
        path.addArc(center: CGPoint(x: rect.minX + tl, y: rect.minY + tl), radius: tl, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        path.closeSubpath()
        return path
    }
}

@available(macOS 13.0, *)
private struct WidgetRelativeFrameLayout: Layout {
    let widthPercent: Double?
    let heightPercent: Double?

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let child = subviews.first else { return .zero }
        let intrinsic = child.sizeThatFits(proposal)
        let width = proposal.width.flatMap { proposed in widthPercent.map { proposed * $0 / 100 } } ?? intrinsic.width
        let height = proposal.height.flatMap { proposed in heightPercent.map { proposed * $0 / 100 } } ?? intrinsic.height
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: CGPoint(x: bounds.midX, y: bounds.midY), anchor: .center, proposal: ProposedViewSize(bounds.size))
    }
}

@available(macOS 13.0, *)
private struct WidgetFlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = rows(for: proposal.width ?? .infinity, subviews: subviews)
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(rows.count - 1, 0)))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(for: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for item in row.items {
                item.view.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(item.size))
                x += item.size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private func rows(for width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [], current = Row()
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if !current.items.isEmpty && current.width + spacing + size.width > width {
                rows.append(current); current = Row()
            }
            current.append(view: view, size: size, spacing: spacing)
        }
        if !current.items.isEmpty { rows.append(current) }
        return rows
    }

    private struct Item { let view: LayoutSubview; let size: CGSize }
    private struct Row {
        var items: [Item] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
        mutating func append(view: LayoutSubview, size: CGSize, spacing: CGFloat) {
            if !items.isEmpty { width += spacing }
            items.append(Item(view: view, size: size)); width += size.width; height = max(height, size.height)
        }
    }
}

private struct EditableTextField: View {
    let initialText: String
    let style: WidgetStyle?
    let disabled: Bool
    let onChange: ((String) -> Void)?
    @State private var value: String

    init(initialText: String, style: WidgetStyle?, disabled: Bool, onChange: ((String) -> Void)? = nil) {
        self.initialText = initialText
        self.style = style
        self.disabled = disabled
        self.onChange = onChange
        _value = State(initialValue: initialText)
    }

    var body: some View {
        TextField("", text: $value)
            .textFieldStyle(.plain)
            .padding(8)
            .background(Color.white.opacity(0.06), in: WidgetCornerShape(style?.radius, fallback: 8))
            .foregroundColor(.primary)
            .disabled(disabled)
            .onChange(of: value) { newValue in
                onChange?(newValue)
            }
    }
}

private struct EditableToggle: View {
    let onChange: ((Bool) -> Void)?
    let color: Color
    let disabled: Bool
    @State private var value: Bool

    init(initialValue: Bool, color: Color, disabled: Bool, onChange: ((Bool) -> Void)? = nil) {
        self.onChange = onChange
        self.color = color
        self.disabled = disabled
        _value = State(initialValue: initialValue)
    }

    var body: some View {
        Button {
            guard !disabled else { return }
            value.toggle()
        } label: {
            ZStack(alignment: value ? .trailing : .leading) {
                Capsule().fill(value ? color : Color.white.opacity(0.16))
                Circle()
                    .fill(Color.white)
                    .padding(2)
                    .shadow(color: .black.opacity(0.2), radius: 1, y: 1)
            }
            .frame(width: 34, height: 20)
        }
            .buttonStyle(.plain)
            .disabled(disabled)
            .onChange(of: value) { newValue in
                onChange?(newValue)
            }
    }
}

private struct EditableSlider: View {
    let minimum: Double
    let maximum: Double
    let step: Double?
    let color: Color
    let disabled: Bool
    let onChange: ((Double) -> Void)?
    @State private var value: Double

    init(
        initialValue: Double,
        minimum: Double,
        maximum: Double,
        step: Double?,
        color: Color,
        disabled: Bool,
        onChange: ((Double) -> Void)? = nil
    ) {
        self.minimum = minimum
        self.maximum = maximum
        self.step = step
        self.color = color
        self.disabled = disabled
        self.onChange = onChange
        _value = State(initialValue: min(max(initialValue, minimum), maximum))
    }

    var body: some View {
        GeometryReader { proxy in
            let ratio = maximum > minimum ? (value - minimum) / (maximum - minimum) : 0
            let thumbSize = min(max(proxy.size.height, 12), 18)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.14))
                Capsule().fill(color).frame(width: max(thumbSize / 2, proxy.size.width * CGFloat(ratio)))
                Circle()
                    .fill(Color.white)
                    .frame(width: thumbSize, height: thumbSize)
                    .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                    .offset(x: max(0, (proxy.size.width - thumbSize) * CGFloat(ratio)))
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { gesture in
                guard !disabled, proxy.size.width > 0 else { return }
                let normalized = min(max(gesture.location.x / proxy.size.width, 0), 1)
                let rawValue = minimum + Double(normalized) * (maximum - minimum)
                let nextValue = step.map { increment in
                    minimum + ((rawValue - minimum) / increment).rounded() * increment
                } ?? rawValue
                value = min(max(nextValue, minimum), maximum)
            })
        }
        .frame(minHeight: 14)
        .onChange(of: value) { onChange?($0) }
        .accessibilityValue("\(value)")
    }
}
