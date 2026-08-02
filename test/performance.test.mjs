import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSamples } from "../scripts/measure-performance.mjs";

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
