import Foundation
import RenderHostCore
import Darwin

final class WorkerSession {
    private let workspace: String
    private let sourcePath: String
    private let workerScript: String
    private let stateURL: URL
    private let runtimeTreeURL: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var process: Process?
    private var input: FileHandle?
    private var output: FileHandle?
    private var restartWorkItem: DispatchWorkItem?
    private var shuttingDown = false
    private var restartCount = 0
    private var resourceTimer: DispatchSourceTimer?
    private var currentStatus = "starting"
    private var currentDiagnostics: [WorkerDiagnostic]?
    private var previousCPUTime: UInt64?
    private var previousSampleTime: UInt64?
    private var lastResourceSample: [String: Any]?
    private var renderMode: String
    private var renderSize: WorkerRenderSize?

    // Receipt: perf/receipts/phase8-worker.json
    private let maxCPUPercent = 200.0
    private let maxResidentMemoryKB: UInt64 = 131_072

    var onTree: ((WidgetTree) -> Void)?
    var onFailure: (([WorkerDiagnostic]) -> Void)?

    init(workspace: String, workerScript: String, sourcePath: String? = nil, statePath: String? = nil, treePath: String? = nil, mode: String = "auto", size: WorkerRenderSize? = nil) {
        self.workspace = workspace
        self.sourcePath = sourcePath ?? URL(fileURLWithPath: workspace).appendingPathComponent("widget.tsx").path
        self.workerScript = workerScript
        self.stateURL = statePath.map(URL.init(fileURLWithPath:))
            ?? URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/worker-state.json")
        self.runtimeTreeURL = treePath.map(URL.init(fileURLWithPath:))
            ?? URL(fileURLWithPath: workspace).appendingPathComponent(".render/runtime/tree.json")
        self.renderMode = mode
        self.renderSize = size
    }

    func start() throws -> WidgetTree {
        shuttingDown = false
        do {
            let tree = try launchAndRender()
            writeTree(tree)
            writeState(status: "ready", diagnostics: nil)
            startResourceSampling()
            return tree
        } catch {
            // A failed candidate must not leave a worker running after the supervisor reports failure.
            stop()
            throw error
        }
    }

    func stop() {
        shuttingDown = true
        restartWorkItem?.cancel()
        restartWorkItem = nil
        resourceTimer?.cancel()
        resourceTimer = nil
        if let input {
            try? send(
                WorkerMessage(kind: .shutdown, messageID: UUID().uuidString)
            )
            try? input.close()
        }
        process?.terminate()
        process = nil
        self.input = nil
        output = nil
    }

    func recordInitialFailure(_ error: Error) {
        writeState(status: "failed", diagnostics: [WorkerDiagnostic(
            code: "worker-start-failed",
            path: "worker",
            message: error.localizedDescription
        )])
    }

