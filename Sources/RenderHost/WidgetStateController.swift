import Foundation
import RenderHostCore

final class WidgetStateController {
    let url: URL
    private var values: [String: WidgetJSONValue]
    private let queue = DispatchQueue(label: "com.render.widget-state", qos: .utility)

    init(workspace: String) {
        self.url = URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/state.json")
        let loaded = WidgetStatePersistence.load(from: url)
        self.values = loaded.values
        if let issue = loaded.issue {
            NSLog(
                "Render widget state ignored (path=%@): %@. Defaults will be used until a new value is saved.",
                url.path,
                issue
            )
        }
    }

    func set(_ key: String, value: WidgetJSONValue) {
        guard !key.isEmpty else { return }
        queue.async { [weak self] in
            guard let self else { return }
            self.values[key] = value
            do {
                try WidgetStatePersistence.save(self.values, to: self.url)
            } catch {
                NSLog(
                    "Render widget state save failed (path=%@, key=%@): %@. The value remains in memory and will be retried on the next edit.",
                    self.url.path,
                    key,
                    error.localizedDescription
                )
            }
        }
    }
}
