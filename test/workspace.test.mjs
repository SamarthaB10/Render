import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkWorkspace, initWorkspace, scaffoldWorkspace, statusWorkspace } from "../src/workspace.mjs";
import { extractManifest } from "../src/manifest.mjs";
import { moveWorkspace } from "../src/runtime.mjs";

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

test("scaffold creates the canonical SDK widget for an agent", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-scaffold-"));
  try {
    const scaffolded = scaffoldWorkspace(workspace, "request-scaffold");
    const source = readWidget(workspace);

    assert.equal(scaffolded.ok, true);
    assert.equal(scaffolded.operation, "scaffold");
    assert.match(source, /from "@render\/sdk"/);
    assert.equal(checkWorkspace(workspace).ok, true);
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

test("move updates the logical anchor and promotes a running snapshot", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-move-"));
  try {
    initWorkspace(workspace, "request-init");

    const result = moveWorkspace(
      workspace,
      { corner: "top-right", offsetX: 16, offsetY: 20 },
      "request-move",
      { hostPath: "/bin/echo" }
    );

    assert.equal(result.ok, true);
    assert.equal(result.operation, "move");
    assert.equal(result.running, true);
    assert.deepEqual(extractManifest(readWidget(workspace)).anchor, {
      corner: "top-right",
      offset: { x: 16, y: 20 }
    });
    assert.equal(statusWorkspace(workspace).state.activeVersion, result.activeVersion);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("move rejects unsupported corners without changing the source", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-move-"));
  try {
    initWorkspace(workspace, "request-init");
    const before = readWidget(workspace);

    const result = moveWorkspace(
      workspace,
      { corner: "middle" },
      "request-move"
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.diagnostics, [
      { code: "invalid-move", path: "anchor.corner", message: "must be a supported corner" }
    ]);
    assert.equal(readWidget(workspace), before);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("move restores the source and runtime manifest when the host cannot run", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-move-"));
  try {
    initWorkspace(workspace, "request-init");
    const running = moveWorkspace(
      workspace,
      { corner: "top-left" },
      "request-first-move",
      { hostPath: "/bin/echo" }
    );
    const beforeSource = readWidget(workspace);
    const beforeManifest = readFileSync(path.join(workspace, ".render/runtime/manifest.json"), "utf8");

    const result = moveWorkspace(
      workspace,
      { corner: "bottom-right" },
      "request-failed-move",
      { hostPath: "/nonexistent/RenderHost" }
    );

    assert.equal(running.ok, true);
    assert.equal(result.ok, false);
    assert.equal(readWidget(workspace), beforeSource);
    assert.equal(
      readFileSync(path.join(workspace, ".render/runtime/manifest.json"), "utf8"),
      beforeManifest
    );
    assert.equal(statusWorkspace(workspace).state.activeVersion, running.activeVersion);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("move restores the source when the lifecycle throws unexpectedly", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-move-"));
  try {
    initWorkspace(workspace, "request-init");
    const before = readWidget(workspace);
    writeFileSync(path.join(workspace, ".render/metadata.json"), "{\n");

    const result = moveWorkspace(
      workspace,
      { corner: "top-right" },
      "request-throwing-move",
      { hostPath: "/bin/echo" }
    );

    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, "move-failed");
    assert.equal(readWidget(workspace), before);
    assert.equal(existsSync(path.join(workspace, ".render/runtime/manifest.json")), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

function readWidget(workspace) {
  return readFileSync(path.join(workspace, "widget.tsx"), "utf8");
}
