import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPerformanceReceipt,
  summarizeSamples
} from "../scripts/measure-performance.mjs";
import {
  PERFORMANCE_WORKLOADS,
  validatePerformanceReceipt
} from "../src/performance-contract.mjs";

test("summarizes performance samples with bounded percentiles", () => {
  assert.deepEqual(summarizeSamples([5, 1, 3, 2, 4]), {
    count: 5,
    min: 1,
    p50: 3,
    p95: 5,
    max: 5,
    mean: 3
  });
});

test("returns no summary for an empty sample set", () => {
  assert.equal(summarizeSamples([]), null);
});

test("builds a validated v2 receipt from measured observations", () => {
  const receipt = buildPerformanceReceipt({
    workload: PERFORMANCE_WORKLOADS[0],
    measuredAt: "2026-08-08T15:00:00Z",
    commit: "abc123",
    system: { platform: "test" },
    settings: { sampleCount: 2, warmupIntervalMs: 10, sampleIntervalMs: 20, treeIterations: 3 },
    observations: {
      runtimeTreeBuildMs: [9, 3],
      cpuPercent: [1.5, 2.5],
      residentMemoryKB: [40000, 40100],
      latencyMs: [12],
      wakeups: { state: "unavailable", message: "permission is required" },
      nativePresentationMs: { state: "unavailable", reason: "host acknowledgement is not instrumented" },
      recoveryMs: { state: "unavailable", reason: "recovery adapter is not instrumented" }
    }
  });

  assert.equal(receipt.schemaVersion, 2);
  assert.deepEqual(receipt.signals.fullTreeUpdateMs, {
    state: "unavailable",
    reason: "full-tree update adapter is not instrumented; runtime-tree build samples are recorded separately"
  });
  assert.deepEqual(receipt.signals.cpuPercent, { state: "available", samples: [1.5, 2.5] });
  assert.deepEqual(receipt.signals.latencyMs, { state: "available", samples: [12] });
  assert.deepEqual(receipt.signals.wakeups, { state: "unavailable", reason: "permission is required" });
  assert.deepEqual(validatePerformanceReceipt(receipt), { ok: true, diagnostics: [] });
});
