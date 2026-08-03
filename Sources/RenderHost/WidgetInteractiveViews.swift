import SwiftUI
import RenderHostCore

struct WidgetTimerView: View {
    let path: String
    let durationSeconds: Int
    @ObservedObject var store: WidgetInteractionStore

    @State private var remainingSeconds: Int
    @State private var running: Bool
    @State private var endsAt: Date?

    init(path: String, durationSeconds: Int, store: WidgetInteractionStore) {
        self.path = path
        self.durationSeconds = durationSeconds
        self.store = store
        let state = store.timerState(path: path, durationSeconds: durationSeconds)
        _remainingSeconds = State(initialValue: state.remaining)
        _running = State(initialValue: state.running)
        _endsAt = State(initialValue: state.endsAt)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(formattedTime)
                .font(.system(size: 42, weight: .bold, design: .monospaced))
                .frame(maxWidth: .infinity, alignment: .center)
            HStack(spacing: 8) {
                Button(running ? "Pause" : "Start") {
                    if running {
                        syncFromDeadline()
                        running = false
                        endsAt = nil
                    } else if remainingSeconds > 0 {
                        running = true
                        endsAt = Date().addingTimeInterval(TimeInterval(remainingSeconds))
                    }
                    save()
                }
                Button("Reset") {
                    remainingSeconds = durationSeconds
                    running = false
                    endsAt = nil
                    save()
                }
            }
            .buttonStyle(.bordered)
            .frame(maxWidth: .infinity)
        }
        .onReceive(Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()) { _ in
            guard running else { return }
            syncFromDeadline()
            if remainingSeconds == 0 {
                running = false
                endsAt = nil
                save()
            }
        }
        .onDisappear { save() }
    }

    private var formattedTime: String {
        let minutes = remainingSeconds / 60
        let seconds = remainingSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private func save() {
        store.saveTimer(
            path: path,
            durationSeconds: durationSeconds,
            remaining: remainingSeconds,
            running: running,
            endsAt: endsAt
        )
    }

    private func syncFromDeadline(now: Date = Date()) {
        guard let endsAt else { return }
        remainingSeconds = max(0, Int(ceil(endsAt.timeIntervalSince(now))))
    }
}

private struct EditableTask: Identifiable, Equatable {
    let id: String
    var text: String
    var completed: Bool
}

struct WidgetTaskListView: View {
    let path: String
    let defaults: [WidgetTaskItem]
    @ObservedObject var store: WidgetInteractionStore

    @State private var tasks: [EditableTask]
    @State private var newTask = ""

    init(path: String, defaults: [WidgetTaskItem], store: WidgetInteractionStore) {
        self.path = path
        self.defaults = defaults
        self.store = store
        _tasks = State(initialValue: store.taskItems(path: path, defaults: defaults).map(Self.editable))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ForEach($tasks) { $task in
                HStack(spacing: 8) {
                    Toggle("", isOn: $task.completed)
                        .labelsHidden()
                        .toggleStyle(.checkbox)
                        .controlSize(.small)
                    TextField("Task", text: $task.text)
                        .textFieldStyle(.plain)
                    Button("−") { remove(task.id) }
                        .buttonStyle(.plain)
                        .foregroundColor(.secondary)
                        .accessibilityLabel("Remove task")
                }
            }
            HStack(spacing: 8) {
                TextField("Add a task", text: $newTask)
                    .textFieldStyle(.roundedBorder)
                Button("Add") { add() }
                    .buttonStyle(.bordered)
                    .disabled(newTask.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .onChange(of: tasks) { _ in save() }
        .onChange(of: defaults) { nextDefaults in
            let current = Set(tasks.map(\.id))
            tasks.append(contentsOf: nextDefaults.filter { !current.contains($0.id) }.map(Self.editable))
        }
        .onDisappear { save() }
    }

    private func add() {
        let text = newTask.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        tasks.append(EditableTask(id: UUID().uuidString, text: text, completed: false))
        newTask = ""
    }

    private func remove(_ id: String) {
        tasks.removeAll { $0.id == id }
    }

    private func save() {
        store.saveTaskItems(path: path, items: tasks.map { WidgetTaskItem(id: $0.id, text: $0.text, completed: $0.completed) })
    }

    private static func editable(_ item: WidgetTaskItem) -> EditableTask {
        EditableTask(id: item.id, text: item.text, completed: item.completed)
    }
}
