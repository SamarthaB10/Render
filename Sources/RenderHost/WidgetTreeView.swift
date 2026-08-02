import SwiftUI
import RenderHostCore

struct WidgetTreeView: View {
    let tree: WidgetTree
    @ObservedObject var providers: ProviderStore

    var body: some View {
        content
            .frame(width: width, height: height)
    }

    private var width: CGFloat? {
        guard let width = tree.style?.width else { return nil }
        return CGFloat(width)
    }

    private var height: CGFloat? {
        guard let height = tree.style?.height else { return nil }
        return CGFloat(height)
    }

    private var content: AnyView {
        switch tree.kind {
        case .column:
            return AnyView(VStack(alignment: .leading, spacing: 8) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers)
                }
            })
        case .row:
            return AnyView(HStack(alignment: .center, spacing: 8) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers)
                }
            })
        case .stack:
            return AnyView(ZStack {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index], providers: providers)
                }
            })
        case .text:
            return AnyView(Text(displayedText))
        case .shape:
            return AnyView(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.blue.opacity(0.92))
            )
        case .gauge:
            if let provider = providerValue, provider.state == .unavailable {
                return AnyView(Text("Unavailable"))
            }
            return AnyView(SwiftUI.Gauge(value: providerValue?.value ?? tree.value ?? 0, in: 0...(tree.maximum ?? 1)) {
                Text("")
            })
        }
    }

    private var providerValue: ProviderValue? {
        guard let provider = tree.provider else { return nil }
        return providers.value(for: provider)
    }

    private var displayedText: String {
        guard let provider = providerValue else { return tree.text ?? "" }
        guard provider.state == .available, let value = provider.value else { return "Unavailable" }
        return "\(Int(value.rounded()))%"
    }
}
