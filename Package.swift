// swift-tools-version: 5.8
import PackageDescription

let package = Package(
    name: "Render",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "RenderHostCore", targets: ["RenderHostCore"]),
        .executable(name: "RenderHost", targets: ["RenderHost"])
    ],
    targets: [
        .target(name: "RenderHostCore"),
        .executableTarget(
            name: "RenderHost",
            dependencies: ["RenderHostCore"],
            resources: [.copy("LUCIDE-LICENSE.txt")]
        ),
        .testTarget(name: "RenderHostCoreTests", dependencies: ["RenderHostCore"])
    ]
)
