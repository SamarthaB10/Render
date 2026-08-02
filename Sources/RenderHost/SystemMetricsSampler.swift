import Darwin
import Foundation
import RenderHostCore

struct SystemMetricsSampler {
    private var previousCPU: CPUCounters?

    mutating func sample(subscriptions: Set<String>) -> ProviderSnapshot {
        var values: [String: ProviderValue] = [:]
        for name in subscriptions {
            switch name {
            case "system.cpu":
                values[name] = sampleCPU()
            case "system.memory":
                values[name] = sampleMemory()
            default:
                values[name] = .unavailable(name: name, message: "provider is not available in this host")
            }
        }
        return ProviderSnapshot(values: values)
    }

    private mutating func sampleCPU() -> ProviderValue {
        var processorCount: natural_t = 0
        var cpuInfo: processor_info_array_t?
        var cpuInfoCount: mach_msg_type_number_t = 0
        let result = host_processor_info(
            mach_host_self(),
            PROCESSOR_CPU_LOAD_INFO,
            &processorCount,
            &cpuInfo,
            &cpuInfoCount
        )

        guard result == KERN_SUCCESS, let cpuInfo else {
            return .unavailable(name: "system.cpu", message: "host CPU counters are unavailable")
        }
        defer {
            let address = vm_address_t(bitPattern: cpuInfo)
            let size = vm_size_t(cpuInfoCount) * vm_size_t(MemoryLayout<integer_t>.stride)
            vm_deallocate(mach_task_self_, address, size)
        }

        let stride = Int(CPU_STATE_MAX)
        var user: UInt64 = 0
        var system: UInt64 = 0
        var nice: UInt64 = 0
        var idle: UInt64 = 0
        for processor in 0..<Int(processorCount) {
            let base = processor * stride
            user += UInt64(cpuInfo[base + Int(CPU_STATE_USER)])
            system += UInt64(cpuInfo[base + Int(CPU_STATE_SYSTEM)])
            nice += UInt64(cpuInfo[base + Int(CPU_STATE_NICE)])
            idle += UInt64(cpuInfo[base + Int(CPU_STATE_IDLE)])
        }

        let current = CPUCounters(total: user + system + nice + idle, idle: idle)
        defer { previousCPU = current }
        guard let previousCPU else {
            return .unavailable(name: "system.cpu", message: "waiting for the next CPU sample")
        }

        let totalDelta = current.total &- previousCPU.total
        let idleDelta = current.idle &- previousCPU.idle
        guard totalDelta > 0, idleDelta <= totalDelta else {
            return .unavailable(name: "system.cpu", message: "CPU counters did not advance")
        }

        let usage = (Double(totalDelta - idleDelta) / Double(totalDelta)) * 100
        return .available(name: "system.cpu", value: min(max(usage, 0), 100))
    }

    private func sampleMemory() -> ProviderValue {
        var statistics = vm_statistics64()
        var count = mach_msg_type_number_t(
            MemoryLayout<vm_statistics64_data_t>.size / MemoryLayout<integer_t>.size
        )
        let result = withUnsafeMutablePointer(to: &statistics) { pointer in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &count)
            }
        }

        guard result == KERN_SUCCESS else {
            return .unavailable(name: "system.memory", message: "host memory counters are unavailable")
        }

        var pageSize: vm_size_t = 0
        guard host_page_size(mach_host_self(), &pageSize) == KERN_SUCCESS else {
            return .unavailable(name: "system.memory", message: "memory page size is unavailable")
        }

        let usedPages = UInt64(statistics.active_count)
            + UInt64(statistics.inactive_count)
            + UInt64(statistics.wire_count)
            + UInt64(statistics.compressor_page_count)
        let usedBytes = usedPages * UInt64(pageSize)
        let totalBytes = ProcessInfo.processInfo.physicalMemory
        guard totalBytes > 0 else {
            return .unavailable(name: "system.memory", message: "physical memory size is unavailable")
        }

        let usage = (Double(usedBytes) / Double(totalBytes)) * 100
        return .available(name: "system.memory", value: min(max(usage, 0), 100))
    }
}

private struct CPUCounters {
    let total: UInt64
    let idle: UInt64
}
