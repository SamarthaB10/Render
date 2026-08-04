import AppKit

private enum WidgetResizeEdge: Equatable {
    case left
    case right
    case top
    case bottom
    case topLeft
    case topRight
    case bottomLeft
    case bottomRight
}

final class ResizableWidgetContentView: NSView {
    private weak var panel: DesktopWidgetPanel?
    private let hostedView: NSView
    private let interactionCoordinator: WidgetInteractionCoordinator
    private let edgeInset: CGFloat = 18
    private var startFrame: NSRect?
    private var startMouseLocation: NSPoint?
    private var activeEdge: WidgetResizeEdge?

    init(
        hostedView: NSView,
        panel: DesktopWidgetPanel,
        interactionCoordinator: WidgetInteractionCoordinator
    ) {
        self.hostedView = hostedView
        self.panel = panel
        self.interactionCoordinator = interactionCoordinator
        super.init(frame: .zero)
        wantsLayer = true
        addSubview(hostedView)
        autoresizingMask = [.width, .height]
    }

    required init?(coder: NSCoder) {
        fatalError("ResizableWidgetContentView does not support NSCoder initialization")
    }

    override func layout() {
        super.layout()
        hostedView.frame = bounds
        layer?.masksToBounds = panel?.windowShape == .circle
        layer?.cornerRadius = panel?.windowShape == .circle ? min(bounds.width, bounds.height) / 2 : 0
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func hitTest(_ point: NSPoint) -> NSView? {
        guard containsSurface(point) else { return nil }
        if !interactionCoordinator.isPointerOverControl,
           let edge = edge(at: point), panel?.supportsResizing == true {
            _ = edge
            return self
        }
        return super.hitTest(point)
    }

    override func resetCursorRects() {
        super.resetCursorRects()
        guard panel?.supportsResizing == true else { return }
        let inset = edgeInset
        addCursorRect(NSRect(x: 0, y: inset, width: inset, height: max(0, bounds.height - inset * 2)), cursor: .resizeLeftRight)
        addCursorRect(NSRect(x: bounds.maxX - inset, y: inset, width: inset, height: max(0, bounds.height - inset * 2)), cursor: .resizeLeftRight)
        addCursorRect(NSRect(x: inset, y: 0, width: max(0, bounds.width - inset * 2), height: inset), cursor: .resizeUpDown)
        addCursorRect(NSRect(x: inset, y: bounds.maxY - inset, width: max(0, bounds.width - inset * 2), height: inset), cursor: .resizeUpDown)
        if panel?.windowShape == .rectangle {
            addCursorRect(NSRect(x: 0, y: bounds.maxY - inset, width: inset, height: inset), cursor: .crosshair)
            addCursorRect(NSRect(x: bounds.maxX - inset, y: bounds.maxY - inset, width: inset, height: inset), cursor: .crosshair)
            addCursorRect(NSRect(x: 0, y: 0, width: inset, height: inset), cursor: .crosshair)
            addCursorRect(NSRect(x: bounds.maxX - inset, y: 0, width: inset, height: inset), cursor: .crosshair)
        }
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

        if panel.windowShape == .circle {
            let horizontalDelta: CGFloat
            let verticalDelta: CGFloat
            switch edge {
            case .left, .topLeft, .bottomLeft: horizontalDelta = -delta.x
            case .right, .topRight, .bottomRight: horizontalDelta = delta.x
            default: horizontalDelta = 0
            }
            switch edge {
            case .bottom, .bottomLeft, .bottomRight: verticalDelta = -delta.y
            case .top, .topLeft, .topRight: verticalDelta = delta.y
            default: verticalDelta = 0
            }
            let sideDelta = abs(horizontalDelta) >= abs(verticalDelta) ? horizontalDelta : verticalDelta
            let side = max(startFrame.width + sideDelta, 1)
            frame.size = NSSize(width: side, height: side)
        }

        panel.resizeFrame(
            frame,
            preservingRightEdge: [.left, .topLeft, .bottomLeft].contains(edge),
            preservingTopEdge: [.bottom, .bottomLeft, .bottomRight].contains(edge)
        )
    }

    override func mouseUp(with event: NSEvent) {
        activeEdge = nil
        startFrame = nil
        startMouseLocation = nil
    }

    private func edge(at point: NSPoint) -> WidgetResizeEdge? {
        guard bounds.contains(point), containsSurface(point) else { return nil }
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

    private func containsSurface(_ point: NSPoint) -> Bool {
        guard panel?.windowShape == .circle else { return true }
        let center = NSPoint(x: bounds.midX, y: bounds.midY)
        let radius = min(bounds.width, bounds.height) / 2
        let dx = point.x - center.x
        let dy = point.y - center.y
        return (dx * dx) + (dy * dy) <= radius * radius
    }
}
