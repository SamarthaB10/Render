import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRuntimeTree, prepareRun, runWorkspace, watchWorkspace } from "../src/runtime.mjs";
import { initWorkspace, promoteSnapshot, restoreSnapshot, statusWorkspace } from "../src/workspace.mjs";

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

test("rejects provider bindings that are not explicitly subscribed", () => {
  const source = `
    import { Text, useProvider, widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1, "name": "Test", "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 180 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [], "subscribe": []
    }, () => Text(useProvider("system.cpu")));
  `;

  assert.throws(() => buildRuntimeTree(source), /must be listed in manifest.subscribe/);
});

test("accepts the host-owned current-time provider", () => {
  const source = `
    import { Text, useProvider, widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1, "name": "Clock", "sdkVersion": "0.1.0",
      "size": { "width": 240, "height": 100 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [], "subscribe": ["system.time"]
    }, () => Text(useProvider("system.time")));
  `;

  assert.deepEqual(buildRuntimeTree(source), {
    kind: "text",
    provider: "system.time"
  });
});

test("builds host-owned study primitives", () => {
  const source = `
    import { Column, ScrollView, TaskList, TextEditor, Text, Timer, widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1, "name": "Study", "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 420 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [], "subscribe": []
    }, () => Column([
      Timer(1500),
      TaskList([{ id: "read", text: "Read chapter 3" }]),
      ScrollView([TextEditor({ key: "notes", text: "", placeholder: "Write a note…" })], { height: 180 })
    ]));
  `;

  assert.deepEqual(buildRuntimeTree(source), {
    kind: "column",
    children: [
      { kind: "timer", durationSeconds: 1500 },
      { kind: "taskList", tasks: [{ id: "read", text: "Read chapter 3", completed: false }] },
      {
        kind: "scrollView",
        children: [{ kind: "textEditor", key: "notes", text: "", placeholder: "Write a note…" }],
        style: { height: 180 }
      }
    ]
  });
});

test("requires unique sibling keys for persistent state", () => {
  const source = `
    import { Column, TextEditor, widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1, "name": "Duplicate keys", "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 240 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [], "subscribe": []
    }, () => Column([
      TextEditor({ key: "notes", text: "one" }),
      TextEditor({ key: "notes", text: "two" })
    ]));
  `;

  assert.throws(() => buildRuntimeTree(source), /sibling keys must be unique/);
});

test("builds native date-time display and picker primitives", () => {
  const source = `
    import { Column, DateTime, DateTimePicker, widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1, "name": "Dates", "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 180 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [], "subscribe": []
    }, () => Column([
      DateTime({ value: "2026-08-03T14:30:00Z", mode: "date" }),
      DateTimePicker({ key: "deadline", mode: "dateTime" })
    ]));
  `;

  assert.deepEqual(buildRuntimeTree(source), {
    kind: "column",
    children: [
      { kind: "dateTime", dateTime: "2026-08-03T14:30:00Z", dateTimeMode: "date" },
      { kind: "dateTimePicker", dateTimeMode: "dateTime", key: "deadline" }
    ]
  });
});

test("prepareRun atomically writes the candidate tree", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-runtime-"));
  try {
    initWorkspace(workspace, "request-init");
    const result = prepareRun(workspace, "request-run");
    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(readFileSync(result.runtimeManifestPath, "utf8")).subscribe, [
      "system.cpu",
      "system.memory"
    ]);
    assert.deepEqual(JSON.parse(readFileSync(result.runtimeTreePath, "utf8")), {
      kind: "column",
      children: [
        { kind: "text", text: "CPU" },
        { kind: "gauge", provider: "system.cpu", maximum: 100 },
        { kind: "text", text: "Memory" },
        { kind: "gauge", provider: "system.memory", maximum: 100 }
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

test("promotes immutable snapshots and restores an earlier version", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-snapshot-"));
  try {
    initWorkspace(workspace, "request-init");
    prepareRun(workspace, "request-first");
    const first = promoteSnapshot(workspace, "request-first");

    const widgetPath = path.join(workspace, "widget.tsx");
    writeFileSync(widgetPath, readFileSync(widgetPath, "utf8").replace('Text("CPU")', 'Text("Load")'));
    prepareRun(workspace, "request-second");
    const second = promoteSnapshot(workspace, "request-second");

    assert.notEqual(first.version, second.version);
    assert.deepEqual(statusWorkspace(workspace).state.successfulVersions, [first.version, second.version]);
    const restored = restoreSnapshot(workspace, first.version, "request-rollback");
    assert.equal(restored.ok, true);
    assert.equal(statusWorkspace(workspace).state.activeVersion, first.version);
    assert.match(readFileSync(path.join(workspace, ".render/runtime/tree.json"), "utf8"), /CPU/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("failed candidates preserve the active version and record diagnostics", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-snapshot-"));
  try {
    initWorkspace(workspace, "request-init");
    prepareRun(workspace, "request-first");
    const first = promoteSnapshot(workspace, "request-first");
    writeFileSync(path.join(workspace, "widget.tsx"), "export default widget(");

    const result = runWorkspace(workspace, "request-failed", { hostPath: "/nonexistent/RenderHost" });
    const status = statusWorkspace(workspace);
    assert.equal(result.ok, false);
    assert.equal(status.state.activeVersion, first.version);
    assert.equal(status.state.lastKnownGoodVersion, first.version);
    assert.equal(status.state.lastFailure.diagnostics[0].code, "invalid-widget-source");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("watch reloads a valid edit through the lifecycle boundary", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-watch-"));
  let session;
  try {
    initWorkspace(workspace, "request-init");
    const results = [];
    session = watchWorkspace(
      workspace,
      "request-watch",
      (result) => results.push(result),
      { hostPath: "/bin/echo" }
    );
    assert.equal(session.initial.ok, true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    writeFileSync(
      path.join(workspace, "widget.tsx"),
      readFileSync(path.join(workspace, "widget.tsx"), "utf8").replace('Text("CPU")', 'Text("Load")')
    );
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("watch reload timed out")), 3000);
      const poll = setInterval(() => {
        if (results.length > 0) {
          clearTimeout(timeout);
          clearInterval(poll);
          resolve();
        }
      }, 25);
    });
    assert.equal(results[0].ok, true);
  } finally {
    session?.close();
    rmSync(workspace, { recursive: true, force: true });
  }
});
