import AppKit
import RenderHostCore

enum WidgetWindowShape: String, Codable {
    case rectangle
    case circle
}

final class DesktopWidgetPanel: NSPanel {
    let windowShape: WidgetWindowShape

    init(
        contentRect: NSRect,
        policy: DesktopWindowPolicy,
        resizable: Bool = true,
        windowShape: WidgetWindowShape = .rectangle
    ) {
        self.windowShape = windowShape
        var styleMask: NSWindow.StyleMask = [.borderless, .nonactivatingPanel]
        if resizable {
            styleMask.insert(.resizable)
        }
        let initialRect: NSRect
        if windowShape == .circle {
            let side = min(contentRect.width, contentRect.height)
            initialRect = NSRect(x: contentRect.minX, y: contentRect.minY, width: side, height: side)
        } else {
            initialRect = contentRect
        }
        super.init(
            contentRect: initialRect,
            styleMask: styleMask,
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
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    func normalizeWindowShape() {
        guard windowShape == .circle else { return }
        let contentSize = contentRect(forFrameRect: frame).size
        let side = min(contentSize.width, contentSize.height)
        guard side > 0, contentSize.width != side || contentSize.height != side else { return }
        setContentSize(NSSize(width: side, height: side))
    }

    func resizeFrame(
        _ candidate: NSRect,
        preservingRightEdge: Bool = false,
        preservingTopEdge: Bool = false
    ) {
        var next = candidate
        let candidateMaxX = candidate.maxX
        let candidateMaxY = candidate.maxY
        if windowShape == .circle {
            let side = max(max(candidate.width, candidate.height), 1)
            next.size = NSSize(width: side, height: side)
        } else {
            next.size.width = max(next.width, 1)
            next.size.height = max(next.height, 1)
        }
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

    func move(to candidateOrigin: NSPoint) {
        let targetScreen = screen(containing: candidateOrigin) ?? NSScreen.main ?? NSScreen.screens.first
        guard let targetScreen else { return }
        setFrameOrigin(clampedOrigin(candidateOrigin, to: targetScreen.visibleFrame))
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
        return NSPoint(
            x: min(max(origin.x, visibleFrame.minX), max(visibleFrame.minX, visibleFrame.maxX - size.width)),
            y: min(max(origin.y, visibleFrame.minY), max(visibleFrame.minY, visibleFrame.maxY - size.height))
        )
    }
}
