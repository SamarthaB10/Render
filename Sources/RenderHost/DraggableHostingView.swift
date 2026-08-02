import AppKit
import SwiftUI

final class DraggableHostingView: NSHostingView<AnyView> {
    var onDrag: ((NSPoint) -> Void)?
    var onDragEnded: (() -> Void)?

    private var dragStartMouseLocation: NSPoint?
    private var dragStartOrigin: NSPoint?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override func mouseDown(with event: NSEvent) {
        dragStartMouseLocation = NSEvent.mouseLocation
        dragStartOrigin = window?.frame.origin
    }

    override func mouseDragged(with event: NSEvent) {
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
        guard dragStartOrigin != nil else { return }
        dragStartMouseLocation = nil
        dragStartOrigin = nil
        onDragEnded?()
    }
}
