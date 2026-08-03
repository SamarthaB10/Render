import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseOptions } from "../bin/render.mjs";
import { fleetRun, fleetStatus, fleetStop } from "../src/fleet.mjs";
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

    const status = fleetStatus([first, second], "request-fleet-status", { statePath });
    assert.equal(status.ok, true);
    assert.equal(status.widgets.length, 2);
    assert.deepEqual(status.widgets.map((item) => item.workspace), [path.resolve(first), path.resolve(second)]);

    const stopped = fleetStop([first, second], "request-fleet-stop", { statePath });
    assert.equal(stopped.ok, true);
    assert.equal(stopped.widgets.length, 2);
    assert.equal(fleetStatus([first, second], "request-fleet-status-after-stop", { statePath }).widgets.every((item) => item.state.running === false), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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
