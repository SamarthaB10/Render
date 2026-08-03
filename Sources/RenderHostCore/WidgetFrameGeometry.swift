import Foundation

public enum WidgetFrameGeometry {
    public static func fitScale(designedSize: CGSize, availableSize: CGSize) -> CGFloat {
        guard designedSize.width > 0,
              designedSize.height > 0,
              availableSize.width > 0,
              availableSize.height > 0
        else { return 1 }

        return min(
            availableSize.width / designedSize.width,
            availableSize.height / designedSize.height
        )
    }

    public static func clampedOrigin(origin: CGPoint, size: CGSize, visibleFrame: CGRect) -> CGPoint {
        let maximumX = max(visibleFrame.minX, visibleFrame.maxX - size.width)
        let maximumY = max(visibleFrame.minY, visibleFrame.maxY - size.height)
        return CGPoint(
            x: min(max(origin.x, visibleFrame.minX), maximumX),
            y: min(max(origin.y, visibleFrame.minY), maximumY)
        )
    }
}
