import CoreText
import Foundation

struct WidgetFontDeclaration: Decodable {
    let asset: String
    let family: String?
}

enum WidgetFontRegistrar {
    static func register(_ declarations: [WidgetFontDeclaration], workspace: String?, declaredAssets: Set<String>) {
        guard let workspace else { return }
        let resolver = LocalAssetURLResolver(workspace: URL(fileURLWithPath: workspace), declaredAssets: declaredAssets)
        for declaration in declarations {
            guard let url = resolver.file(named: declaration.asset) else {
                NSLog("Render font unavailable: asset=%@; reason=missing, undeclared, or outside assets/; repair=run render check --json", declaration.asset)
                continue
            }
            var registrationError: Unmanaged<CFError>?
            guard CTFontManagerRegisterFontsForURL(url as CFURL, .process, &registrationError) else {
                let message = registrationError?.takeRetainedValue().localizedDescription ?? "CoreText rejected the font"
                NSLog("Render font registration failed: asset=%@; reason=%@; repair=use a valid local .ttf or .otf font", declaration.asset, message)
                continue
            }
        }
    }
}

private struct LocalAssetURLResolver {
    let workspace: URL
    let declaredAssets: Set<String>

    func file(named name: String) -> URL? {
        let normalized = name.replacingOccurrences(of: "\\", with: "/")
        guard declaredAssets.contains(normalized), !normalized.hasPrefix("/"), !normalized.split(separator: "/").contains("..") else { return nil }
        let root = workspace.resolvingSymlinksInPath().standardizedFileURL.appendingPathComponent("assets", isDirectory: true).resolvingSymlinksInPath().standardizedFileURL
        let candidate = root.appendingPathComponent(normalized).resolvingSymlinksInPath().standardizedFileURL
        let prefix = root.path.hasSuffix("/") ? root.path : root.path + "/"
        guard candidate.path.hasPrefix(prefix) else { return nil }
        var directory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: candidate.path, isDirectory: &directory), !directory.boolValue else { return nil }
        return candidate
    }
}
