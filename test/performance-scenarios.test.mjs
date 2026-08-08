import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { measureFailedRemix } from "../src/performance-scenarios.mjs";

test("failed-remix adapter measures candidate failure and restores the source", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-failed-remix-"));
  const sourcePath = path.join(workspace, "widget.tsx");
  const lastKnownGoodSource = "export default widget('good');\n";
  const candidateSource = "export default widget('broken');\n";
  writeFileSync(sourcePath, lastKnownGoodSource, "utf8");
  const calls = [];

  try {
    const result = measureFailedRemix({
      workspace,
      candidateSource,
      activeVersion: "snapshot-1",
      runCandidate: () => {
        calls.push({ operation: "run", source: readFileSync(sourcePath, "utf8") });
        return { ok: false, diagnostics: [{ code: "invalid-widget-source" }] };
      },
      restoreActive: (version) => {
        calls.push({ operation: "restore", version });
        writeFileSync(sourcePath, lastKnownGoodSource, "utf8");
        return { ok: true, version };
      },
      verifyRestored: (restored) => {
        assert.equal(restored.version, "snapshot-1");
        return { ok: true };
      }
    });

    assert.equal(result.state, "available");
    assert.equal(result.samples.length, 1);
    assert.equal(Number.isFinite(result.samples[0]), true);
    assert.deepEqual(calls, [
      { operation: "run", source: candidateSource },
      { operation: "restore", version: "snapshot-1" }
    ]);
    assert.equal(existsSync(sourcePath), true);
    assert.equal(readFileSync(sourcePath, "utf8"), lastKnownGoodSource);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("failed-remix adapter does not turn infrastructure errors into recovery measurements", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-failed-remix-error-"));
  try {
    writeFileSync(path.join(workspace, "widget.tsx"), "good", "utf8");
    const result = measureFailedRemix({
      workspace,
      candidateSource: "broken",
      activeVersion: "snapshot-1",
      runCandidate: () => ({
        ok: false,
        diagnostics: [
          { code: "invalid-widget-source", message: "candidate is invalid" },
          { code: "host-not-built", message: "host unavailable" }
        ]
      }),
      restoreActive: () => ({ ok: true }),
      verifyRestored: () => ({ ok: true })
    });

    assert.equal(result.state, "unavailable");
    assert.match(result.reason, /host unavailable/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
