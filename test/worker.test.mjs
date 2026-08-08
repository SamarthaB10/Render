import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import { initWorkspace } from "../src/workspace.mjs";

const workerPath = path.resolve("src/worker.mjs");

test("worker negotiates the protocol and renders a workspace in a separate process", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-worker-"));
  const worker = spawn(process.execPath, [workerPath], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: worker.stdout, crlfDelay: Infinity });
  const messages = readMessages(lines);

  try {
    initWorkspace(workspace, "request-init");
    const hello = await messages.nextMessage();
    assert.equal(hello.kind, "hello");
    assert.deepEqual(hello.supportedVersions, [1]);

    send(worker, { kind: "helloAck", selectedVersion: 1 });
    assert.equal((await messages.nextMessage()).kind, "ready");

    send(worker, {
      kind: "render",
      messageID: "render-1",
      sourcePath: path.join(workspace, "widget.tsx")
    });
    const rendered = await messages.nextMessage();
    assert.equal(rendered.kind, "render");
    assert.equal(rendered.messageID, "render-1");
    assert.equal(rendered.tree.kind, "column");
    assert.equal(rendered.manifest.name, "System Monitor");
  } finally {
    send(worker, { kind: "shutdown" });
    await waitForExit(worker);
    lines.close();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("worker returns actionable diagnostics without replacing the active tree", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-worker-"));
  const worker = spawn(process.execPath, [workerPath], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: worker.stdout, crlfDelay: Infinity });
  const messages = readMessages(lines);

  try {
    initWorkspace(workspace, "request-init");
    writeFileSync(path.join(workspace, "widget.tsx"), "export default widget(");
    await messages.nextMessage();
    send(worker, { kind: "helloAck", selectedVersion: 1 });
    await messages.nextMessage();
    send(worker, {
      kind: "render",
      messageID: "render-invalid",
      sourcePath: path.join(workspace, "widget.tsx")
    });
    const failure = await messages.nextMessage();
    assert.equal(failure.kind, "failure");
    assert.equal(failure.messageID, "render-invalid");
    assert.deepEqual(failure.diagnostics[0].code, "worker-render-failed");
  } finally {
    send(worker, { kind: "shutdown" });
    await waitForExit(worker);
    lines.close();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("worker hydrates persisted widget state before publishing the tree", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-worker-state-"));
  const worker = spawn(process.execPath, [workerPath], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: worker.stdout, crlfDelay: Infinity });
  const messages = readMessages(lines);

  try {
    initWorkspace(workspace, "request-init");
    writeFileSync(path.join(workspace, "widget.tsx"), `
      import { Text, useWidgetState, widget } from "@render/sdk";
      export default widget({
        "schemaVersion": 1,
        "name": "State",
        "sdkVersion": "0.1.0",
        "size": { "width": 240, "height": 120 },
        "anchor": { "corner": "top-left", "offset": { "x": 0, "y": 0 } },
        "capabilities": [],
        "subscribe": []
      }, () => Text(useWidgetState("status", "Ready")));
    `);
    await messages.nextMessage();
    send(worker, { kind: "helloAck", selectedVersion: 1 });
    await messages.nextMessage();
    send(worker, {
      kind: "render",
      messageID: "render-state",
      sourcePath: path.join(workspace, "widget.tsx"),
      state: { status: "Saved" }
    });
    const rendered = await messages.nextMessage();
    assert.equal(rendered.kind, "render");
    assert.equal(rendered.messageID, "render-state");
    assert.equal(rendered.tree.text, "Saved");
    assert.deepEqual(rendered.tree.state, { key: "status", initial: "Ready" });
  } finally {
    send(worker, { kind: "shutdown" });
    await waitForExit(worker);
    lines.close();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("worker rejects an incompatible negotiated protocol version", async () => {
  const worker = spawn(process.execPath, [workerPath], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: worker.stdout, crlfDelay: Infinity });
  const messages = readMessages(lines);

  try {
    await messages.nextMessage();
    send(worker, { kind: "helloAck", selectedVersion: 99 });
    const failure = await messages.nextMessage();
    assert.equal(failure.kind, "failure");
    assert.equal(failure.diagnostics[0].code, "protocol-version-mismatch");
  } finally {
    if (worker.exitCode === null && worker.signalCode === null) worker.kill();
    await waitForExit(worker);
    lines.close();
  }
});

test("worker rejects messages outside the canonical wire schema", async () => {
  const worker = spawn(process.execPath, [workerPath], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: worker.stdout, crlfDelay: Infinity });
  const messages = readMessages(lines);

  try {
    await messages.nextMessage();
    send(worker, { kind: "helloAck", selectedVersion: 1, hostOnly: true });
    const failure = await messages.nextMessage();
    assert.equal(failure.kind, "failure");
    assert.equal(failure.diagnostics[0].code, "invalid-message");
    assert.match(failure.diagnostics[0].message, /root\.hostOnly: field is not declared by the WorkerMessage contract/);
  } finally {
    if (worker.exitCode === null && worker.signalCode === null) worker.kill();
    await waitForExit(worker);
    lines.close();
  }
});

test("worker reports an invalid message ID without crashing", async () => {
  const worker = spawn(process.execPath, [workerPath], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: worker.stdout, crlfDelay: Infinity });
  const messages = readMessages(lines);

  try {
    await messages.nextMessage();
    send(worker, { kind: "helloAck", messageID: 42, selectedVersion: 1 });
    const failure = await messages.nextMessage();
    assert.equal(failure.kind, "failure");
    assert.equal(failure.diagnostics[0].code, "invalid-message");
    send(worker, { kind: "helloAck", selectedVersion: 1 });
    assert.equal((await messages.nextMessage()).kind, "ready");
  } finally {
    send(worker, { kind: "shutdown" });
    await waitForExit(worker);
    lines.close();
  }
});

function readMessages(lines) {
  const pending = [];
  const waiting = [];
  lines.on("line", (line) => {
    const message = JSON.parse(line);
    const resolve = waiting.shift();
    if (resolve) resolve(message);
    else pending.push(message);
  });

  return {
    nextMessage() {
      if (pending.length > 0) return Promise.resolve(pending.shift());
      return new Promise((resolve) => waiting.push(resolve));
    }
  };
}

function send(worker, fields) {
  worker.stdin.write(`${JSON.stringify({
    protocolVersion: 1,
    messageID: "supervisor-message",
    workerID: "supervisor",
    ...fields
  })}\n`);
}

function waitForExit(worker) {
  if (worker.exitCode !== null || worker.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => worker.once("exit", resolve));
}
