import AppKit
import SwiftUI
import RenderHostCore

struct WidgetTreeView: View {
    let tree: WidgetTree
    @ObservedObject var providers: ProviderStore
    @ObservedObject var interactionStore: WidgetInteractionStore
    let theme: RenderTheme
    let nodePath: String
    let fillsAvailableSpace: Bool
    let usesThemeOverrides: Bool
    var onAction: ((WidgetAction) -> Void)? = nil

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    var body: some View {
        Group {
            if fillsAvailableSpace {
                responsiveSurface
            } else {
                surfaceContent
                    .background(backgroundShape)
                    .overlay(borderShape)
                    .shadow(
                        color: resolvedShadowColor,
                        radius: CGFloat(tree.style?.shadow?.radius ?? 0),
                        x: CGFloat(tree.style?.shadow?.x ?? 0),
                        y: CGFloat(tree.style?.shadow?.y ?? 0)
                    )
            }
        }
    }

    private var responsiveSurface: some View {
        GeometryReader { proxy in
            let availableSize = proxy.size
            let designedSize = CGSize(
                width: fixedWidth ?? max(availableSize.width, 1),
                height: fixedHeight ?? max(availableSize.height, 1)
            )
            let scale = WidgetFrameGeometry.fitScale(
                designedSize: designedSize,
                availableSize: availableSize
            )

            ZStack(alignment: .topLeading) {
                backgroundShape
                surfaceContent
                    .scaleEffect(scale, anchor: .topLeading)
                borderShape
            }
            .frame(width: availableSize.width, height: availableSize.height, alignment: .topLeading)
            .overlay {
                if usesThemeOverrides && theme.usesScanlines {
                    RenderScanlineOverlay()
                        .clipShape(RoundedRectangle(cornerRadius: effectiveRadius, style: .continuous))
                        .allowsHitTesting(false)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: effectiveRadius, style: .continuous))
            .shadow(
                color: resolvedShadowColor,
                radius: resolvedShadowRadius,
                x: CGFloat(tree.style?.shadow?.x ?? 0),
                y: CGFloat(tree.style?.shadow?.y ?? 0)
            )
        }
    }

    private var surfaceContent: AnyView {
        let laidOutContent = content
            // A node's declared size includes its padding. Applying padding
            // after the frame made the authored surface larger than the
            // native panel and caused text to be clipped at the edges.
            .padding(edgeInsets(tree.style?.padding))
            .frame(width: fixedWidth, height: fixedHeight, alignment: frameAlignment)
            .frame(
                maxWidth: expandsWidth ? .infinity : nil,
                maxHeight: expandsHeight ? .infinity : nil,
                alignment: frameAlignment
            )
            .padding(edgeInsets(tree.style?.margin))
            .opacity(tree.style?.opacity ?? 1)
            .foregroundColor(foregroundColor)
            .font(nativeFont)
        guard let radius = tree.style?.radius, radius > 0 else { return AnyView(laidOutContent) }
        // Apply the clip after the declared frame and padding. Otherwise a
        // native child can paint beyond its node and overlap the next sibling.
        return AnyView(laidOutContent.clipShape(RoundedRectangle(cornerRadius: CGFloat(radius))))
    }

