import SwiftUI
import RenderHostCore

struct WidgetSettingsOverlay: View {
    let widgetName: String
    let workspace: String?
    let adjustable: RuntimeManifest.Adjustable?
    let defaultSize: RuntimeManifest.Size
    let preferences: WidgetPreferences
    let onPreferencesChange: (WidgetPreferences) -> Void
    let onModeChange: (String) -> Void
    let accountStatus: AccountStatus?
    let authorizationMessage: String?
    let onAuthorize: () -> Void
    let onStop: () -> Void

    @State private var isHovered = false
    @State private var isOpen = false
    @State private var showStopConfirmation = false
    @State private var showPermissionPrompt: Bool
    @State private var widthText: String
    @State private var heightText: String

    init(
        widgetName: String,
        workspace: String?,
        adjustable: RuntimeManifest.Adjustable?,
        defaultSize: RuntimeManifest.Size,
        preferences: WidgetPreferences,
        onPreferencesChange: @escaping (WidgetPreferences) -> Void,
        onModeChange: @escaping (String) -> Void,
        accountStatus: AccountStatus?,
        authorizationMessage: String?,
        onAuthorize: @escaping () -> Void,
        onStop: @escaping () -> Void
    ) {
        self.widgetName = widgetName
        self.workspace = workspace
        self.adjustable = adjustable
        self.defaultSize = defaultSize
        self.preferences = preferences
        self.onPreferencesChange = onPreferencesChange
        self.onModeChange = onModeChange
        self.accountStatus = accountStatus
        self.authorizationMessage = authorizationMessage
        self.onAuthorize = onAuthorize
        self.onStop = onStop
        _showPermissionPrompt = State(initialValue: accountStatus?.state == .needsAuthorization)
        _widthText = State(initialValue: preferences.width.map(Self.format) ?? Self.format(defaultSize.width))
        _heightText = State(initialValue: preferences.height.map(Self.format) ?? Self.format(defaultSize.height))
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.clear
                .frame(width: 58, height: 58)
                .contentShape(Rectangle())
                .onHover { hovering in
                    withAnimation(.easeOut(duration: 0.16)) { isHovered = hovering }
                }
                .zIndex(1)

            if showPermissionPrompt, let accountStatus {
                permissionPrompt(for: accountStatus)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
                    .zIndex(2)
            }

            VStack(alignment: .trailing, spacing: 8) {
                settingsButton
                if isOpen {
                    settingsPanel
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .padding(10)
            .allowsHitTesting(isHovered || isOpen)
            .zIndex(3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .animation(.easeOut(duration: 0.16), value: isOpen)
        .onChange(of: preferences.width) { width in
            widthText = width.map(Self.format) ?? Self.format(defaultSize.width)
        }
        .onChange(of: preferences.height) { height in
            heightText = height.map(Self.format) ?? Self.format(defaultSize.height)
        }
        .alert("Stop this widget?", isPresented: $showStopConfirmation) {
            Button("Stop Widget", role: .destructive, action: onStop)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The widget will be removed from the desktop. You can run it again from its Render workspace.")
        }
    }

    private var settingsButton: some View {
        Button {
            isOpen.toggle()
        } label: {
            Image(systemName: "gearshape")
                .font(.system(size: 12, weight: .semibold))
                .frame(width: 26, height: 26)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundColor(.primary)
        .background(.ultraThinMaterial, in: Circle())
        .overlay(Circle().stroke(Color.white.opacity(0.24), lineWidth: 0.5))
        .opacity(isHovered || isOpen ? 1 : 0)
        .accessibilityLabel("Widget settings")
        .accessibilityHint("Opens widget metadata, connection settings, and the stop control")
    }

    private var settingsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Widget settings")
                    .font(.headline)
                Spacer(minLength: 20)
                Button("Close") { isOpen = false }
                    .buttonStyle(.plain)
                    .foregroundColor(.secondary)
            }

            metadataRow("Name", widgetName)
            metadataRow("Process", "\(ProcessInfo.processInfo.processIdentifier)")
            metadataRow("Kill command", "kill \(ProcessInfo.processInfo.processIdentifier)")
            if let workspace {
                metadataRow("Workspace", URL(fileURLWithPath: workspace).lastPathComponent)
            }

            Divider().opacity(0.35)

            if let accountStatus {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: accountIcon(accountStatus.state))
                        .foregroundColor(accountColor(accountStatus.state))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(connectorName(accountStatus.connector))
                            .font(.subheadline.weight(.semibold))
                        Text(accountStatus.displayName ?? accountStatus.message ?? accountStatus.state.rawValue)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        if accountStatus.state != .connected {
                            Button("Accept permissions") {
                                onAuthorize()
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                        }
                        if let authorizationMessage {
                            Text(authorizationMessage)
                                .font(.caption2)
                                .foregroundColor(.orange)
                        }
                    }
                }
            }

            if adjustable?.enabled == true {
                Divider().opacity(0.35)
                adjustableControls
            }

            Button("Stop Widget", role: .destructive) {
                showStopConfirmation = true
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding(14)
        .frame(minWidth: 250, alignment: .leading)
        .liquidGlassSurface()
    }

    private func permissionPrompt(for status: AccountStatus) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "person.crop.circle.badge.checkmark")
                    .font(.title3)
                    .foregroundColor(.green)
                Text("Connect \(connectorName(status.connector))")
                    .font(.headline)
            }
            Text(permissionDescription(for: status.connector))
                .font(.subheadline)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Button("Accept permissions") {
                    showPermissionPrompt = false
                    onAuthorize()
                }
                .buttonStyle(.borderedProminent)
                Button("Not now") {
                    showPermissionPrompt = false
                }
                .buttonStyle(.plain)
            }
            if let authorizationMessage {
                Text(authorizationMessage)
                    .font(.caption)
                    .foregroundColor(.orange)
            }
            if let message = status.message, status.state == .unavailable {
                Text(message)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: 340, alignment: .leading)
        .liquidGlassSurface()
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    private func metadataRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer(minLength: 8)
            Text(value)
                .font(.caption.monospaced())
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }

    private func connectorName(_ connector: String) -> String {
        switch connector {
        case "spotify": return "Spotify"
        case "reminders": return "Reminders"
        default: return connector.replacingOccurrences(of: ".", with: " ").capitalized
        }
    }

    private func permissionDescription(for connector: String) -> String {
        switch connector {
        case "spotify":
            return "This widget needs permission to read your current playback and control your Spotify player. Render keeps the account tokens in the macOS Keychain."
        case "reminders":
            return "This widget needs permission to read and update your macOS Reminders. Render keeps EventKit objects and reminder data in the native host."
        default:
            return "This widget needs permission to use the \(connectorName(connector)) connector."
        }
    }

    private var adjustableControls: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Layout")
                .font(.subheadline.weight(.semibold))

            HStack(spacing: 8) {
                TextField("Width", text: $widthText)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 74)
                Text("×")
                    .foregroundColor(.secondary)
                TextField("Height", text: $heightText)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 74)
                Button("Apply") { applySize() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }

            Toggle("Lock size and position", isOn: Binding(
                get: { preferences.locked },
                set: { locked in
                    var next = preferences
                    next.locked = locked
                    onPreferencesChange(next)
                }
            ))

            if let responsive = adjustable?.responsive, responsive.modes.count > 1 {
                Picker("Mode", selection: Binding(
                    get: { preferences.mode },
                    set: onModeChange
                )) {
                    Text("Auto").tag("auto")
                    ForEach(responsive.modes.keys.sorted(), id: \.self) { mode in
                        Text(mode.capitalized).tag(mode)
                    }
                }
                .pickerStyle(.menu)
            }

            Button("Reset size") {
                var next = preferences
                next.width = nil
                next.height = nil
                widthText = Self.format(defaultSize.width)
                heightText = Self.format(defaultSize.height)
                onPreferencesChange(next)
            }
            .buttonStyle(.plain)
            .foregroundColor(.secondary)
        }
    }

    private func applySize() {
        guard let width = Double(widthText), let height = Double(heightText) else { return }
        var next = preferences
        next.width = clamped(width, axis: .width)
        next.height = clamped(height, axis: .height)
        widthText = Self.format(next.width ?? width)
        heightText = Self.format(next.height ?? height)
        onPreferencesChange(next)
    }

    private enum Axis { case width, height }

    private func clamped(_ value: Double, axis: Axis) -> Double {
        let minimum = axis == .width ? adjustable?.minSize?.width : adjustable?.minSize?.height
        let maximum = axis == .width ? adjustable?.maxSize?.width : adjustable?.maxSize?.height
        return min(max(value, minimum ?? 1), maximum ?? value)
    }

    private static func format(_ value: Double) -> String {
        String(Int(value.rounded()))
    }

    private func accountIcon(_ state: AccountState) -> String {
        switch state {
        case .connected: return "checkmark.circle.fill"
        case .needsAuthorization, .expired, .revoked: return "exclamationmark.circle.fill"
        case .denied, .unavailable: return "xmark.circle.fill"
        }
    }

    private func accountColor(_ state: AccountState) -> Color {
        switch state {
        case .connected: return .green
        case .needsAuthorization, .expired, .revoked: return .orange
        case .denied, .unavailable: return .red
        }
    }
}

private extension View {
    func liquidGlassSurface() -> some View {
        background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.38), Color.white.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 0.8
                    )
            )
            .shadow(color: .black.opacity(0.22), radius: 18, y: 8)
    }
}
