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

private struct StoredInteractionState: Codable {
    var timers: [String: StoredTimer] = [:]
    var taskLists: [String: StoredTaskList] = [:]
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

    func timerState(path: String, durationSeconds: Int, now: Date = Date()) -> (remaining: Int, running: Bool, endsAt: Date?) {
        guard var stored = state.timers[path] else {
            return (durationSeconds, false, nil)
        }
        if stored.durationSeconds != durationSeconds {
            stored = StoredTimer(durationSeconds: durationSeconds, remainingSeconds: durationSeconds, running: false, updatedAt: nil, endsAt: nil)
            state.timers[path] = stored
            persist()
            return (durationSeconds, false, nil)
        }
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
                durationSeconds: stored.durationSeconds,
                remainingSeconds: remaining,
                running: running,
                updatedAt: running ? now : nil,
                endsAt: running ? stored.endsAt : nil
            )
            persist()
        }
        return (remaining, running, running ? stored.endsAt : nil)
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

    private func persist() {
        guard let fileURL, let data = try? JSONEncoder().encode(state) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}
