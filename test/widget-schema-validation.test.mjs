import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateContractDefinition } from "../src/widget-contract.mjs";
import { buildRuntimeTree } from "../src/runtime.mjs";

const compatibilityFixture = JSON.parse(readFileSync(
  new URL("../contracts/fixtures/widget-contract.v1.compatibility.json", import.meta.url),
  "utf8"
));

test("canonical schema validates manifest, visual tree, and worker wire shapes", () => {
  assert.deepEqual(validateContractDefinition("WidgetManifest", compatibilityFixture.artifact.manifest), []);
  assert.deepEqual(validateContractDefinition("WidgetNode", compatibilityFixture.artifact.tree), []);
  for (const message of compatibilityFixture.workerMessages) {
    assert.deepEqual(validateContractDefinition("WorkerMessage", message), []);
  }
});

test("canonical schema reports actionable paths for structural drift", () => {
  assert.deepEqual(
    validateContractDefinition("WidgetNode", { kind: "text", text: "Hello", hostOnly: true }),
    [{ path: "root.hostOnly", message: "field is not declared by the WidgetNode contract" }]
  );
});

test("canonical worker schema enforces kind-specific payloads", () => {
  assert.deepEqual(
    validateContractDefinition("WorkerMessage", {
      protocolVersion: 1,
      kind: "hello",
      messageID: "hello-1",
      workerID: "worker-1"
    }),
    [{ path: "root.supportedVersions", message: "field is required" }]
  );
  assert.deepEqual(
    validateContractDefinition("WorkerMessage", {
      protocolVersion: 1,
      kind: "failure",
      messageID: "failure-1",
      workerID: "worker-1"
    }),
    [{ path: "root.diagnostics", message: "field is required" }]
  );
  assert.deepEqual(
    validateContractDefinition("WorkerMessage", {
      protocolVersion: 1,
      kind: "private",
      messageID: "private-1",
      workerID: "worker-1"
    }),
    [{ path: "root.kind", message: "must be one of \"hello\", \"helloAck\", \"ready\", \"render\", \"failure\", \"shutdown\"" }]
  );
});

test("canonical date-time validation requires an RFC 3339 timestamp", () => {
  assert.deepEqual(
    validateContractDefinition("WidgetNode", { kind: "dateTime", dateTime: "2026-08-03" }),
    [{ path: "root.dateTime", message: "must be an RFC 3339 date-time" }]
  );
  assert.deepEqual(
    validateContractDefinition("WidgetNode", { kind: "dateTime", dateTime: "2026-02-30T12:00:00Z" }),
    [{ path: "root.dateTime", message: "must be an RFC 3339 date-time" }]
  );
  assert.deepEqual(
    validateContractDefinition("WidgetNode", { kind: "dateTime", dateTime: "2026-08-03t14:30:00z" }),
    []
  );
});

test("runtime rejects fields outside the canonical tree contract", () => {
  const source = `
    import { widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1,
      "name": "Drift",
      "sdkVersion": "0.1.0",
      "size": { "width": 240, "height": 120 },
      "anchor": { "corner": "top-left", "offset": { "x": 0, "y": 0 } },
      "capabilities": [],
      "subscribe": []
    }, () => ({ kind: "text", text: "Hello", hostOnly: true }));
  `;

  assert.throws(
    () => buildRuntimeTree(source),
    /root\.hostOnly: field is not declared by the WidgetNode contract/
  );
});

test("runtime rejects manifests outside the canonical provider contract", () => {
  const source = `
    import { widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1,
      "name": "Manifest drift",
      "sdkVersion": "0.1.0",
      "size": { "width": 240, "height": 120 },
      "anchor": { "corner": "top-left", "offset": { "x": 0, "y": 0 } },
      "capabilities": [],
      "subscribe": ["host.private"]
    }, () => ({ kind: "text", text: "Hello" }));
  `;

  assert.throws(
    () => buildRuntimeTree(source),
    /subscribe\[0\]: unsupported provider 'host\.private'/
  );
});