    func render(mode: String, size: WorkerRenderSize? = nil, completion: @escaping (Result<WidgetTree, Error>) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }
            do {
                self.renderMode = mode
                self.renderSize = size
                let tree = try self.renderCurrentTree()
                self.writeTree(tree)
                DispatchQueue.main.async { completion(.success(tree)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(error)) }
            }
        }
    }

    private func launchAndRender() throws -> WidgetTree {
        let process = Process()
        let inputPipe = Pipe()
        let outputPipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["node", workerScript]
        process.standardInput = inputPipe
        process.standardOutput = outputPipe
        process.standardError = Pipe()
        process.terminationHandler = { [weak self] terminatedProcess in
            guard let self else { return }
            DispatchQueue.main.async {
                self.workerTerminated(status: terminatedProcess.terminationStatus)
            }
        }
        try process.run()
        self.process = process
        input = inputPipe.fileHandleForWriting
        output = outputPipe.fileHandleForReading

        let hello = try readMessage()
        let helloIssues = hello.validationIssues()
        guard hello.kind == .hello, helloIssues.isEmpty else {
            throw WorkerSessionError.protocolViolation(helloIssues)
        }
        guard hello.supportedVersions?.contains(WorkerMessage.currentProtocolVersion) == true else {
            throw WorkerSessionError.incompatibleVersion
        }
        try send(WorkerMessage(
            kind: .helloAck,
            messageID: UUID().uuidString,
            selectedVersion: WorkerMessage.currentProtocolVersion
        ))

        let ready = try readMessage()
        guard ready.kind == .ready else {
            throw WorkerSessionError.protocolViolation(ready.validationIssues())
        }
        return try renderCurrentTree()
    }

    private func renderCurrentTree() throws -> WidgetTree {
        try send(WorkerMessage(
            kind: .render,
            messageID: UUID().uuidString,
            workspace: workspace,
            sourcePath: sourcePath,
            mode: renderMode,
            size: renderSize
        ))

        let rendered = try readMessage()
        if rendered.kind == .failure {
            throw WorkerSessionError.workerFailure(rendered.diagnostics ?? [])
        }
        guard rendered.kind == .render, let tree = rendered.tree else {
            throw WorkerSessionError.protocolViolation(rendered.validationIssues())
        }
        let treeIssues = tree.validationIssues()
        guard treeIssues.isEmpty else {
            throw WorkerSessionError.invalidTree(treeIssues)
        }
        return tree
    }

    private func send(_ message: WorkerMessage) throws {
        guard let input else { throw WorkerSessionError.notRunning }
        var data = try encoder.encode(message)
        data.append(0x0A)
        try input.write(contentsOf: data)
    }

    private func readMessage() throws -> WorkerMessage {
        guard let output else { throw WorkerSessionError.notRunning }
        var data = Data()
        while true {
            guard let byte = try output.read(upToCount: 1), !byte.isEmpty else {
                throw WorkerSessionError.workerExited
            }
            if byte[byte.startIndex] == 0x0A { break }
            data.append(byte)
        }
        return try decoder.decode(WorkerMessage.self, from: data)
    }

    private func workerTerminated(status: Int32) {
        guard !shuttingDown else { return }
        restartCount += 1
        let diagnostics = (currentDiagnostics ?? []) + [WorkerDiagnostic(
            code: "worker-exited",
            path: "worker",
            message: "worker exited with status \(status); retaining the last-known-good tree"
        )]
        writeState(status: "restarting", diagnostics: diagnostics)
        onFailure?(diagnostics)

        let delay = min(pow(2.0, Double(max(0, restartCount - 1)) - 2.0), 4.0)
        let work = DispatchWorkItem { [weak self] in
            guard let self, !self.shuttingDown else { return }
            do {
                let tree = try self.launchAndRender()
                self.restartCount = 0
                self.writeTree(tree)
                self.writeState(status: "ready", diagnostics: nil)
                self.onTree?(tree)
            } catch {
                let diagnostics = [WorkerDiagnostic(
                    code: "worker-restart-failed",
                    path: "worker",
                    message: error.localizedDescription
                )]
                self.writeState(status: "restarting", diagnostics: diagnostics)
                self.onFailure?(diagnostics)
                self.workerTerminated(status: 1)
            }
        }
        restartWorkItem = work
        DispatchQueue.global().asyncAfter(deadline: .now() + delay, execute: work)
    }

    private func writeState(status: String, diagnostics: [WorkerDiagnostic]?) {
        currentStatus = status
        currentDiagnostics = diagnostics
        var state: [String: Any] = [
            "status": status,
            "protocolVersion": WorkerMessage.currentProtocolVersion,
            "restartCount": restartCount
        ]
        if let process { state["processId"] = process.processIdentifier }
        if let diagnostics {
            state["diagnostics"] = diagnostics.map {
                ["code": $0.code, "path": $0.path, "message": $0.message]
            }
        }
        if let lastResourceSample {
            state["resource"] = lastResourceSample
        }
        guard JSONSerialization.isValidJSONObject(state),
              let data = try? JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted, .sortedKeys])
        else { return }
        try? FileManager.default.createDirectory(
            at: stateURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? data.write(to: stateURL, options: .atomic)
    }

    private func writeTree(_ tree: WidgetTree) {
        guard let data = try? encoder.encode(tree) else { return }
        try? FileManager.default.createDirectory(
            at: runtimeTreeURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? data.write(to: runtimeTreeURL, options: .atomic)
    }

    private func startResourceSampling() {
        resourceTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .utility))
        timer.schedule(deadline: .now() + 1, repeating: 1)
        timer.setEventHandler { [weak self] in
            self?.sampleResources()
        }
        timer.resume()
        resourceTimer = timer
    }

    private func sampleResources() {
        guard let process, process.isRunning else { return }
        var values = rusage_info_v4()
        let result = withUnsafeMutablePointer(to: &values) { pointer in
            pointer.withMemoryRebound(to: rusage_info_t?.self, capacity: 1) {
                proc_pid_rusage(process.processIdentifier, RUSAGE_INFO_V4, $0)
            }
        }
        guard result == 0 else { return }

        let now = DispatchTime.now().uptimeNanoseconds
        let cpuTime = values.ri_user_time + values.ri_system_time
        let cpuPercent: Double
        if let previousCPUTime, let previousSampleTime, now > previousSampleTime {
            cpuPercent = Double(cpuTime - previousCPUTime) / Double(now - previousSampleTime) * 100
        } else {
            cpuPercent = 0
        }
        previousCPUTime = cpuTime
        previousSampleTime = now

        let residentMemoryKB = values.ri_resident_size / 1024
        lastResourceSample = [
            "sampleIntervalMs": 1000,
            "cpuPercent": cpuPercent,
            "residentMemoryKB": residentMemoryKB
        ]
        writeState(status: currentStatus, diagnostics: currentDiagnostics)

        if cpuPercent > maxCPUPercent || residentMemoryKB > maxResidentMemoryKB {
            let diagnostics = [WorkerDiagnostic(
                code: "worker-resource-tripwire",
                path: "worker.resource",
                message: "worker exceeded the measured resource tripwire: cpu=\(cpuPercent)% memory=\(residentMemoryKB)KB limits=(\(maxCPUPercent)%/\(maxResidentMemoryKB)KB)"
            )]
            writeState(status: "tripped", diagnostics: diagnostics)
            onFailure?(diagnostics)
            process.terminate()
        }
    }
}

enum WorkerSessionError: LocalizedError {
    case incompatibleVersion
    case invalidTree([WidgetTreeValidationIssue])
    case notRunning
    case protocolViolation([RuntimeProtocolIssue])
    case workerExited
    case workerFailure([WorkerDiagnostic])

    var errorDescription: String? {
        switch self {
        case .incompatibleVersion:
            return "worker and supervisor have no compatible protocol version"
        case .invalidTree(let issues):
            return issues.map { "\($0.path): \($0.message)" }.joined(separator: "; ")
        case .notRunning:
            return "worker process is not running"
        case .protocolViolation(let issues):
            return issues.isEmpty ? "worker protocol message was invalid" : issues.map { "\($0.path): \($0.message)" }.joined(separator: "; ")
        case .workerExited:
            return "worker exited before returning a message"
        case .workerFailure(let diagnostics):
            return diagnostics.map { "\($0.path): \($0.message)" }.joined(separator: "; ")
        }
    }
}
