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
        level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        isReleasedWhenClosed = false
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    func placeOnPrimaryDisplay(using policy: DesktopWindowPolicy) {
        guard let screen = NSScreen.screens.first else { return }
        let visibleFrame = screen.visibleFrame
        let origin = NSPoint(
            x: visibleFrame.minX + policy.offsetX,
            y: visibleFrame.maxY - frame.height - policy.offsetY
        )
        setFrameOrigin(origin)
    }
}
