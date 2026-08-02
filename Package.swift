// swift-tools-version: 5.8
import PackageDescription

let package = Package(
    name: "Render",
    products: [
        .library(name: "RenderHostCore", targets: ["RenderHostCore"]),
        .executable(name: "RenderHost", targets: ["RenderHost"])
    ],
    targets: [
        .target(name: "RenderHostCore"),
        .executableTarget(name: "RenderHost", dependencies: ["RenderHostCore"]),
        .testTarget(name: "RenderHostCoreTests", dependencies: ["RenderHostCore"])
    ]
)
