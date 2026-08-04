import AppKit
import Foundation
import RenderHostCore
import SwiftUI

struct NativeGradientStop {
    let color: String
    let location: Double
}

struct WidgetGradientDescriptor {
    let stops: [NativeGradientStop]
    let direction: String

    init?(tree: WidgetTree) {
        guard let source = tree.gradientStops, !source.isEmpty else { return nil }
        stops = source.enumerated().map { index, stop in
            NativeGradientStop(
                color: stop.color,
                location: stop.position ?? Double(index) / Double(max(source.count - 1, 1))
            )
        }
        direction = tree.gradientDirection ?? "topBottom"
    }
}

enum WidgetTextureKind {
    case grain
    case grid
    case asset(String)
}

struct WidgetTextureDescriptor {
    let kind: WidgetTextureKind

    init?(tree: WidgetTree) {
        guard let source = tree.textureSource else { return nil }
        switch source {
        case .builtIn(let name) where name.lowercased() == "grain": kind = .grain
        case .builtIn(let name) where name.lowercased() == "grid": kind = .grid
        case .asset(let name): kind = .asset(name)
        default: return nil
        }
    }
}

struct WidgetTransformValues {
    let x: CGFloat
    let y: CGFloat
    let scale: CGFloat
    let rotation: Angle

    init(tree: WidgetTree) {
        x = CGFloat(tree.transform?.offsetX ?? 0)
        y = CGFloat(tree.transform?.offsetY ?? 0)
        scale = CGFloat(tree.transform?.scale ?? 1)
        rotation = .degrees(tree.transform?.rotation ?? 0)
    }
}

struct WidgetImageOptions {
    let fit: WidgetImageFit
    let repeatMode: WidgetImageRepeat
    let position: String
    let tint: Color?

    init(tree: WidgetTree, color: (String?) -> Color?) {
        fit = tree.options?.fit ?? tree.imageFit ?? .contain
        repeatMode = tree.options?.repeat ?? tree.imageRepeat ?? .none
        position = tree.options?.position ?? tree.imagePosition ?? "center"
        tint = color(tree.options?.tint ?? tree.tint)
    }
}

struct WidgetNativeAnimation {
    enum RepeatMode {
        case once
        case count(Int)
        case forever
    }

    let property: String
    let from: Double
    let to: Double
    let duration: Double
    let delay: Double
    let repeatMode: RepeatMode
    let easing: String

    init?(tree: WidgetTree) {
        guard let animation = tree.animation, !animation.property.isEmpty, animation.duration > 0 else { return nil }
        let property = animation.property
        let repeatMode: RepeatMode
        switch animation.`repeat` {
        case .forever:
            repeatMode = .forever
        case .count(let count) where count > 0:
            repeatMode = .count(count)
        case .count, nil:
            repeatMode = .once
        }

        self.property = property.lowercased()
        self.from = animation.from
        self.to = animation.to
        self.duration = animation.duration / 1_000
        self.delay = (animation.delay ?? 0) / 1_000
        self.repeatMode = repeatMode
        self.easing = animation.easing?.lowercased().replacingOccurrences(of: "-", with: "") ?? "linear"
    }

    func value(at date: Date, startDate: Date) -> Double {
        let elapsed = date.timeIntervalSince(startDate) - delay
        guard elapsed > 0 else { return from }
        let cycle = elapsed / duration
        let progress: Double
        switch repeatMode {
        case .once:
            progress = min(cycle, 1)
        case .count(let count):
            progress = cycle >= Double(count) ? 1 : cycle - floor(cycle)
        case .forever:
            progress = cycle - floor(cycle)
        }
        let eased: Double
        switch easing {
        case let value where value.contains("easeinout"):
            eased = progress < 0.5 ? 2 * progress * progress : 1 - pow(-2 * progress + 2, 2) / 2
        case let value where value.contains("easein"):
            eased = progress * progress
        case let value where value.contains("easeout"):
            eased = 1 - pow(1 - progress, 2)
        default:
            eased = progress
        }
        return from + (to - from) * eased
    }

}

struct WidgetTexturePattern: View {
    let kind: WidgetTextureKind
    let color: Color

    var body: some View {
        Canvas { context, size in
            switch kind {
            case .grid:
                var path = Path()
                let spacing: CGFloat = 16
                stride(from: 0, through: size.width, by: spacing).forEach { x in
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: size.height))
                }
                stride(from: 0, through: size.height, by: spacing).forEach { y in
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                }
                context.stroke(path, with: .color(color.opacity(0.22)), lineWidth: 1)
            case .grain:
                for index in 0..<180 {
                    let seed = UInt64(index * 1_103 + 97)
                    let x = CGFloat((seed * 2_654_435_761) % 10_000) / 10_000 * size.width
                    let y = CGFloat((seed * 1_597_334_677) % 10_000) / 10_000 * size.height
                    let alpha = 0.06 + Double(seed % 10) / 100
                    context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1.2, height: 1.2)), with: .color(color.opacity(alpha)))
                }
            case .asset:
                break
            }
        }
        .allowsHitTesting(false)
    }
}

