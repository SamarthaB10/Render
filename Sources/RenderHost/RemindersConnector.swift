import EventKit
import Foundation
import RenderHostCore

struct ReminderRecord: Equatable, Sendable {
    let id: String
    let title: String
    let completed: Bool
    let listName: String
    let dueDate: Date?
}

enum RemindersCommand: Sendable {
    case create(title: String, listName: String?, dueDate: Date?)
    case update(id: String, title: String?, dueDate: Date?, clearDueDate: Bool, completed: Bool?)
    case complete(id: String, completed: Bool)
    case delete(id: String)
}

enum RemindersConnectorError: LocalizedError {
    case authorizationRequired
    case authorizationDenied
    case unavailable(String)
    case invalidPayload
    case missingReminder(String)
    case missingList(String)

    var errorDescription: String? {
        switch self {
        case .authorizationRequired:
            return "Accept Reminders permissions before using this widget"
        case .authorizationDenied:
            return "Reminders permission is denied; enable it for Render in System Settings"
        case .unavailable(let message):
            return "Reminders is unavailable: \(message)"
        case .invalidPayload:
            return "The Reminders operation payload is invalid"
        case .missingReminder(let id):
            return "Reminders item '\(id)' was not found"
        case .missingList(let name):
            return "Reminders list '\(name)' was not found"
        }
    }
}

final class RemindersConnector {
    static let connectorID = "reminders"
    static let supportedScopes = ["reminders.read", "reminders.write"]

    private let store = EKEventStore()

    func status(scopes: [String]) -> AccountStatus {
        switch authorizationState {
        case .connected:
            return AccountStatus(connector: Self.connectorID, state: .connected, scopes: scopes)
        case .needsAuthorization:
            return AccountStatus(
                connector: Self.connectorID,
                state: .needsAuthorization,
                scopes: scopes,
                message: "Accept Reminders permissions to continue"
            )
        case .denied:
            return AccountStatus(
                connector: Self.connectorID,
                state: .denied,
                scopes: scopes,
                message: "Enable Reminders access for Render in System Settings"
            )
        case .unavailable(let message):
            return AccountStatus(connector: Self.connectorID, state: .unavailable, scopes: scopes, message: message)
        }
    }

    func authorize(scopes: [String]) async throws -> AccountStatus {
        let granted: Bool
        if #available(macOS 14.0, *) {
            granted = try await store.requestFullAccessToReminders()
        } else {
            granted = try await withCheckedThrowingContinuation { continuation in
                store.requestAccess(to: .reminder) { granted, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: granted)
                    }
                }
            }
        }
        guard granted else { throw RemindersConnectorError.authorizationDenied }
        return status(scopes: scopes)
    }

    func reminders() async throws -> [ReminderRecord] {
        try requireAccess()
        let calendars = store.calendars(for: .reminder)
        let predicate = store.predicateForReminders(in: calendars)
        return try await withCheckedThrowingContinuation { continuation in
            store.fetchReminders(matching: predicate) { reminders in
                let records = (reminders ?? []).map(Self.record(from:)).sorted(by: Self.sortByDueDate)
                continuation.resume(returning: records)
            }
        }
    }

    func perform(_ command: RemindersCommand) throws {
        try requireAccess()
        switch command {
        case .create(let title, let listName, let dueDate):
            let reminder = EKReminder(eventStore: store)
            reminder.title = title
            reminder.calendar = try calendar(named: listName)
            reminder.dueDateComponents = dueDate.map(dateComponents)
            try store.save(reminder, commit: true)
        case .update(let id, let title, let dueDate, let clearDueDate, let completed):
            let reminder = try reminder(id: id)
            if let title { reminder.title = title }
            if clearDueDate { reminder.dueDateComponents = nil }
            else if let dueDate { reminder.dueDateComponents = dateComponents(dueDate) }
            if let completed { reminder.isCompleted = completed }
            try store.save(reminder, commit: true)
        case .complete(let id, let completed):
            let reminder = try reminder(id: id)
            reminder.isCompleted = completed
            try store.save(reminder, commit: true)
        case .delete(let id):
            try store.remove(try reminder(id: id), commit: true)
        }
    }

    private enum AuthorizationState {
        case connected
        case needsAuthorization
        case denied
        case unavailable(String)
    }

    private var authorizationState: AuthorizationState {
        let status = EKEventStore.authorizationStatus(for: .reminder)
        if #available(macOS 14.0, *) {
            switch status {
            case .fullAccess: return .connected
            case .writeOnly: return .denied
            case .notDetermined: return .needsAuthorization
            case .denied, .restricted: return .denied
            @unknown default: return .unavailable("macOS returned an unknown Reminders authorization state")
            }
        }
        switch status {
        case .authorized: return .connected
        case .fullAccess: return .connected
        case .writeOnly: return .denied
        case .notDetermined: return .needsAuthorization
        case .denied, .restricted: return .denied
        @unknown default: return .unavailable("macOS returned an unknown Reminders authorization state")
        }
    }

    private func requireAccess() throws {
        switch authorizationState {
        case .connected: return
        case .needsAuthorization: throw RemindersConnectorError.authorizationRequired
        case .denied: throw RemindersConnectorError.authorizationDenied
        case .unavailable(let message): throw RemindersConnectorError.unavailable(message)
        }
    }

    private func calendar(named name: String?) throws -> EKCalendar {
        let calendars = store.calendars(for: .reminder)
        if let name {
            guard let calendar = calendars.first(where: { $0.title.caseInsensitiveCompare(name) == .orderedSame }) else {
                throw RemindersConnectorError.missingList(name)
            }
            return calendar
        }
        guard let calendar = calendars.first else {
            throw RemindersConnectorError.unavailable("no Reminders list is available")
        }
        return calendar
    }

    private func reminder(id: String) throws -> EKReminder {
        guard let reminder = store.calendarItem(withIdentifier: id) as? EKReminder else {
            throw RemindersConnectorError.missingReminder(id)
        }
        return reminder
    }

    private func dateComponents(_ date: Date) -> DateComponents {
        Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
    }

    private static func record(from reminder: EKReminder) -> ReminderRecord {
        ReminderRecord(
            id: reminder.calendarItemIdentifier,
            title: reminder.title,
            completed: reminder.isCompleted,
            listName: reminder.calendar.title,
            dueDate: reminder.dueDateComponents.flatMap { Calendar.current.date(from: $0) }
        )
    }

    private static func sortByDueDate(_ lhs: ReminderRecord, _ rhs: ReminderRecord) -> Bool {
        switch (lhs.dueDate, rhs.dueDate) {
        case let (left?, right?):
            if left != right { return left < right }
        case (_?, nil): return true
        case (nil, _?): return false
        default: break
        }
        return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
    }
}
