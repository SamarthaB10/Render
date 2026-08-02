import Combine
import RenderHostCore

final class WidgetContentModel: ObservableObject {
    @Published var tree: WidgetTree

    init(tree: WidgetTree) {
        self.tree = tree
    }
}