    private var content: AnyView {
        switch tree.kind {
        case .column:
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, interactionStore: interactionStore, theme: theme, nodePath: childPath(index), fillsAvailableSpace: false, usesThemeOverrides: usesThemeOverrides, onAction: onAction)
                    if tree.style?.justifyContent == .spaceBetween && index < tree.children.count - 1 {
                        Spacer(minLength: 0)
                    }
                }
            })
        case .row:
            return AnyView(HStack(alignment: verticalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, interactionStore: interactionStore, theme: theme, nodePath: childPath(index), fillsAvailableSpace: false, usesThemeOverrides: usesThemeOverrides, onAction: onAction)
                    if tree.style?.justifyContent == .spaceBetween && index < tree.children.count - 1 {
                        Spacer(minLength: 0)
                    }
                }
            })
        case .stack:
            return AnyView(ZStack(alignment: frameAlignment) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, interactionStore: interactionStore, theme: theme, nodePath: childPath(index), fillsAvailableSpace: false, usesThemeOverrides: usesThemeOverrides, onAction: onAction)
                }
            })
        case .box:
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, interactionStore: interactionStore, theme: theme, nodePath: childPath(index), fillsAvailableSpace: false, usesThemeOverrides: usesThemeOverrides, onAction: onAction)
                }
            })
        case .glassPanel, .mediaCard:
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, interactionStore: interactionStore, theme: theme, nodePath: childPath(index), fillsAvailableSpace: false, usesThemeOverrides: usesThemeOverrides, onAction: onAction)
                }
            })
        case .scrollView:
            return AnyView(SwiftUI.ScrollView(.vertical) {
                VStack(alignment: horizontalAlignment, spacing: gap) {
                    ForEach(tree.children.indices, id: \.self) { index in
                        WidgetTreeView(tree: tree.children[index], providers: providers, interactionStore: interactionStore, theme: theme, nodePath: childPath(index), fillsAvailableSpace: false, usesThemeOverrides: usesThemeOverrides, onAction: onAction)
                    }
                }
                .frame(maxWidth: .infinity, alignment: frameAlignment)
            })
        case .grid:
            return AnyView(LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: gap), count: max(tree.columns ?? 1, 1)),
                alignment: horizontalAlignment,
                spacing: gap
            ) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, interactionStore: interactionStore, theme: theme, nodePath: childPath(index), fillsAvailableSpace: false, usesThemeOverrides: usesThemeOverrides, onAction: onAction)
                }
            })
        case .spacer:
            return AnyView(SwiftUI.Spacer(minLength: 0))
        case .divider:
            return AnyView(
                Rectangle()
                    .fill(foregroundColor ?? Color.secondary)
                    .frame(
                    width: tree.orientation == "vertical" ? 1 : nil,
                    height: tree.orientation == "vertical" ? nil : 1
                    )
            )
        case .text:
            return AnyView(Text(displayedText))
        case .textField:
            return AnyView(EditableTextField(initialText: tree.text ?? "", style: tree.style))
        case .textEditor:
            return AnyView(EditableTextEditor(path: nodePath, initialText: tree.text ?? "", placeholder: tree.placeholder, store: interactionStore, style: tree.style))
        case .dateTime:
            return AnyView(WidgetDateTimeView(value: tree.dateTime ?? "", mode: tree.dateTimeMode ?? "dateTime"))
        case .dateTimePicker:
            return AnyView(WidgetDateTimePickerView(path: nodePath, initialValue: tree.dateTime, mode: tree.dateTimeMode ?? "dateTime", store: interactionStore))
        case .toggle:
            return AnyView(EditableToggle(initialValue: (tree.value ?? 0) == 1))
        case .timer:
            return AnyView(WidgetTimerView(path: nodePath, durationSeconds: tree.durationSeconds ?? 1, style: tree.style, store: interactionStore))
        case .taskList:
            return AnyView(WidgetTaskListView(path: nodePath, defaults: tree.tasks ?? [], store: interactionStore))
        case .list:
            return AnyView(WidgetListView(defaults: tree.items ?? [], provider: providerValue))
        case .visualizer:
            return AnyView(WidgetVisualizerView(provider: providerValue, mode: tree.visualizerMode ?? "bars", tempo: tree.visualizerTempo ?? 1, theme: theme))
        case .youtubePlayer:
            return AnyView(YouTubePlayerView(path: nodePath,
                initialVideoID: tree.videoId,
                controls: tree.controls ?? true,
                autoplay: tree.autoplay ?? false,
                startSeconds: tree.startSeconds,
                store: interactionStore
            ))
        case .shape:
            return AnyView(RoundedRectangle(cornerRadius: effectiveRadius).fill(foregroundColor ?? Color.secondary))
        case .icon:
            return AnyView(iconContent)
        case .image:
            return AnyView(imageContent)
        case .button:
            return AnyView(Button(action: {
                guard let action = tree.action else { return }
                onAction?(action)
            }) {
                HStack(spacing: gap) {
                    ForEach(tree.children.indices, id: \.self) { index in
                        WidgetTreeView(tree: tree.children[index], providers: providers, interactionStore: interactionStore, theme: theme, nodePath: childPath(index), fillsAvailableSpace: false, usesThemeOverrides: usesThemeOverrides, onAction: onAction)
                    }
                }
            }.disabled(tree.action == nil))
        case .gauge:
            return AnyView(gaugeContent)
        case .progress:
            return AnyView(progressContent)
        }
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
        guard let name = tree.name, let image = NSImage(systemSymbolName: name, accessibilityDescription: name) else {
            return AnyView(Text("Icon unavailable"))
        }
        return AnyView(Image(nsImage: image).renderingMode(.template).accessibilityLabel(name))
    }

    private var imageContent: AnyView {
        guard let source = tree.source else { return AnyView(Text("Image unavailable")) }
        switch source {
        case .asset(let name):
            guard let image = NSImage(named: name) else { return AnyView(Text("Image unavailable")) }
            return AnyView(Image(nsImage: image).resizable().scaledToFit().accessibilityLabel(name))
        case .url, .provider:
            return AnyView(Text("Image unavailable"))
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
    private var gap: CGFloat {
        if let gap = tree.style?.gap { return CGFloat(gap) }
        switch tree.style?.density {
        case .compact: return (tree.kind == .column || tree.kind == .row) ? 6 : 0
        case .comfortable: return (tree.kind == .column || tree.kind == .row) ? 10 : 0
        default: return (tree.kind == .column || tree.kind == .row) ? 8 : 0
        }
    }

    private func childPath(_ index: Int) -> String {
        let child = tree.children[index]
        guard let key = child.key else { return "\(nodePath).children[\(index)]" }
        switch key {
        case .string(let value): return "\(nodePath).key.string:\(value)"
        case .number(let value): return "\(nodePath).key.number:\(value)"
        }
    }

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
        for token in tree.style?.tokens ?? [] {
            guard isForegroundToken(token), let color = theme.color(for: token) else { continue }
            return color
        }
        if !usesThemeOverrides, let color = nativeColor(tree.style?.color) { return color }
        return theme.primaryText
    }

    private var backgroundShape: AnyView {
        let shape = RoundedRectangle(cornerRadius: effectiveRadius)
        if !usesThemeOverrides, let color = nativeColor(tree.style?.backgroundColor) {
            return AnyView(shape.fill(color))
        }
        if let roleColor = theme.surfaceColor(role: tree.style?.role, material: tree.style?.material) {
            return AnyView(shape.fill(roleColor))
        }
        for token in tree.style?.tokens ?? [] {
            guard isSurfaceToken(token), let color = theme.color(for: token) else { continue }
            return AnyView(shape.fill(color))
        }
        if fillsAvailableSpace {
            return AnyView(shape.fill(theme.surface))
        }
        return AnyView(shape.fill(.clear))
    }

    private func isForegroundToken(_ token: WidgetStyleToken) -> Bool {
        switch token {
        case .textPrimary, .textSecondary, .textTertiary, .accent, .accentMuted, .danger, .success, .mono:
            return true
        case .surface, .surfaceElevated, .surfacePanel, .surfaceControl, .surfaceStatus, .borderSubtle:
            return false
        }
    }

    private func isSurfaceToken(_ token: WidgetStyleToken) -> Bool {
        switch token {
        case .surface, .surfaceElevated, .surfacePanel, .surfaceControl, .surfaceStatus:
            return true
        case .textPrimary, .textSecondary, .textTertiary, .borderSubtle, .accent, .accentMuted, .danger, .success, .mono:
            return false
        }
    }

    private var borderShape: some View {
        let border = tree.style?.border
        let isRootSurface = fillsAvailableSpace
        let width = border?.width ?? (usesThemeOverrides && isRootSurface ? Double(theme.defaultBorderWidth) : 0)
        let color = usesThemeOverrides && isRootSurface
            ? theme.border
            : nativeColor(border?.color) ?? (border?.width == nil ? .clear : theme.border)
        return RoundedRectangle(cornerRadius: border?.radius.map { CGFloat($0) } ?? effectiveRadius)
            .stroke(color, lineWidth: CGFloat(width))
    }

    private var resolvedShadowColor: Color {
        if usesThemeOverrides && fillsAvailableSpace {
            return theme.shadowColor
        }
        return nativeColor(tree.style?.shadow?.color)?.opacity(tree.style?.shadow?.opacity ?? 0.25) ?? .clear
    }

    private var resolvedShadowRadius: CGFloat {
        if usesThemeOverrides && fillsAvailableSpace {
            return theme.shadowRadius
        }
        return CGFloat(tree.style?.shadow?.radius ?? 0)
    }

    private var effectiveRadius: CGFloat {
        if usesThemeOverrides {
            return theme.surfaceRadius
        }
        return CGFloat(tree.style?.radius ?? 0)
    }

    private var nativeFont: Font? {
        let font = tree.style?.font
        guard let size = font?.size ?? (usesThemeOverrides ? Double(theme.baseFontSize) : nil) else { return nil }
        if font?.monospace == true || (usesThemeOverrides && theme.usesMonospaceTypography) {
            return .system(size: CGFloat(size), weight: fontWeight(font?.weight), design: .monospaced)
        }
        if let family = font?.family, !usesThemeOverrides {
            return .custom(family, size: CGFloat(size)).weight(fontWeight(font?.weight))
        }
        return .system(size: CGFloat(size), weight: fontWeight(font?.weight))
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
}

private struct RenderScanlineOverlay: View {
    var body: some View {
        Canvas { context, size in
            var path = Path()
            var y: CGFloat = 2
            while y < size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += 4
            }
            context.stroke(path, with: .color(.white.opacity(0.06)), lineWidth: 1)
        }
        .allowsHitTesting(false)
    }
}

