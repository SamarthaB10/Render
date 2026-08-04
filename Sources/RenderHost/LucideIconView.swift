import SwiftUI

/// Full, pinned Lucide catalog rendered from the SDK-owned bundled font.
/// The glyph mapping and font are generated together, so names do not vary
/// with the host macOS release or its SF Symbols installation.
struct LucideIconView: View {
    let name: String
    let color: Color

    static func supports(_ name: String) -> Bool {
        LucideIconCatalog.codePoint(for: name) != nil
    }

    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            if let scalar = LucideIconCatalog.scalar(for: name) {
                Text(String(scalar))
                    .font(.custom(LucideIconCatalog.fontName, size: size))
                    .foregroundColor(color)
                    .frame(width: size, height: size, alignment: .center)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel(name)
    }
}
