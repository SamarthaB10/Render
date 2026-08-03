import assert from "node:assert/strict";
import test from "node:test";

test("Phase 9 primitives produce serializable native nodes", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");

  assert.deepEqual(sdk.Box([sdk.Text("Now playing")], {
    backgroundColor: "#111827",
    padding: 12,
    radius: 8,
    tokens: ["surface.elevated"]
  }), {
    kind: "box",
    children: [{ kind: "text", text: "Now playing" }],
    style: {
      backgroundColor: "#111827",
      padding: 12,
      radius: 8,
      tokens: ["surface.elevated"]
    }
  });
  assert.deepEqual(sdk.Spacer({ size: 8 }), {
    kind: "spacer",
    style: { width: 8, height: 8 }
  });
  assert.deepEqual(sdk.Divider({ orientation: "vertical" }), {
    kind: "divider",
    orientation: "vertical"
  });
  assert.deepEqual(sdk.Icon("play.fill", { color: "#ffffff" }), {
    kind: "icon",
    name: "play.fill",
    style: { color: "#ffffff" }
  });
  assert.deepEqual(sdk.Image({ source: { kind: "asset", name: "album-art" } }), {
    kind: "image",
    source: { kind: "asset", name: "album-art" }
  });
  assert.deepEqual(sdk.Button("Refresh", { type: "invoke", name: "widget.refresh" }), {
    kind: "button",
    children: [{ kind: "text", text: "Refresh" }],
    action: { type: "invoke", name: "widget.refresh" }
  });
  assert.deepEqual(sdk.TextField("Write a task", { color: "#ffffff" }), {
    kind: "textField",
    text: "Write a task",
    style: { color: "#ffffff" }
  });
  assert.deepEqual(sdk.Progress(sdk.useProvider("media.progress"), 100), {
    kind: "progress",
    provider: "media.progress",
    maximum: 100
  });
  assert.deepEqual(sdk.Grid([sdk.Text("A"), sdk.Text("B")], 2, { gap: 8 }), {
    kind: "grid",
    children: [{ kind: "text", text: "A" }, { kind: "text", text: "B" }],
    columns: 2,
    style: { gap: 8 }
  });
});

test("automatic JSX runtime maps components and children to WidgetNode", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const runtime = await import("../packages/sdk/src/jsx-runtime.ts");

  const tree = runtime.jsxs(sdk.Row, {
    children: [
      runtime.jsx(sdk.Icon, { name: "play.fill" }),
      runtime.jsx(sdk.Text, { children: "Play" })
    ],
    style: { gap: 6 }
  }, "controls");

  assert.deepEqual(tree, {
    kind: "row",
    children: [
      { kind: "icon", name: "play.fill" },
      { kind: "text", text: "Play" }
    ],
    style: { gap: 6 },
    key: "controls"
  });
  assert.deepEqual(runtime.jsx(runtime.Fragment, {
    children: [runtime.jsx(sdk.Text, { children: "A" }), "B"]
  }), {
    kind: "box",
    children: [{ kind: "text", text: "A" }, { kind: "text", text: "B" }]
  });
});

test("Phase 9 catalog is exact and exported runtime primitives are discoverable", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const catalog = await import("../packages/sdk/src/catalog.ts");
  const names = catalog.listSdkCatalog().map((item) => item.name);
  const primitives = ["Box", "Spacer", "Divider", "Icon", "Image", "Button", "TextField", "Progress", "Grid"];

  for (const name of primitives) {
    assert.equal(typeof sdk[name], "function", `${name} must be exported`);
    const item = catalog.describeSdkCatalog(name);
    assert.equal(item.kind, "primitive");
    assert.equal(item.importPath, "@render/sdk");
    assert.ok(item.signature.includes("WidgetNode"));
    assert.ok(item.example.length > 0);
    assert.ok(item.notes.some((note) => note.includes("native renderer")));
  }

  assert.deepEqual(names.slice(1, 16), [
    "Column", "Row", "Stack", "Box", "Spacer", "Divider", "Text", "TextField", "Shape", "Icon", "Image", "Button", "Gauge", "Progress", "Grid"
  ]);
  assert.equal(catalog.describeSdkCatalog("WidgetStyle").status, "implemented");
  assert.equal(catalog.describeSdkCatalog("WidgetAction").status, "implemented");
  assert.equal(catalog.describeSdkCatalog("widget.refresh").kind, "action");
  assert.equal(catalog.describeSdkCatalog("ProviderState").signature.includes("loading"), true);
  assert.equal(catalog.describeSdkCatalog("system.time").status, "implemented");
  assert.equal(catalog.describeSdkCatalog("jsx").kind, "function");
});
