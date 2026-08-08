import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  PERFORMANCE_SIGNALS,
  PERFORMANCE_WORKLOADS,
  validatePerformanceReceipt
} from "../src/performance-contract.mjs";

test("accepts a complete catalog-backed performance receipt without budgets", () => {
  assert.deepEqual(PERFORMANCE_WORKLOADS.map((workload) => workload.id), [
    "static-widget",
    "interactive-controls",
    "provider-driven-widget",
    "animated-widget",
    "high-frequency-visualizer",
    "multiple-concurrent-widgets",
    "crash-restart",
    "failed-remix"
  ]);

  const receipt = {
    schemaVersion: 2,
    measuredAt: "2026-08-08T15:00:00Z",
    commit: "abc123",
    workload: {
      id: "static-widget",
      fixture: "perf/fixtures/static-widget/widget.tsx"
    },
    settings: {
      sampleCount: 3,
      warmupIntervalMs: 100,
      sampleIntervalMs: 100
    },
    signals: Object.fromEntries(PERFORMANCE_SIGNALS.map((name) => [name, {
      state: "unavailable",
      reason: "not instrumented for this first measurement"
    }]))
  };

  assert.deepEqual(validatePerformanceReceipt(receipt), { ok: true, diagnostics: [] });
});

test("catalog workloads point to checked-in SDK fixture sources", () => {
  for (const workload of PERFORMANCE_WORKLOADS) {
    assert.equal(existsSync(new URL(`../${workload.fixture}`, import.meta.url)), true, workload.id);
  }
});

test("reports missing signal reasons and samples with actionable paths", () => {
  const result = validatePerformanceReceipt({
    schemaVersion: 2,
    measuredAt: "2026-08-08T15:00:00Z",
    commit: "abc123",
    workload: {
      id: "static-widget",
      fixture: "perf/fixtures/static-widget/widget.tsx"
    },
    settings: { sampleCount: 1, warmupIntervalMs: 1, sampleIntervalMs: 1 },
    signals: {
      fullTreeUpdateMs: { state: "available", samples: [1, Number.NaN] },
      ...Object.fromEntries(PERFORMANCE_SIGNALS.slice(1).map((name) => [name, { state: "unavailable" }]))
    }
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics.map(({ path, message }) => ({ path, message })), [
    { path: "signals.fullTreeUpdateMs.samples", message: "must contain only finite numbers" },
    ...PERFORMANCE_SIGNALS.slice(1).map((name) => ({
      path: `signals.${name}.reason`,
      message: "must explain why the signal is unavailable"
    }))
  ]);
});
