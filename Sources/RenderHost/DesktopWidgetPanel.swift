import AppKit
import RenderHostCore

final class DesktopWidgetPanel: NSPanel {
    private let defaultContentSize: NSSize

    init(contentRect: NSRect, policy: DesktopWindowPolicy, adjustable: RuntimeManifest.Adjustable? = nil, preferences: WidgetPreferences = .defaults) {
        defaultContentSize = contentRect.size
        let isAdjustable = adjustable?.enabled == true
        super.init(
            contentRect: contentRect,
            styleMask: isAdjustable ? [.borderless, .nonactivatingPanel, .resizable] : [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        ignoresMouseEvents = policy.ignoresMouseEvents
        isMovable = true
        isMovableByWindowBackground = true
        level = NSWindow.Level(rawValue: DesktopWindowLevel.interactive)
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        isReleasedWhenClosed = false
        apply(preferences: preferences, adjustable: adjustable)
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    func apply(preferences: WidgetPreferences, adjustable: RuntimeManifest.Adjustable?) {
        if let minSize = adjustable?.minSize {
            self.minSize = NSSize(width: minSize.width, height: minSize.height)
        }
        if let maxSize = adjustable?.maxSize {
            self.maxSize = NSSize(width: maxSize.width, height: maxSize.height)
        }
        isMovable = !preferences.locked
        isMovableByWindowBackground = !preferences.locked
        if preferences.locked {
            styleMask.remove(.resizable)
        } else if adjustable?.enabled == true {
            styleMask.insert(.resizable)
        }
        let width = preferences.width ?? defaultContentSize.width
        let height = preferences.height ?? defaultContentSize.height
        setContentSize(NSSize(width: width, height: height))
    }

    func move(to candidateOrigin: NSPoint) {
        let targetScreen = screen(containing: candidateOrigin) ?? NSScreen.main ?? NSScreen.screens.first
        guard let targetScreen else { return }
        setFrameOrigin(clampedOrigin(candidateOrigin, to: targetScreen.visibleFrame))
    }

    func resizeFrame(
        _ candidate: NSRect,
        preservingRightEdge: Bool = false,
        preservingTopEdge: Bool = false
    ) {
        var next = candidate
        let candidateMaxX = candidate.maxX
        let candidateMaxY = candidate.maxY
        next.size.width = min(max(next.width, minSize.width), maxSize.width)
        next.size.height = min(max(next.height, minSize.height), maxSize.height)
        if preservingRightEdge {
            next.origin.x = candidateMaxX - next.width
        }
        if preservingTopEdge {
            next.origin.y = candidateMaxY - next.height
        }
        if let screen = screen(for: next) {
            next.origin = clampedOrigin(next.origin, to: screen.visibleFrame, size: next.size)
        }
        setFrame(next, display: true)
    }

    func clampToVisibleDisplay() {
        guard let screen = screen(for: frame) else { return }
        let origin = clampedOrigin(frame.origin, to: screen.visibleFrame, size: frame.size)
        guard origin != frame.origin else { return }
        setFrameOrigin(origin)
    }

    func placeOnPrimaryDisplay(
        using policy: DesktopWindowPolicy,
        anchor: WidgetAnchor = .topLeft,
        offsetX: Double? = nil,
        offsetY: Double? = nil
    ) {
        guard let screen = NSScreen.screens.first else { return }

        let origin = origin(
            on: screen,
            anchor: anchor,
            offsetX: offsetX ?? policy.offsetX,
            offsetY: offsetY ?? policy.offsetY
        )
        setFrameOrigin(origin)
    }

    func place(_ placement: WidgetPlacement, on screen: NSScreen) {
        setFrameOrigin(
            clampedOrigin(
                NSPoint(x: placement.originX, y: placement.originY),
                to: screen.visibleFrame
            )
        )
    }

    func displayID(for screen: NSScreen) -> UInt32? {
        (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value
    }

    func screen(containing origin: NSPoint) -> NSScreen? {
        let center = NSPoint(x: origin.x + frame.width / 2, y: origin.y + frame.height / 2)
        return NSScreen.screens.first { $0.frame.contains(center) }
    }

    private func screen(for frame: NSRect) -> NSScreen? {
        NSScreen.screens.first { $0.frame.intersects(frame) }
            ?? screen(containing: frame.origin)
            ?? NSScreen.main
    }

    private func origin(
        on screen: NSScreen,
        anchor: WidgetAnchor,
        offsetX: Double,
        offsetY: Double
    ) -> NSPoint {
        let visibleFrame = screen.visibleFrame

        switch anchor {
        case .topLeft:
            return NSPoint(
                x: visibleFrame.minX + offsetX,
                y: visibleFrame.maxY - frame.height - offsetY
            )
        case .topRight:
            return NSPoint(
                x: visibleFrame.maxX - frame.width - offsetX,
                y: visibleFrame.maxY - frame.height - offsetY
            )
        case .bottomLeft:
            return NSPoint(
                x: visibleFrame.minX + offsetX,
                y: visibleFrame.minY + offsetY
            )
        case .bottomRight:
            return NSPoint(
                x: visibleFrame.maxX - frame.width - offsetX,
                y: visibleFrame.minY + offsetY
            )
        }
    }

    private func clampedOrigin(_ origin: NSPoint, to visibleFrame: NSRect, size: NSSize? = nil) -> NSPoint {
        let size = size ?? frame.size
        return WidgetFrameGeometry.clampedOrigin(origin: origin, size: size, visibleFrame: visibleFrame)
    }
}
