import Foundation
import Combine

struct WidgetPreferences: Codable {
    var width: Double?
    var height: Double?
    var mode: String
    var locked: Bool

    static let defaults = WidgetPreferences(width: nil, height: nil, mode: "auto", locked: false)
}

final class WidgetPreferencesModel: ObservableObject {
    @Published var value: WidgetPreferences

    init(_ value: WidgetPreferences) {
        self.value = value
    }
}
