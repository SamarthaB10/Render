import Combine
import Foundation
import RenderHostCore

private struct StoredTimer: Codable {
    var durationSeconds: Int
    var remainingSeconds: Int
    var running: Bool
    var updatedAt: Date?
    var endsAt: Date?
}

private struct StoredTaskList: Codable {
    var items: [WidgetTaskItem]
}

private struct StoredTextEditor: Codable {
    var text: String
}

private struct StoredInteractionState: Codable {
    var timers: [String: StoredTimer] = [:]
    var taskLists: [String: StoredTaskList] = [:]
    var textEditors: [String: StoredTextEditor]? = nil
}

final class WidgetInteractionStore: ObservableObject {
    private var state: StoredInteractionState
    private let fileURL: URL?

    init(workspace: String?) {
        fileURL = workspace.map {
            URL(fileURLWithPath: $0).appendingPathComponent(".render/runtime/interaction-state.json")
        }
        if let fileURL,
           let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode(StoredInteractionState.self, from: data) {
            state = decoded
        } else {
            state = StoredInteractionState()
        }
    }

    func timerState(path: String, defaultDurationSeconds: Int, now: Date = Date()) -> (durationSeconds: Int, remaining: Int, running: Bool, endsAt: Date?) {
        guard let stored = state.timers[path] else {
            return (defaultDurationSeconds, defaultDurationSeconds, false, nil)
        }
        let durationSeconds = stored.durationSeconds > 0 ? stored.durationSeconds : defaultDurationSeconds
        var remaining = stored.remainingSeconds
        if stored.running, let endsAt = stored.endsAt {
            remaining = max(0, Int(ceil(endsAt.timeIntervalSince(now))))
        } else if stored.running, let updatedAt = stored.updatedAt {
            // Recover timers written by an older runtime before end-time persistence.
            remaining = max(0, remaining - Int(now.timeIntervalSince(updatedAt)))
        }
        let running = stored.running && remaining > 0
        if remaining != stored.remainingSeconds || running != stored.running {
            state.timers[path] = StoredTimer(
                durationSeconds: durationSeconds,
                remainingSeconds: remaining,
                running: running,
                updatedAt: running ? now : nil,
                endsAt: running ? stored.endsAt : nil
            )
            persist()
        }
        return (durationSeconds, remaining, running, running ? stored.endsAt : nil)
    }

    func saveTimer(path: String, durationSeconds: Int, remaining: Int, running: Bool, endsAt: Date? = nil, now: Date = Date()) {
        state.timers[path] = StoredTimer(
            durationSeconds: durationSeconds,
            remainingSeconds: max(0, min(remaining, durationSeconds)),
            running: running && remaining > 0,
            updatedAt: running && remaining > 0 ? now : nil,
            endsAt: running && remaining > 0 ? endsAt : nil
        )
        persist()
    }

    func taskItems(path: String, defaults: [WidgetTaskItem]) -> [WidgetTaskItem] {
        guard let stored = state.taskLists[path]?.items else {
            return defaults
        }
        let existingIDs = Set(stored.map(\.id))
        let newDefaults = defaults.filter { !existingIDs.contains($0.id) }
        return stored + newDefaults
    }

    func saveTaskItems(path: String, items: [WidgetTaskItem]) {
        state.taskLists[path] = StoredTaskList(items: items)
        persist()
    }

    func textEditorValue(path: String, defaultText: String) -> String {
        state.textEditors?[path]?.text ?? defaultText
    }

    func saveTextEditor(path: String, text: String) {
        var editors = state.textEditors ?? [:]
        editors[path] = StoredTextEditor(text: text)
        state.textEditors = editors
        persist()
    }

    private func persist() {
        guard let fileURL, let data = try? JSONEncoder().encode(state) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}