struct WidgetSpectrumBars: View {
    let values: [Double]
    let maximum: Double
    let color: Color

    var body: some View {
        GeometryReader { proxy in
            HStack(alignment: .bottom, spacing: 2) {
                ForEach(values.indices, id: \.self) { index in
                    let ratio = min(max(values[index] / maximum, 0), 1)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(color)
                        .frame(height: max(2, proxy.size.height * CGFloat(ratio)))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
        .frame(minHeight: 24)
        .accessibilityLabel("Spectrum")
    }
}

struct WidgetSegmentedProgress: View {
    let value: Double
    let maximum: Double
    let segments: Int
    let color: Color

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<max(segments, 1), id: \.self) { index in
                let progress = min(max((value / maximum) * Double(segments) - Double(index), 0), 1)
                GeometryReader { proxy in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(color.opacity(0.18))
                        .overlay(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(color)
                                .frame(width: proxy.size.width * CGFloat(progress))
                        }
                }
            }
        }
        .frame(height: 8)
        .accessibilityValue("\(Int(value.rounded())) of \(Int(maximum.rounded()))")
    }
}

struct WidgetLinearProgress: View {
    let value: Double
    let maximum: Double
    let color: Color

    var body: some View {
        GeometryReader { proxy in
            let progress = min(max(value / maximum, 0), 1)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.14))
                Capsule()
                    .fill(color)
                    .frame(width: proxy.size.width * CGFloat(progress))
            }
        }
        .frame(minHeight: 6, idealHeight: 8, maxHeight: 12)
        .accessibilityLabel("Progress")
        .accessibilityValue("\(Int(value.rounded())) of \(Int(maximum.rounded()))")
    }
}

struct WidgetRingGauge: View {
    let value: Double
    let maximum: Double
    let color: Color

    var body: some View {
        let progress = min(max(value / maximum, 0), 1)
        ZStack {
            Circle().stroke(Color.white.opacity(0.14), lineWidth: 6)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int((progress * 100).rounded()))%")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .monospacedDigit()
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(minWidth: 36, minHeight: 36)
        .accessibilityLabel("Gauge")
        .accessibilityValue("\(Int(value.rounded())) of \(Int(maximum.rounded()))")
    }
}

struct WidgetRepeatedImage: View {
    let image: NSImage
    let repeatMode: WidgetImageRepeat
    let tint: Color?

    var body: some View {
        Canvas { context, size in
            let resolved = context.resolve(Image(nsImage: image))
            let tileWidth = max(image.size.width, 1)
            let tileHeight = max(image.size.height, 1)
            let horizontal = repeatMode == .x || repeatMode == .both
            let vertical = repeatMode == .y || repeatMode == .both
            let columns = horizontal ? max(Int(ceil(size.width / tileWidth)), 1) : 1
            let rows = vertical ? max(Int(ceil(size.height / tileHeight)), 1) : 1
            for row in 0..<rows {
                for column in 0..<columns {
                    let rect = CGRect(
                        x: horizontal ? CGFloat(column) * tileWidth : (size.width - tileWidth) / 2,
                        y: vertical ? CGFloat(row) * tileHeight : (size.height - tileHeight) / 2,
                        width: tileWidth,
                        height: tileHeight
                    )
                    context.draw(resolved, in: rect)
                }
            }
        }
        .colorMultiply(tint ?? .white)
        .clipped()
    }
}

struct WidgetFittedImage: View {
    let image: NSImage
    let fit: WidgetImageFit
    let alignment: Alignment
    let tint: Color?

    var body: some View {
        GeometryReader { proxy in
            Group {
                switch fit {
                case .contain:
                    if let tint {
                        Image(nsImage: image).resizable().renderingMode(.template).foregroundColor(tint).scaledToFit()
                    } else {
                        Image(nsImage: image).resizable().scaledToFit()
                    }
                case .cover:
                    if let tint {
                        Image(nsImage: image).resizable().renderingMode(.template).foregroundColor(tint).scaledToFill()
                    } else {
                        Image(nsImage: image).resizable().scaledToFill()
                    }
                case .fill:
                    if let tint {
                        Image(nsImage: image).resizable().renderingMode(.template).foregroundColor(tint)
                    } else {
                        Image(nsImage: image).resizable()
                    }
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: alignment)
        }
        .clipped()
    }

}
