import AppKit

public enum DesktopWindowLevel {
    /// The interactive widget layer sits just above Finder's desktop layer.
    public static var interactive: Int {
        Int(CGWindowLevelForKey(.desktopIconWindow)) + 1
    }
}
