import AppKit
import RenderHostCore
import SwiftUI

final class WidgetInteractionCoordinator {
    private var hoveredControls: Set<UUID> = []

    var isPointerOverControl: Bool { !hoveredControls.isEmpty }

    func setHovered(_ hovered: Bool, controlID: UUID) {
        if hovered {
            hoveredControls.insert(controlID)
        } else {
            hoveredControls.remove(controlID)
        }
    }
}

struct WidgetInteractionPhase: Equatable {
    var hovered = false
    var pressed = false
    var focused = false
    var disabled = false

    func merging(_ child: WidgetInteractionPhase) -> WidgetInteractionPhase {
        WidgetInteractionPhase(
            hovered: hovered || child.hovered,
            pressed: pressed || child.pressed,
            focused: focused || child.focused,
            disabled: disabled || child.disabled
        )
    }
}

private struct WidgetInteractionPhaseKey: EnvironmentKey {
    static let defaultValue = WidgetInteractionPhase()
}

extension EnvironmentValues {
    var widgetInteractionPhase: WidgetInteractionPhase {
        get { self[WidgetInteractionPhaseKey.self] }
        set { self[WidgetInteractionPhaseKey.self] = newValue }
    }
}

enum WidgetParentAxis {
    case horizontal
    case vertical
}

struct WidgetCursorModifier: ViewModifier {
    let cursor: WidgetCursor?
    let enabled: Bool

    func body(content: Content) -> some View {
        content.onHover { hovering in
            guard enabled else {
                NSCursor.arrow.set()
                return
            }
            (hovering ? nativeCursor : NSCursor.arrow).set()
        }
    }

    private var nativeCursor: NSCursor {
        switch cursor {
        case .pointer: return .pointingHand
        case .text: return .iBeam
        case .crosshair: return .crosshair
        case .move: return .openHand
        case .notAllowed: return .operationNotAllowed
        case .default, nil: return .arrow
        }
    }
}
