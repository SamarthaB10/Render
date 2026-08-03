import Foundation
import RenderHostCore

/// The native action boundary. Widget trees carry descriptors; this object is
/// the only place where a descriptor can become a host operation.
final class WidgetActionDispatcher {
    private let capabilities: Set<String>

    init(capabilities: [String]) {
        self.capabilities = Set(capabilities)
    }

    func dispatch(_ action: WidgetAction) {
        switch action {
        case .invoke(let name, let payload):
            guard !name.isEmpty else {
                NSLog("Render action denied: empty invoke name")
                return
            }
            guard isKnownAction(name) else {
                NSLog("Render action denied: unsupported invoke '%@'", name)
                return
            }
            NSLog("Render action accepted: invoke '%@' payload=%@ capabilities=%@", name, String(describing: payload), capabilities.sorted().joined(separator: ","))
        case .set(let name, let value):
            guard !name.isEmpty else {
                NSLog("Render action denied: empty set name")
                return
            }
            guard isKnownAction(name) else {
                NSLog("Render action denied: unsupported set '%@'", name)
                return
            }
            NSLog("Render action accepted: set '%@' value=%@ capabilities=%@", name, String(describing: value), capabilities.sorted().joined(separator: ","))
        }
    }

    private func isKnownAction(_ name: String) -> Bool {
        // Phase 9 intentionally exposes only host lifecycle operations. Media,
        // account, network, and filesystem operations register their provider,
        // capability, permission, and native implementation in later slices.
        name == "widget.refresh" || name == "widget.reload"
    }
}
