import SwiftUI
import RenderHostCore

enum RenderThemeName: String, CaseIterable {
    case darkGlass = "dark-glass"
    case light
    case monochrome
    case retro

    init(name: String) {
        self = RenderThemeName(rawValue: name) ?? .darkGlass
    }
}

struct RenderTheme {
    let name: RenderThemeName
    let primaryText: Color
    let secondaryText: Color
    let tertiaryText: Color
    let accent: Color
    let danger: Color
    let success: Color
    let surface: Color
    let panel: Color
    let control: Color
    let status: Color
    let border: Color
    let surfaceRadius: CGFloat
    let defaultBorderWidth: CGFloat
    let baseFontSize: CGFloat
    let usesMonospaceTypography: Bool
    let usesScanlines: Bool
    let shadowColor: Color
    let shadowRadius: CGFloat

    init(name: String) {
        self.init(name: RenderThemeName(rawValue: name) ?? .darkGlass)
    }

    init(name: RenderThemeName) {
        self.name = name
        switch name {
        case .darkGlass:
            primaryText = .white
            secondaryText = Color.white.opacity(0.68)
            tertiaryText = Color.white.opacity(0.44)
            accent = Color(red: 0.28, green: 0.82, blue: 0.70)
            danger = Color(red: 0.96, green: 0.38, blue: 0.40)
            success = Color(red: 0.34, green: 0.84, blue: 0.52)
            surface = Color(red: 0.07, green: 0.09, blue: 0.10)
            panel = Color(red: 0.12, green: 0.14, blue: 0.15)
            control = Color.white.opacity(0.12)
            status = Color.white.opacity(0.16)
            border = Color.white.opacity(0.20)
            surfaceRadius = 16
            defaultBorderWidth = 1
            baseFontSize = 13
            usesMonospaceTypography = false
            usesScanlines = false
            shadowColor = .clear
            shadowRadius = 0
        case .light:
            primaryText = Color(red: 0.08, green: 0.10, blue: 0.13)
            secondaryText = Color(red: 0.30, green: 0.34, blue: 0.40)
            tertiaryText = Color(red: 0.46, green: 0.49, blue: 0.54)
            accent = Color(red: 0.08, green: 0.37, blue: 0.82)
            danger = Color(red: 0.75, green: 0.16, blue: 0.18)
            success = Color(red: 0.10, green: 0.52, blue: 0.27)
            surface = Color(red: 0.95, green: 0.96, blue: 0.97)
            panel = .white
            control = Color(red: 0.90, green: 0.92, blue: 0.94)
            status = Color(red: 0.86, green: 0.89, blue: 0.92)
            border = Color.black.opacity(0.14)
            surfaceRadius = 14
            defaultBorderWidth = 1
            baseFontSize = 13
            usesMonospaceTypography = false
            usesScanlines = false
            shadowColor = .black.opacity(0.12)
            shadowRadius = 8
        case .monochrome:
            primaryText = .white
            secondaryText = Color.white.opacity(0.70)
            tertiaryText = Color.white.opacity(0.46)
            accent = .white
            danger = Color.white.opacity(0.90)
            success = .white
            surface = .black
            panel = Color.white.opacity(0.10)
            control = Color.white.opacity(0.16)
            status = Color.white.opacity(0.20)
            border = Color.white.opacity(0.28)
            surfaceRadius = 10
            defaultBorderWidth = 1
            baseFontSize = 13
            usesMonospaceTypography = true
            usesScanlines = false
            shadowColor = .white.opacity(0.10)
            shadowRadius = 6
        case .retro:
            // Retro is the Render-native Vaporwave/Outrun variant: a purple
            // void, chrome text, cyan and magenta signal colors, terminal
            // typography, angular surfaces, and restrained CRT scanlines.
            primaryText = Color(red: 0.88, green: 0.88, blue: 0.88)
            secondaryText = Color(red: 0.88, green: 0.88, blue: 0.88).opacity(0.70)
            tertiaryText = Color(red: 0.88, green: 0.88, blue: 0.88).opacity(0.46)
            accent = Color(red: 1.0, green: 0.0, blue: 1.0)
            danger = Color(red: 1.0, green: 0.20, blue: 0.44)
            success = Color(red: 0.0, green: 1.0, blue: 1.0)
            surface = Color(red: 0.035, green: 0.0, blue: 0.08)
            panel = Color(red: 0.10, green: 0.06, blue: 0.24)
            control = Color(red: 0.0, green: 1.0, blue: 1.0).opacity(0.14)
            status = Color(red: 1.0, green: 0.0, blue: 1.0).opacity(0.16)
            border = Color(red: 0.0, green: 1.0, blue: 1.0).opacity(0.80)
            surfaceRadius = 0
            defaultBorderWidth = 2
            baseFontSize = 13
            usesMonospaceTypography = true
            usesScanlines = true
            shadowColor = Color(red: 0.0, green: 1.0, blue: 1.0).opacity(0.18)
            shadowRadius = 10
        }
    }

    func color(for token: WidgetStyleToken) -> Color? {
        switch token {
        case .surface: return surface
        case .surfaceElevated: return panel
        case .surfacePanel: return panel
        case .surfaceControl: return control
        case .surfaceStatus: return status
        case .textPrimary: return primaryText
        case .textSecondary: return secondaryText
        case .textTertiary: return tertiaryText
        case .borderSubtle: return border
        case .accent: return accent
        case .accentMuted: return accent.opacity(0.34)
        case .danger: return danger
        case .success: return success
        case .mono: return primaryText
        }
    }

    func surfaceColor(role: WidgetSemanticRole?, material: WidgetMaterial?) -> Color? {
        let base: Color?
        switch role {
        case .panel: base = panel
        case .control: base = control
        case .status: base = status
        case .media: base = panel
        case .surface: base = surface
        case nil: base = nil
        }
        guard let base else { return nil }
        switch material {
        case .thin: return base.opacity(name == .light ? 0.92 : 0.78)
        case .thick: return base.opacity(name == .light ? 1.0 : 0.94)
        case .solid, nil: return base
        }
    }

    var usesDarkForeground: Bool {
        name == .light
    }
}
