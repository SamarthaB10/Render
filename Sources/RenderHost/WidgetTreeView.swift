import SwiftUI
import RenderHostCore

struct WidgetTreeView: View {
    let tree: WidgetTree

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
                    WidgetTreeView(tree: tree.children[index])
                }
            })
        case .row:
            return AnyView(HStack(alignment: .center, spacing: 8) {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index])
                }
            })
        case .stack:
            return AnyView(ZStack {
                ForEach(tree.children.indices, id: \.self) { index in
                    WidgetTreeView(tree: tree.children[index])
                }
            })
        case .text:
            return AnyView(Text(tree.text ?? ""))
        case .shape:
            return AnyView(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.blue.opacity(0.92))
            )
        case .gauge:
            return AnyView(SwiftUI.Gauge(value: tree.value ?? 0, in: 0...(tree.maximum ?? 1)) {
                Text("")
            })
        }
    }
}
