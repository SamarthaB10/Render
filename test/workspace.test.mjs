import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkWorkspace, initWorkspace, statusWorkspace } from "../src/workspace.mjs";

test("init creates an isolated workspace that check and status can inspect", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-workspace-"));
  try {
    const initialized = initWorkspace(workspace, "request-init");
    const checked = checkWorkspace(workspace, "request-check");
    const status = statusWorkspace(workspace, "request-status");

    assert.equal(initialized.ok, true);
    assert.equal(checked.ok, true);
    assert.equal(status.state.running, false);
    assert.equal(status.state.activeVersion, null);
    assert.equal(status.state.lastKnownGoodVersion, null);
    assert.equal(existsSync(path.join(workspace, "widget.tsx")), true);
    assert.equal(existsSync(path.join(workspace, ".render", "metadata.json")), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("check rejects imports outside the SDK boundary", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-workspace-"));
  try {
    initWorkspace(workspace, "request-init");
    const widgetPath = path.join(workspace, "widget.tsx");
    const source = `import fs from "node:fs";\n${readWidget(workspace)}`;
    writeFileSync(widgetPath, source);

    const result = checkWorkspace(workspace, "request-check");
    assert.equal(result.ok, false);
    assert.deepEqual(result.diagnostics[0], {
      code: "unsupported-import",
      path: "widget.tsx:1",
      message: "imports must come from @render/sdk"
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

function readWidget(workspace) {
  return readFileSync(path.join(workspace, "widget.tsx"), "utf8");
}
