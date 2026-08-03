import AppKit

private enum WidgetResizeEdge {
    case left
    case right
    case top
    case bottom
    case topLeft
    case topRight
    case bottomLeft
    case bottomRight
}

final class AdjustableWidgetContentView: NSView {
    private weak var panel: DesktopWidgetPanel?
    private let hostedView: NSView
    private let edgeInset: CGFloat = 12
    private var startFrame: NSRect?
    private var startMouseLocation: NSPoint?
    private var activeEdge: WidgetResizeEdge?

    init(hostedView: NSView, panel: DesktopWidgetPanel) {
        self.hostedView = hostedView
        self.panel = panel
        super.init(frame: .zero)
        addSubview(hostedView)
        autoresizingMask = [.width, .height]
    }

    required init?(coder: NSCoder) {
        fatalError("AdjustableWidgetContentView does not support NSCoder initialization")
    }

    override func layout() {
        super.layout()
        hostedView.frame = bounds
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func hitTest(_ point: NSPoint) -> NSView? {
        guard let edge = edge(at: point), panel?.isMovable == true else {
            return super.hitTest(point)
        }
        _ = edge
        return self
    }

    override func resetCursorRects() {
        super.resetCursorRects()
        let inset = edgeInset
        addCursorRect(NSRect(x: 0, y: inset, width: inset, height: max(0, bounds.height - inset * 2)), cursor: .resizeLeftRight)
        addCursorRect(NSRect(x: bounds.maxX - inset, y: inset, width: inset, height: max(0, bounds.height - inset * 2)), cursor: .resizeLeftRight)
        addCursorRect(NSRect(x: inset, y: 0, width: max(0, bounds.width - inset * 2), height: inset), cursor: .resizeUpDown)
        addCursorRect(NSRect(x: inset, y: bounds.maxY - inset, width: max(0, bounds.width - inset * 2), height: inset), cursor: .resizeUpDown)
    }

    override func mouseDown(with event: NSEvent) {
        guard let edge = edge(at: convert(event.locationInWindow, from: nil)), let panel else {
            super.mouseDown(with: event)
            return
        }
        activeEdge = edge
        startFrame = panel.frame
        startMouseLocation = NSEvent.mouseLocation
    }

    override func mouseDragged(with event: NSEvent) {
        guard let edge = activeEdge, let startFrame, let startMouseLocation, let panel else { return }
        let location = NSEvent.mouseLocation
        let delta = NSPoint(x: location.x - startMouseLocation.x, y: location.y - startMouseLocation.y)
        var frame = startFrame

        switch edge {
        case .left, .topLeft, .bottomLeft:
            frame.origin.x = startFrame.origin.x + delta.x
            frame.size.width = startFrame.width - delta.x
        case .right, .topRight, .bottomRight:
            frame.size.width = startFrame.width + delta.x
        default: break
        }
        switch edge {
        case .bottom, .bottomLeft, .bottomRight:
            frame.origin.y = startFrame.origin.y + delta.y
            frame.size.height = startFrame.height - delta.y
        case .top, .topLeft, .topRight:
            frame.size.height = startFrame.height + delta.y
        default: break
        }
        panel.resizeFrame(frame)
    }

    override func mouseUp(with event: NSEvent) {
        activeEdge = nil
        startFrame = nil
        startMouseLocation = nil
    }

    private func edge(at point: NSPoint) -> WidgetResizeEdge? {
        guard bounds.contains(point) else { return nil }
        // Keep the host-owned settings control clickable in the top-right corner.
        if point.x > bounds.maxX - 72 && point.y > bounds.maxY - 72 { return nil }
        let left = point.x <= edgeInset
        let right = point.x >= bounds.maxX - edgeInset
        let bottom = point.y <= edgeInset
        let top = point.y >= bounds.maxY - edgeInset
        switch (left, right, top, bottom) {
        case (true, false, true, false): return .topLeft
        case (false, true, true, false): return .topRight
        case (true, false, false, true): return .bottomLeft
        case (false, true, false, true): return .bottomRight
        case (true, false, false, false): return .left
        case (false, true, false, false): return .right
        case (false, false, true, false): return .top
        case (false, false, false, true): return .bottom
        default: return nil
        }
    }
}
