import Foundation
import Combine

struct WidgetPreferences: Codable {
    var width: Double?
    var height: Double?
    var mode: String
    var locked: Bool
    var theme: String?

    static let defaults = WidgetPreferences(width: nil, height: nil, mode: "auto", locked: false, theme: nil)

    init(width: Double?, height: Double?, mode: String, locked: Bool, theme: String?) {
        self.width = width
        self.height = height
        self.mode = mode
        self.locked = locked
        self.theme = theme
    }

    private enum CodingKeys: String, CodingKey { case width, height, mode, locked, theme }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        width = try container.decodeIfPresent(Double.self, forKey: .width)
        height = try container.decodeIfPresent(Double.self, forKey: .height)
        mode = try container.decodeIfPresent(String.self, forKey: .mode) ?? "auto"
        locked = try container.decodeIfPresent(Bool.self, forKey: .locked) ?? false
        theme = try container.decodeIfPresent(String.self, forKey: .theme)
    }
}

final class WidgetPreferencesModel: ObservableObject {
    @Published var value: WidgetPreferences

    init(_ value: WidgetPreferences) {
        self.value = value
    }
}