private struct WidgetListView: View {
    let defaults: [WidgetListItem]
    let provider: ProviderValue?

    var body: some View {
        Group {
            if let provider {
                switch provider.state {
                case .loading:
                    Text("Loading…")
                case .unavailable:
                    Text("Unavailable")
                case .available:
                    rows(providerItems)
                }
            } else {
                rows(defaults)
            }
        }
    }

    private func rows(_ items: [WidgetListItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if items.isEmpty {
                Text("No items")
                    .foregroundColor(.secondary)
            } else {
                ForEach(items) { item in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: item.completed ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(item.completed ? .accentColor : .secondary)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                                .strikethrough(item.completed)
                            if let subtitle = item.subtitle, !subtitle.isEmpty {
                                Text(subtitle)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(item.completed ? "Completed: \(item.title)" : item.title)
                }
            }
        }
    }

    private var providerItems: [WidgetListItem] {
        guard let provider, case .array(let values) = provider.jsonValue else { return [] }
        return values.compactMap { value in
            guard case .object(let object) = value,
                  case .string(let id) = object["id"],
                  case .string(let title) = object["title"]
            else { return nil }
            let subtitle: String?
            if case .string(let value) = object["subtitle"] { subtitle = value } else { subtitle = nil }
            let completed: Bool
            if case .boolean(let value) = object["completed"] { completed = value } else { completed = false }
            return WidgetListItem(id: id, title: title, subtitle: subtitle, completed: completed)
        }
    }
}

private struct WidgetVisualizerView: View {
    let provider: ProviderValue?
    let mode: String
    let tempo: Double
    let theme: RenderTheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if let provider, provider.state != .available {
                Text(provider.state == .loading ? "Loading visualizer…" : "Visualizer unavailable")
                    .font(.caption)
                    .foregroundColor(theme.secondaryText)
                    .accessibilityLabel(provider.message ?? "Visualizer unavailable")
            } else {
                TimelineView(.periodic(from: .now, by: 0.08)) { context in
                    visualizer(at: isPlaying && !reduceMotion ? context.date.timeIntervalSinceReferenceDate : 0)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Audio visualizer")
            }
        }
        .frame(minHeight: 48)
    }

