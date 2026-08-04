import AppKit
import Foundation

struct WidgetAssetResolver {
    let workspace: URL?
    let declaredAssets: Set<String>?

    func image(named name: String) -> NSImage? {
        guard !name.isEmpty else { return unavailable(name, reason: "asset name is empty") }
        guard let workspace else {
            return NSImage(named: name)
        }
        let normalizedName = name.replacingOccurrences(of: "\\", with: "/")
        if let declaredAssets, !declaredAssets.contains(normalizedName) { return unavailable(name, reason: "asset is not declared in manifest.assets") }
        guard let assetURL = safeAssetURL(name: normalizedName, workspace: workspace) else { return unavailable(name, reason: "asset is missing, not a file, or escapes the workspace assets directory") }
        guard let image = NSImage(contentsOf: assetURL) else { return unavailable(name, reason: "AppKit could not decode the image file") }
        return image
    }

    private func unavailable(_ name: String, reason: String) -> NSImage? {
        NSLog("Render image unavailable: asset=%@; reason=%@; repair=declare a readable local image under assets/", name, reason)
        return nil
    }

    private func safeAssetURL(name: String, workspace: URL) -> URL? {
        let normalizedName = name.replacingOccurrences(of: "\\", with: "/")
        guard !normalizedName.hasPrefix("/"), !normalizedName.split(separator: "/").contains("..") else { return nil }

        let workspaceRoot = workspace.resolvingSymlinksInPath().standardizedFileURL
        let assetRoot = workspaceRoot.appendingPathComponent("assets", isDirectory: true)
        let candidate = assetRoot.appendingPathComponent(normalizedName, isDirectory: false)
        guard FileManager.default.fileExists(atPath: candidate.path) else { return nil }

        let resolvedRoot = assetRoot.resolvingSymlinksInPath().standardizedFileURL
        let resolvedCandidate = candidate.resolvingSymlinksInPath().standardizedFileURL
        guard isInside(resolvedCandidate, root: resolvedRoot),
              FileManager.default.fileExists(atPath: resolvedCandidate.path)
        else { return nil }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: resolvedCandidate.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
            return nil
        }
        return resolvedCandidate
    }

    private func isInside(_ candidate: URL, root: URL) -> Bool {
        let rootPath = root.path.hasSuffix("/") ? root.path : root.path + "/"
        return candidate.path.hasPrefix(rootPath)
    }
}
