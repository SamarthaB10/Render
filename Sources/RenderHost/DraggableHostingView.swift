import AppKit
import SwiftUI

final class DraggableHostingView: NSHostingView<AnyView> {
    var onDrag: ((NSPoint) -> Void)?
    var onDragEnded: (() -> Void)?
    var shouldForwardMouseEvents: (() -> Bool)?

    private var dragStartMouseLocation: NSPoint?
    private var dragStartOrigin: NSPoint?
    private var forwardingMouseDown = false

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override var mouseDownCanMoveWindow: Bool {
        false
    }

    override func mouseDown(with event: NSEvent) {
        if hitInteractiveControl(at: event) || shouldForwardMouseEvents?() == true {
            forwardingMouseDown = true
            super.mouseDown(with: event)
            return
        }
        forwardingMouseDown = false
        dragStartMouseLocation = NSEvent.mouseLocation
        dragStartOrigin = window?.frame.origin
    }

    override func mouseDragged(with event: NSEvent) {
        if forwardingMouseDown {
            super.mouseDragged(with: event)
            return
        }
        guard let dragStartMouseLocation, let dragStartOrigin else { return }

        let mouseLocation = NSEvent.mouseLocation
        onDrag?(
            NSPoint(
                x: dragStartOrigin.x + mouseLocation.x - dragStartMouseLocation.x,
                y: dragStartOrigin.y + mouseLocation.y - dragStartMouseLocation.y
            )
        )
    }

    override func mouseUp(with event: NSEvent) {
        if forwardingMouseDown {
            forwardingMouseDown = false
            super.mouseUp(with: event)
            return
        }
        guard dragStartOrigin != nil else { return }
        dragStartMouseLocation = nil
        dragStartOrigin = nil
        onDragEnded?()
    }

    private func hitInteractiveControl(at event: NSEvent) -> Bool {
        let point = convert(event.locationInWindow, from: nil)
        var view = hitTest(point)
        while let candidate = view {
            if candidate is NSControl { return true }
            view = candidate.superview
        }
        return false
    }
}
