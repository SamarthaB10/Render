import assert from "node:assert/strict";
import test from "node:test";
import { execute } from "../bin/render.mjs";

test("SDK exposes a serializable primitive contract", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const tree = sdk.Column([sdk.Text("CPU"), sdk.Gauge(42, 100)], { color: "#1565c0" });

  assert.deepEqual(tree, {
    kind: "column",
    children: [
      { kind: "text", text: "CPU" },
      { kind: "gauge", value: 42, maximum: 100 }
    ],
    style: { color: "#1565c0" }
  });
  assert.deepEqual(sdk.useProvider("system.cpu"), { kind: "provider", name: "system.cpu" });
  assert.deepEqual(sdk.useTimer(1000), { kind: "timer", intervalMs: 1000 });
  assert.deepEqual(sdk.Text(sdk.useProvider("system.cpu")), {
    kind: "text",
    provider: "system.cpu"
  });
  assert.deepEqual(sdk.Gauge(sdk.useProvider("system.memory"), 100), {
    kind: "gauge",
    provider: "system.memory",
    maximum: 100
  });
});

test("SDK exposes a versioned runtime protocol contract", async () => {
  const protocol = await import("../packages/sdk/src/protocol.ts");

  assert.equal(protocol.RENDER_PROTOCOL_VERSION, 1);
  assert.deepEqual(protocol.RENDER_PROTOCOL_VERSION, 1);
});

test("SDK catalog exposes canonical primitives, providers, styles, and capabilities", async () => {
  const catalog = await import("../packages/sdk/src/catalog.ts");
  const names = catalog.listSdkCatalog().map((item) => item.name);

  assert.deepEqual(names, [
    "widget",
    "Column",
    "Row",
    "Stack",
    "Text",
    "Shape",
    "Gauge",
    "useProvider",
    "useTimer",
    "WidgetStyle",
    "WidgetNode",
    "WidgetNodeKind",
    "WidgetManifest",
    "WidgetDefinition",
    "ProviderBinding",
    "TimerBinding",
    "system.cpu",
    "system.memory",
    "network",
    "filesystem.read",
    "filesystem.write"
  ]);
  assert.equal(catalog.describeSdkCatalog("Text").kind, "primitive");
  assert.deepEqual(catalog.describeSdkCatalog("WidgetStyle").fields, ["width", "height", "color"]);
});

test("SDK catalog gives agents exact contracts and canonical examples", async () => {
  const catalog = await import("../packages/sdk/src/catalog.ts");
  const text = catalog.describeSdkCatalog("Text");
  const manifest = catalog.describeSdkCatalog("WidgetManifest");

  assert.equal(catalog.SDK_VERSION, "0.1.0");
  assert.equal(text.importPath, "@render/sdk");
  assert.equal(text.signature, "Text(text: string | ProviderBinding, style?: WidgetStyle): WidgetNode");
  assert.match(text.example, /Text\("CPU"\)/);
  assert.deepEqual(manifest.fields, [
    "schemaVersion: 1",
    "name: string",
    "sdkVersion: string",
    "size: { width: number; height: number }",
    'anchor: { corner: "top-left" | "top-right" | "bottom-left" | "bottom-right"; offset: { x: number; y: number } }',
    'capabilities: Array<"network" | "filesystem.read" | "filesystem.write">',
    "subscribe: string[]"
  ]);
  assert.match(catalog.CANONICAL_WIDGET_SOURCE, /from "@render\/sdk"/);
  assert.match(catalog.CANONICAL_WIDGET_SOURCE, /system\.memory/);
});

test("CLI exposes SDK catalog list and describe operations", () => {
  const listed = execute(["sdk", "list"]);
  const described = execute(["sdk", "describe", "system.cpu"]);
  const missing = execute(["sdk", "describe", "unknown"]);

  assert.equal(listed.ok, true);
  assert.equal(listed.operation, "sdk.list");
  assert.equal(listed.items.length, 21);
  assert.equal(listed.sdkVersion, "0.1.0");
  assert.deepEqual(described.item, {
    name: "system.cpu",
    kind: "provider",
    summary: "Host CPU utilization percentage, sampled once per second",
    value: "number | unavailable",
    importPath: "@render/sdk",
    signature: 'useProvider("system.cpu"): ProviderBinding',
    example: 'Gauge(useProvider("system.cpu"), 100)',
    notes: ["Declare \"system.cpu\" in the widget manifest subscribe array."]
  });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.diagnostics[0], {
    code: "unknown-sdk-item",
    path: "name",
    message: "no SDK catalog item named unknown"
  });
});