    @ViewBuilder
    private func visualizer(at time: TimeInterval) -> some View {
        switch mode {
        case "rings":
            ZStack {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .stroke(theme.accent.opacity(0.36 - Double(index) * 0.08), lineWidth: 2)
                        .scaleEffect(0.45 + CGFloat(index) * 0.22 + CGFloat(pulse(at: time, index: index)) * 0.06)
                }
            }
        case "waveform":
            HStack(alignment: .center, spacing: 3) {
                ForEach(0..<20, id: \.self) { index in
                    Capsule()
                        .fill(theme.accent.opacity(0.50 + Double(index % 3) * 0.15))
                        .frame(width: 3, height: CGFloat(10 + pulse(at: time, index: index) * 28))
                }
            }
        default:
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(0..<16, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(theme.accent.opacity(0.52 + Double(index % 4) * 0.10))
                        .frame(width: 5, height: CGFloat(8 + pulse(at: time, index: index) * 36))
                }
            }
        }
    }

    private func pulse(at time: TimeInterval, index: Int) -> Double {
        let phase = time * max(tempo, 0.01) * 2.4 + Double(index) * 0.62
        return (sin(phase) + 1) / 2
    }

    private var isPlaying: Bool {
        guard let text = provider?.text else { return true }
        return text.caseInsensitiveCompare("playing") == .orderedSame
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

private struct EditableTextEditor: View {
    let path: String
    let initialText: String
    let placeholder: String?
    @ObservedObject var store: WidgetInteractionStore
    let style: WidgetStyle?
    @State private var value: String

    init(path: String, initialText: String, placeholder: String?, store: WidgetInteractionStore, style: WidgetStyle?) {
        self.path = path
        self.initialText = initialText
        self.placeholder = placeholder
        self.store = store
        self.style = style
        _value = State(initialValue: store.textEditorValue(path: path, defaultText: initialText))
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $value)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: CGFloat(style?.radius ?? 8)))
                .foregroundColor(.primary)
                .onChange(of: value) { nextValue in
                    store.saveTextEditor(path: path, text: nextValue)
                }
            if value.isEmpty, let placeholder, !placeholder.isEmpty {
                Text(placeholder)
                    .foregroundColor(.secondary)
                    .padding(.leading, 13)
                    .padding(.top, 16)
                    .allowsHitTesting(false)
            }
        }
        .onDisappear { store.saveTextEditor(path: path, text: value) }
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
