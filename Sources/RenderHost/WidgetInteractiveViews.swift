import SwiftUI
import RenderHostCore

struct WidgetTimerView: View {
    let path: String
    let style: WidgetStyle?
    @ObservedObject var store: WidgetInteractionStore

    @State private var configuredDurationSeconds: Int
    @State private var remainingSeconds: Int
    @State private var running: Bool
    @State private var endsAt: Date?
    @State private var durationText: String

    init(path: String, durationSeconds: Int, style: WidgetStyle? = nil, store: WidgetInteractionStore) {
        self.path = path
        self.style = style
        self.store = store
        let state = store.timerState(path: path, defaultDurationSeconds: durationSeconds)
        _configuredDurationSeconds = State(initialValue: state.durationSeconds)
        _remainingSeconds = State(initialValue: state.remaining)
        _running = State(initialValue: state.running)
        _endsAt = State(initialValue: state.endsAt)
        _durationText = State(initialValue: Self.durationText(for: state.durationSeconds))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(formattedTime)
                .font(.system(size: CGFloat(style?.font?.size ?? 42), weight: .bold, design: .monospaced))
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
                    remainingSeconds = configuredDurationSeconds
                    running = false
                    endsAt = nil
                    save()
                }
            }
            .buttonStyle(.bordered)
            .frame(maxWidth: .infinity)
            HStack(spacing: 8) {
                TextField("MM:SS", text: $durationText)
                    .textFieldStyle(.roundedBorder)
                Button("Set") { applyDuration() }
                    .buttonStyle(.bordered)
                    .disabled(parsedDuration == nil)
            }
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
            durationSeconds: configuredDurationSeconds,
            remaining: remainingSeconds,
            running: running,
            endsAt: endsAt
        )
    }

    private var parsedDuration: Int? {
        let parts = durationText.split(separator: ":", omittingEmptySubsequences: false)
        if parts.count == 1, let minutes = Int(parts[0]), minutes > 0 {
            return minutes * 60
        }
        guard parts.count == 2, let minutes = Int(parts[0]), let seconds = Int(parts[1]), minutes >= 0, seconds >= 0, seconds < 60 else {
            return nil
        }
        let duration = minutes * 60 + seconds
        return duration > 0 ? duration : nil
    }

    private func applyDuration() {
        guard let duration = parsedDuration else { return }
        configuredDurationSeconds = duration
        remainingSeconds = duration
        running = false
        endsAt = nil
        durationText = Self.durationText(for: duration)
        save()
    }

    private static func durationText(for durationSeconds: Int) -> String {
        String(format: "%02d:%02d", durationSeconds / 60, durationSeconds % 60)
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
                let taskID = $task.wrappedValue.id
                let taskIndex = tasks.firstIndex { $0.id == taskID } ?? 0
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
                    Button("↑") { move(taskID, by: -1) }
                        .buttonStyle(.plain)
                        .disabled(taskIndex == 0)
                        .accessibilityLabel("Move task up")
                    Button("↓") { move(taskID, by: 1) }
                        .buttonStyle(.plain)
                        .disabled(taskIndex == tasks.count - 1)
                        .accessibilityLabel("Move task down")
                }
            }
            if tasks.contains(where: { $0.completed }) {
                Button("Clear completed") { tasks.removeAll { $0.completed } }
                    .buttonStyle(.bordered)
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

    private func move(_ id: String, by offset: Int) {
        guard let index = tasks.firstIndex(where: { $0.id == id }) else { return }
        let destination = index + offset
        guard tasks.indices.contains(destination) else { return }
        tasks.swapAt(index, destination)
    }

    private func save() {
        store.saveTaskItems(path: path, items: tasks.map { WidgetTaskItem(id: $0.id, text: $0.text, completed: $0.completed) })
    }

    private static func editable(_ item: WidgetTaskItem) -> EditableTask {
        EditableTask(id: item.id, text: item.text, completed: item.completed)
    }
}

struct WidgetDateTimeView: View {
    let value: String
    let mode: String

    var body: some View {
        Text(formattedValue)
    }

    private var formattedValue: String {
        guard let date = ISO8601DateFormatter().date(from: value) else { return "Unavailable" }
        let formatter = DateFormatter()
        formatter.dateStyle = mode == "time" ? .none : .medium
        formatter.timeStyle = mode == "date" ? .none : .short
        return formatter.string(from: date)
    }
}

struct WidgetDateTimePickerView: View {
    let path: String
    let initialValue: String?
    let mode: String
    @ObservedObject var store: WidgetInteractionStore
    @State private var selectedDate: Date

    init(path: String, initialValue: String?, mode: String, store: WidgetInteractionStore) {
        self.path = path
        self.initialValue = initialValue
        self.mode = mode
        self.store = store
        let defaultValue = initialValue.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date()
        _selectedDate = State(initialValue: store.dateTimeValue(path: path, defaultValue: defaultValue))
    }

    var body: some View {
        Group {
            switch mode {
            case "date":
                DatePicker("", selection: $selectedDate, displayedComponents: .date)
            case "time":
                DatePicker("", selection: $selectedDate, displayedComponents: .hourAndMinute)
            default:
                DatePicker("", selection: $selectedDate, displayedComponents: [.date, .hourAndMinute])
            }
        }
        .labelsHidden()
        .datePickerStyle(.compact)
        .onChange(of: selectedDate) { nextDate in
            store.saveDateTime(path: path, value: nextDate)
        }
        .onDisappear { store.saveDateTime(path: path, value: selectedDate) }
    }
}
