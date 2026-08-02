import SwiftUI
import RenderHostCore

struct WidgetTreeView: View {
    let tree: WidgetTree

    var body: some View {
        content
            .frame(
                width: tree.style?.width.map(CGFloat.init),
                height: tree.style?.height.map(CGFloat.init)
            )
    }

    @ViewBuilder
    private var content: some View {
        switch tree.kind {
        case .column:
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(tree.children.enumerated()), id: \.offset) { _, child in
                    WidgetTreeView(tree: child)
                }
            }
        case .row:
            HStack(alignment: .center, spacing: 8) {
                ForEach(Array(tree.children.enumerated()), id: \.offset) { _, child in
                    WidgetTreeView(tree: child)
                }
            }
        case .stack:
            ZStack {
                ForEach(Array(tree.children.enumerated()), id: \.offset) { _, child in
                    WidgetTreeView(tree: child)
                }
            }
        case .text:
            Text(tree.text ?? "")
        case .shape:
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.blue.opacity(0.92))
        case .gauge:
            SwiftUI.Gauge(value: tree.value ?? 0, in: 0...(tree.maximum ?? 1)) {
                Text("")
            }
        }
    }
}
