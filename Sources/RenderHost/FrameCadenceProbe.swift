import CoreVideo
import Foundation

struct FrameCadenceResult: Codable {
    let state: String
    let durationMs: Double
    let frameCount: Int
    let hertz: Double?
    let message: String?
}

struct FrameCadenceProbe {
    func measure(duration: TimeInterval = 1.0) -> FrameCadenceResult {
        var displayLink: CVDisplayLink?
        guard CVDisplayLinkCreateWithActiveCGDisplays(&displayLink) == kCVReturnSuccess,
              let displayLink else {
            return FrameCadenceResult(
                state: "unavailable",
                durationMs: duration * 1_000,
                frameCount: 0,
                hertz: nil,
                message: "Core Video could not create a display link"
            )
        }

        let counter = FrameCounter()
        let context = Unmanaged.passRetained(counter)
        let callback: CVDisplayLinkOutputCallback = { _, _, _, _, _, context in
            guard let context else { return kCVReturnSuccess }
            Unmanaged<FrameCounter>.fromOpaque(context).takeUnretainedValue().increment()
            return kCVReturnSuccess
        }

        let callbackResult = CVDisplayLinkSetOutputCallback(displayLink, callback, context.toOpaque())
        guard callbackResult == kCVReturnSuccess else {
            context.release()
            return FrameCadenceResult(
                state: "unavailable",
                durationMs: duration * 1_000,
                frameCount: 0,
                hertz: nil,
                message: "Core Video could not attach a display-link callback"
            )
        }

        let start = ContinuousClock.now
        let startResult = CVDisplayLinkStart(displayLink)
        if startResult == kCVReturnSuccess {
            Thread.sleep(forTimeInterval: duration)
            CVDisplayLinkStop(displayLink)
        }
        CVDisplayLinkSetOutputCallback(displayLink, nil, nil)
        let elapsed = start.duration(to: .now)
        context.release()

        guard startResult == kCVReturnSuccess else {
            return FrameCadenceResult(
                state: "unavailable",
                durationMs: milliseconds(elapsed),
                frameCount: 0,
                hertz: nil,
                message: "Core Video could not start the display link"
            )
        }

        let frameCount = counter.value
        let durationMs = milliseconds(elapsed)
        return FrameCadenceResult(
            state: "available",
            durationMs: durationMs,
            frameCount: frameCount,
            hertz: durationMs > 0 ? Double(frameCount) / (durationMs / 1_000) : nil,
            message: "display-link callback cadence; widget render-pass cadence is not instrumented"
        )
    }

    private func milliseconds(_ duration: Duration) -> Double {
        let components = duration.components
        return Double(components.seconds) * 1_000
            + Double(components.attoseconds) / 1_000_000_000_000_000
    }
}

private final class FrameCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0

    var value: Int {
        lock.lock()
        defer { lock.unlock() }
        return count
    }

    func increment() {
        lock.lock()
        count += 1
        lock.unlock()
    }
}
