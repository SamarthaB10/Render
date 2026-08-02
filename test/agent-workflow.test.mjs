import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repositoryRoot, "bin", "render.mjs");
const hostEnvironment = { RENDER_HOST_PATH: "/bin/echo" };

test("agent can discover, create, run, remix, move, watch, and rollback a widget", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-agent-workflow-"));
  let watcher;
  try {
    const catalog = runCli(["sdk", "list", "--json"]);
    assert.equal(catalog.ok, true);
    assert.ok(catalog.items.some((item) => item.name === "Column"));
    assert.ok(catalog.items.some((item) => item.name === "system.cpu"));

    const initialized = runCli(["init", "--workspace", workspace, "--json"]);
    assert.equal(initialized.ok, true);
    assert.equal(readFileSync(path.join(workspace, "widget.tsx"), "utf8").includes("widget("), true);

    writeFileSync(path.join(workspace, "widget.tsx"), widgetSource("Agent widget"));
    const checked = runCli(["check", "--workspace", workspace, "--json"]);
    assert.equal(checked.ok, true);

    const firstRun = runCli(["run", "--workspace", workspace, "--json"]);
    assert.equal(firstRun.ok, true);
    assert.equal(firstRun.running, true);
    const firstVersion = firstRun.activeVersion;

    writeFileSync(path.join(workspace, "widget.tsx"), widgetSource("Remixed widget"));
    const remix = runCli(["run", "--workspace", workspace, "--json"]);
    assert.equal(remix.ok, true);
    assert.notEqual(remix.activeVersion, firstVersion);

    const moved = runCli([
      "move",
      "--workspace", workspace,
      "--corner", "top-right",
      "--offset-x", "24",
      "--offset-y", "24",
      "--json"
    ]);
    assert.equal(moved.ok, true);
    assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, ".render/runtime/manifest.json"), "utf8")).anchor, {
      corner: "top-right",
      offset: { x: 24, y: 24 }
    });

    watcher = spawn(process.execPath, [cliPath, "run", "--workspace", workspace, "--watch"], {
      cwd: repositoryRoot,
      env: { ...process.env, ...hostEnvironment },
      stdio: ["ignore", "pipe", "pipe"]
    });
    await waitForLine(watcher, (line) => line.startsWith("run ok:"));
    writeFileSync(path.join(workspace, "widget.tsx"), widgetSource("Watched widget"));
    await waitForLine(watcher, (line) => line.startsWith("run ok:"));

    const watchedStatus = runCli(["status", "--workspace", workspace, "--json"]);
    assert.equal(watchedStatus.ok, true);
    const watchedVersion = watchedStatus.state.activeVersion;
    assert.notEqual(watchedVersion, firstVersion);

    writeFileSync(path.join(workspace, "widget.tsx"), "export default widget(");
    const failed = runCli(["run", "--workspace", workspace, "--json"]);
    assert.equal(failed.ok, false);
    assert.equal(failed.diagnostics[0].code, "invalid-widget-source");

    const failedStatus = runCli(["status", "--workspace", workspace, "--json"]);
    assert.equal(failedStatus.state.activeVersion, watchedVersion);
    assert.equal(failedStatus.state.lastKnownGoodVersion, watchedVersion);

    const rollback = runCli([
      "rollback",
      "--workspace", workspace,
      "--version", firstVersion,
      "--json"
    ]);
    assert.equal(rollback.ok, true);
    assert.equal(rollback.version, firstVersion);
    assert.equal(rollback.running, true);
    assert.match(readFileSync(path.join(workspace, "widget.tsx"), "utf8"), /Agent widget/);
  } finally {
    await stopWatcher(watcher);
    rmSync(workspace, { recursive: true, force: true });
  }
});

function widgetSource(label) {
  return `import { Column, Text, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Agent Workflow Fixture",
  "sdkVersion": "0.1.0",
  "size": { "width": 240, "height": 120 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": []
}, () => Column([Text("${label}")]));
`;
}

function runCli(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, ...hostEnvironment },
    encoding: "utf8"
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.notEqual(result.stdout.trim(), "", result.stderr);
  return JSON.parse(result.stdout);
}

function waitForLine(child, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for Render watcher output; received: ${buffer}`));
    }, timeoutMs);

    const onData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      const line = lines.find(predicate);
      if (line !== undefined) {
        cleanup();
        resolve(line);
      }
    };
    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`Render watcher exited before output (code=${code}, signal=${signal})`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.off("exit", onExit);
    };

    child.stdout.on("data", onData);
    child.on("exit", onExit);
  });
}

function stopWatcher(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  });
}
