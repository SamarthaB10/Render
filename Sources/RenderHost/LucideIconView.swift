import SwiftUI

/// A small native subset of the Lucide/Feather-style names used by the visual
/// reference widget. The catalog can grow without introducing an icon font or
/// browser SVG runtime.
struct LucideIconView: View {
    let name: String
    let color: Color

    static func supports(_ name: String) -> Bool {
        ["play", "pause", "skip-forward", "skip-back", "sparkles"].contains(name)
    }

    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            Path { path in
                draw(path: &path, size: size)
            }
            .stroke(color, style: StrokeStyle(lineWidth: max(size * 0.1, 1), lineCap: .round, lineJoin: .round))
            .frame(width: size, height: size)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel(name)
    }

    private func draw(path: inout Path, size: CGFloat) {
        let inset = size * 0.16
        let left = inset
        let right = size - inset
        let top = inset
        let bottom = size - inset
        let center = size / 2

        switch name {
        case "play":
            path.move(to: CGPoint(x: left + size * 0.06, y: top))
            path.addLine(to: CGPoint(x: right, y: center))
            path.addLine(to: CGPoint(x: left + size * 0.06, y: bottom))
            path.closeSubpath()
        case "pause":
            path.move(to: CGPoint(x: left + size * 0.18, y: top))
            path.addLine(to: CGPoint(x: left + size * 0.18, y: bottom))
            path.move(to: CGPoint(x: right - size * 0.18, y: top))
            path.addLine(to: CGPoint(x: right - size * 0.18, y: bottom))
        case "skip-forward":
            path.move(to: CGPoint(x: left, y: top))
            path.addLine(to: CGPoint(x: right - size * 0.24, y: center))
            path.addLine(to: CGPoint(x: left, y: bottom))
            path.closeSubpath()
            path.move(to: CGPoint(x: right, y: top))
            path.addLine(to: CGPoint(x: right, y: bottom))
        case "skip-back":
            path.move(to: CGPoint(x: right, y: top))
            path.addLine(to: CGPoint(x: left + size * 0.24, y: center))
            path.addLine(to: CGPoint(x: right, y: bottom))
            path.closeSubpath()
            path.move(to: CGPoint(x: left, y: top))
            path.addLine(to: CGPoint(x: left, y: bottom))
        case "sparkles":
            path.move(to: CGPoint(x: center, y: top))
            path.addLine(to: CGPoint(x: center, y: bottom))
            path.move(to: CGPoint(x: left, y: center))
            path.addLine(to: CGPoint(x: right, y: center))
            path.move(to: CGPoint(x: size * 0.76, y: size * 0.12))
            path.addLine(to: CGPoint(x: size * 0.76, y: size * 0.36))
            path.move(to: CGPoint(x: size * 0.64, y: size * 0.24))
            path.addLine(to: CGPoint(x: size * 0.88, y: size * 0.24))
        default:
            break
        }
    }
}
