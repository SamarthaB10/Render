import CoreText
import Foundation

enum LucideIconCatalog {
    static let fontName = "lucide"

    private struct Resource: Decodable {
        let version: String
        let icons: [String: UInt32]
    }

    private static let aliases = [
        "backward.end.fill": "skip-back", "forward.end.fill": "skip-forward",
        "pause.fill": "pause", "play.fill": "play"
    ]

    private static let resource: Resource = {
        guard let catalogURL = Bundle.module.url(forResource: "catalog", withExtension: "json", subdirectory: "LucideResources"),
              let data = try? Data(contentsOf: catalogURL),
              let resource = try? JSONDecoder().decode(Resource.self, from: data)
        else {
            NSLog("Render Lucide catalog unavailable: bundled catalog.json could not be decoded")
            return Resource(version: "unavailable", icons: [:])
        }
        registerFont()
        return resource
    }()

    static func codePoint(for name: String) -> UInt32? {
        resource.icons[aliases[name] ?? name]
    }

    static func scalar(for name: String) -> Unicode.Scalar? {
        codePoint(for: name).flatMap(Unicode.Scalar.init)
    }

    private static func registerFont() {
        guard let fontURL = Bundle.module.url(forResource: "lucide", withExtension: "ttf", subdirectory: "LucideResources") else {
            NSLog("Render Lucide font unavailable: bundled lucide.ttf is missing")
            return
        }
        var error: Unmanaged<CFError>?
        if !CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &error),
           let error = error?.takeRetainedValue(),
           CFErrorGetCode(error) != CTFontManagerError.alreadyRegistered.rawValue {
            NSLog("Render Lucide font registration failed: %@", error.localizedDescription)
        }
    }
}
