import AppKit
import SwiftUI
import RenderHostCore

struct WidgetTreeView: View {
    let tree: WidgetTree
    @ObservedObject var providers: ProviderStore
    var onAction: ((WidgetAction) -> Void)? = nil

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    var body: some View {
        content
            .frame(width: fixedWidth, height: fixedHeight, alignment: frameAlignment)
            .frame(maxWidth: expandsWidth ? .infinity : nil, maxHeight: expandsHeight ? .infinity : nil, alignment: frameAlignment)
            .padding(edgeInsets(tree.style?.padding))
            .padding(edgeInsets(tree.style?.margin))
            .opacity(tree.style?.opacity ?? 1)
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
    }

    private var content: AnyView {
        switch tree.kind {
        case .column:
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, onAction: onAction)
                    if tree.style?.justifyContent == .spaceBetween && index < tree.children.count - 1 {
                        Spacer(minLength: 0)
                    }
                }
            })
        case .row:
            return AnyView(HStack(alignment: verticalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, onAction: onAction)
                    if tree.style?.justifyContent == .spaceBetween && index < tree.children.count - 1 {
                        Spacer(minLength: 0)
                    }
                }
            })
        case .stack:
            return AnyView(ZStack(alignment: frameAlignment) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, onAction: onAction)
                }
            })
        case .box:
            return AnyView(VStack(alignment: horizontalAlignment, spacing: gap) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, onAction: onAction)
                }
            })
        case .grid:
            return AnyView(LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: gap), count: max(tree.columns ?? 1, 1)),
                alignment: horizontalAlignment,
                spacing: gap
            ) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers, onAction: onAction)
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
        case .shape:
            return AnyView(RoundedRectangle(cornerRadius: CGFloat(tree.style?.radius ?? 12)).fill(foregroundColor ?? Color.secondary))
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
                        WidgetTreeView(tree: tree.children[index], providers: providers, onAction: onAction)
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
    private var gap: CGFloat { CGFloat(tree.style?.gap ?? ((tree.kind == .column || tree.kind == .row) ? 8 : 0)) }

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
}
