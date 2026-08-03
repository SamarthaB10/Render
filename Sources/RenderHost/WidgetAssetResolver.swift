import AppKit
import Foundation

struct WidgetAssetResolver {
    let workspace: URL?
    let declaredAssets: Set<String>?

    func image(named name: String) -> NSImage? {
        guard !name.isEmpty else { return nil }
        guard let workspace else {
            return NSImage(named: name)
        }
        if let declaredAssets, !declaredAssets.contains(name) { return nil }
        guard let assetURL = safeAssetURL(name: name, workspace: workspace) else { return nil }
        return NSImage(contentsOf: assetURL)
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
