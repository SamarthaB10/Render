import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRuntimeTree, prepareRun, runWorkspace } from "../src/runtime.mjs";
import { initWorkspace } from "../src/workspace.mjs";

test("builds a serializable runtime tree from the SDK boundary", () => {
  const source = `
    import { Column, Text, widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1, "name": "Test", "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 180 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [], "subscribe": []
    }, () => Column([Text("Hello")]));
  `;

  assert.deepEqual(buildRuntimeTree(source), {
    kind: "column",
    children: [{ kind: "text", text: "Hello" }]
  });
});

test("prepareRun atomically writes the candidate tree", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-runtime-"));
  try {
    initWorkspace(workspace, "request-init");
    const result = prepareRun(workspace, "request-run");
    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(readFileSync(result.runtimeTreePath, "utf8")), {
      kind: "column",
      children: [
        { kind: "text", text: "Render" },
        { kind: "gauge", value: 0, maximum: 100 }
      ]
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("run reports a missing native host instead of claiming the widget is running", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-runtime-"));
  try {
    initWorkspace(workspace, "request-init");
    const result = runWorkspace(workspace, "request-run", { hostPath: "/nonexistent/RenderHost" });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, "host-not-built");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
