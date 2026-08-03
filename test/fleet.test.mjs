import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseOptions } from "../bin/render.mjs";
import { fleetLogs, fleetRelaunch, fleetRun, fleetStatus, fleetStop } from "../src/fleet.mjs";
import { initWorkspace } from "../src/workspace.mjs";

test("fleet CLI options preserve repeated isolated workspaces", () => {
  const options = parseOptions([
    "--workspace", "first",
    "--workspace", "second",
    "--state-path", "fleet.json",
    "--json"
  ], "/tmp/render-cli");

  assert.deepEqual(options.workspaces, ["/tmp/render-cli/first", "/tmp/render-cli/second"]);
  assert.equal(options.statePath, "/tmp/render-cli/fleet.json");
  assert.equal(options.json, true);
});

test("fleet runs and reports multiple independent widget workspaces", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "render-fleet-"));
  const statePath = path.join(root, "fleet.json");
  const first = path.join(root, "first");
  const second = path.join(root, "second");

  try {
    initWorkspace(first, "request-first");
    initWorkspace(second, "request-second");
    writeFileSync(path.join(first, "widget.tsx"), widgetSource("First"));
    writeFileSync(path.join(second, "widget.tsx"), widgetSource("Second"));

    const started = fleetRun([first, second], "request-fleet-run", {
      hostPath: "/bin/echo",
      statePath
    });

    assert.equal(started.ok, true);
    assert.equal(started.widgets.length, 2);
    assert.deepEqual(started.widgets.map((item) => item.workspace), [path.resolve(first), path.resolve(second)]);

    const registry = JSON.parse(readFileSync(statePath, "utf8"));
    assert.deepEqual(registry.widgets.map((item) => item.workspace), [path.resolve(first), path.resolve(second)]);
    assert.equal(typeof registry.widgets[0].logPath, "string");
    assert.equal(registry.widgets[0].status, "running");

    const status = fleetStatus([first, second], "request-fleet-status", { statePath });
    assert.equal(status.ok, true);
    assert.equal(status.widgets.length, 2);
    assert.deepEqual(status.widgets.map((item) => item.workspace), [path.resolve(first), path.resolve(second)]);

    const logs = fleetLogs([first], "request-fleet-logs", { statePath });
    assert.equal(logs.ok, true);
    assert.equal(logs.widgets[0].logPath, registry.widgets[0].logPath);
    assert.equal(logs.widgets[0].exists, true);

    unlinkSync(registry.widgets[0].logPath);
    const missingLogs = fleetLogs([first], "request-fleet-logs-missing", { statePath });
    assert.equal(missingLogs.ok, false);
    assert.equal(missingLogs.widgets[0].diagnostics[0].code, "missing-log-file");

    const stopped = fleetStop([first, second], "request-fleet-stop", { statePath });
    assert.equal(stopped.ok, true);
    assert.equal(stopped.widgets.length, 2);
    assert.equal(fleetStatus([first, second], "request-fleet-status-after-stop", { statePath }).widgets.every((item) => item.state.running === false), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fleet relaunch restores every registered workspace after a stop", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "render-fleet-relaunch-"));
  const statePath = path.join(root, "fleet.json");
  const first = path.join(root, "first");
  const second = path.join(root, "second");

  try {
    initWorkspace(first, "request-first");
    initWorkspace(second, "request-second");
    writeFileSync(path.join(first, "widget.tsx"), widgetSource("First"));
    writeFileSync(path.join(second, "widget.tsx"), widgetSource("Second"));

    fleetRun([first, second], "request-fleet-run", { hostPath: "/bin/echo", statePath });
    fleetStop([first, second], "request-fleet-stop", { statePath });

    const relaunched = fleetRelaunch("request-fleet-relaunch", {
      hostPath: "/bin/echo",
      statePath
    });

    assert.equal(relaunched.ok, true);
    assert.deepEqual(relaunched.widgets.map((item) => item.workspace), [path.resolve(first), path.resolve(second)]);
    assert.equal(relaunched.widgets.every((item) => item.running === true), true);

    const fromRegistry = fleetStatus(undefined, "request-fleet-status-registry", { statePath });
    assert.deepEqual(fromRegistry.widgets.map((item) => item.workspace), [path.resolve(first), path.resolve(second)]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fleet supervisor restarts one crashed widget without replacing another", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "render-fleet-supervisor-"));
  const statePath = path.join(root, "fleet.json");
  const hostPath = path.join(root, "hold-host.sh");
  const first = path.join(root, "first");
  const second = path.join(root, "second");

  try {
    writeFileSync(hostPath, "#!/bin/sh\nexec sleep 30\n");
    chmodSync(hostPath, 0o755);
    initWorkspace(first, "request-first");
    initWorkspace(second, "request-second");
    writeFileSync(path.join(first, "widget.tsx"), widgetSource("First"));
    writeFileSync(path.join(second, "widget.tsx"), widgetSource("Second"));

    const started = fleetRun([first, second], "request-fleet-run", {
      hostPath,
      statePath,
      supervise: true,
      monitorIntervalMs: 25
    });
    const firstProcessID = started.widgets[0].processId;
    const secondProcessID = started.widgets[1].processId;
    assert.equal(started.supervisor.status, "starting");

    process.kill(firstProcessID);
    await waitFor(() => {
      const state = JSON.parse(readFileSync(path.join(first, ".render/metadata.json"), "utf8"));
      return state.running === true && state.processId !== firstProcessID;
    });

    const recovered = fleetStatus([first, second], "request-fleet-status", { statePath });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.widgets[0].state.processId !== firstProcessID, true);
    assert.equal(recovered.widgets[1].state.processId, secondProcessID);
  } finally {
    fleetStop([first, second], "request-fleet-stop", { statePath });
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
  }
});

test("fleet supervisor honors an intentional widget stop without relaunching its sibling", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "render-fleet-intentional-stop-"));
  const statePath = path.join(root, "fleet.json");
  const hostPath = path.join(root, "hold-host.sh");
  const first = path.join(root, "first");
  const second = path.join(root, "second");

  try {
    writeFileSync(hostPath, "#!/bin/sh\nexec sleep 30\n");
    chmodSync(hostPath, 0o755);
    initWorkspace(first, "request-first");
    initWorkspace(second, "request-second");
    writeFileSync(path.join(first, "widget.tsx"), widgetSource("First"));
    writeFileSync(path.join(second, "widget.tsx"), widgetSource("Second"));

    const started = fleetRun([first, second], "request-fleet-run", {
      hostPath,
      statePath,
      supervise: true,
      monitorIntervalMs: 25
    });
    const firstProcessID = started.widgets[0].processId;
    const secondProcessID = started.widgets[1].processId;
    const firstMetadataPath = path.join(first, ".render/metadata.json");
    const firstState = JSON.parse(readFileSync(firstMetadataPath, "utf8"));
    writeFileSync(firstMetadataPath, `${JSON.stringify({
      ...firstState,
      status: "stopped",
      running: false,
      processId: null,
      stopRequested: true
    }, null, 2)}\n`);
    process.kill(firstProcessID);

    await waitFor(() => {
      const registry = JSON.parse(readFileSync(statePath, "utf8"));
      return registry.widgets.find((item) => item.workspace === path.resolve(first))?.running === false;
    });

    const registry = JSON.parse(readFileSync(statePath, "utf8"));
    const sibling = registry.widgets.find((item) => item.workspace === path.resolve(second));
    assert.equal(sibling.running, true);
    assert.equal(sibling.processId, secondProcessID);
    assert.equal(JSON.parse(readFileSync(firstMetadataPath, "utf8")).processId, null);
  } finally {
    fleetStop([first, second], "request-fleet-stop", { statePath });
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
  }
});

async function waitFor(predicate) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("timed out waiting for fleet supervisor recovery");
}

function widgetSource(label) {
  return `import { Text, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "${label}",
  "sdkVersion": "0.1.0",
  "size": { "width": 240, "height": 100 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": []
}, () => Text("${label}"));
`;
}
