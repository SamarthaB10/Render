import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readLifecycleReceipts } from "../src/lifecycle.mjs";
import { prepareRun } from "../src/runtime.mjs";
import { initWorkspace, promoteSnapshot, recordFailure } from "../src/workspace.mjs";

test("lifecycle receipts explain promotion and quarantine while preserving last-known-good", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-lifecycle-"));
  try {
    initWorkspace(workspace, "request-init");
    prepareRun(workspace, "request-check");
    const promoted = promoteSnapshot(workspace, "request-promote");
    const failed = recordFailure(workspace, [{ code: "invalid-widget-source", path: "widget.tsx", message: "candidate failed" }], "request-failed");
    const receipts = readLifecycleReceipts(workspace);

    assert.equal(promoted.state.lifecycleState, "candidate");
    assert.equal(failed.lifecycleState, "quarantined");
    assert.equal(failed.lastKnownGoodVersion, promoted.version);
    assert.deepEqual(receipts.map((receipt) => receipt.event), [
      "workspace.created",
      "snapshot.promoted",
      "candidate.failed"
    ]);
    assert.equal(receipts.at(-1).from, "candidate");
    assert.equal(receipts.at(-1).to, "quarantined");
    assert.equal(receipts.at(-1).requestId, "request-failed");
    assert.equal(receipts.at(-1).lastKnownGoodVersion, promoted.version);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
