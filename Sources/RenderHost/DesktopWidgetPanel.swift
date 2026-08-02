import AppKit
import RenderHostCore

final class DesktopWidgetPanel: NSPanel {
    init(contentRect: NSRect, policy: DesktopWindowPolicy) {
        super.init(
            contentRect: contentRect,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        ignoresMouseEvents = policy.ignoresMouseEvents
        level = NSWindow.Level(rawValue: DesktopWindowLevel.interactive)
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        isReleasedWhenClosed = false
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    func move(to candidateOrigin: NSPoint) {
        if let screen = screen(containing: candidateOrigin) {
            setFrameOrigin(clampedOrigin(candidateOrigin, to: screen.visibleFrame))
        } else {
            setFrameOrigin(candidateOrigin)
        }
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

    private func clampedOrigin(_ origin: NSPoint, to visibleFrame: NSRect) -> NSPoint {
        let maximumX = max(visibleFrame.minX, visibleFrame.maxX - frame.width)
        let maximumY = max(visibleFrame.minY, visibleFrame.maxY - frame.height)
        return NSPoint(
            x: min(max(origin.x, visibleFrame.minX), maximumX),
            y: min(max(origin.y, visibleFrame.minY), maximumY)
        )
    }
}
