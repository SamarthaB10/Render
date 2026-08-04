import assert from "node:assert/strict";
import test from "node:test";

test("visual SDK constructors produce serializable public shapes", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");

  assert.deepEqual(sdk.Gradient([sdk.Text("CPU")], [
    { color: "#0f172a", position: 0 },
    { color: "#2563eb", position: 1 }
  ], { radius: 8 }), {
    kind: "gradient",
    children: [{ kind: "text", text: "CPU" }],
    stops: [
      { color: "#0f172a", position: 0 },
      { color: "#2563eb", position: 1 }
    ],
    style: { radius: 8 }
  });
  assert.deepEqual(sdk.Texture({ kind: "builtin", name: "grain" }), {
    kind: "texture",
    source: { kind: "builtin", name: "grain" }
  });
  assert.deepEqual(sdk.Clip([sdk.Text("Clipped")]), {
    kind: "clip",
    children: [{ kind: "text", text: "Clipped" }]
  });
  assert.deepEqual(sdk.Transform([sdk.Icon("sparkles")], { rotation: 8, scale: 1.1 }), {
    kind: "transform",
    children: [{ kind: "icon", name: "sparkles" }],
    transform: { rotation: 8, scale: 1.1 }
  });
  assert.deepEqual(sdk.SegmentedProgress(68, 10, 100), {
    kind: "segmentedProgress",
    value: 68,
    segments: 10,
    maximum: 100
  });
  assert.deepEqual(sdk.Spectrum([0.2, 0.8], 1, { color: "#a78bfa" }), {
    kind: "spectrum",
    values: [0.2, 0.8],
    maximum: 1,
    style: { color: "#a78bfa" }
  });
  assert.deepEqual(sdk.Image("avatar", {
    fit: "cover",
    repeat: "none",
    position: "center",
    tint: "#ffffff"
  }), {
    kind: "image",
    source: { kind: "asset", name: "avatar" },
    options: {
      fit: "cover",
      repeat: "none",
      position: "center",
      tint: "#ffffff"
    }
  });

  const animation = {
    property: "opacity",
    from: 0.4,
    to: 1,
    duration: 600,
    delay: 20,
    repeat: "forever",
    easing: "ease-in-out"
  };
  assert.deepEqual(sdk.Animate(sdk.Text("Animated"), animation), {
    kind: "text",
    text: "Animated",
    animation
  });
  assert.doesNotThrow(() => JSON.stringify(sdk.Animate(sdk.Text("Animated"), animation)));
});

test("visual SDK contracts are discoverable with native support notes", async () => {
  const catalog = await import("../packages/sdk/src/catalog.ts");
  const names = ["Gradient", "Texture", "Clip", "Transform", "SegmentedProgress", "Spectrum", "Animate"];

  for (const name of names) {
    const item = catalog.describeSdkCatalog(name);
    assert.ok(item, `${name} must be cataloged`);
    assert.equal(item.importPath, "@render/sdk");
    assert.ok(item.signature.includes("WidgetNode") || name === "Animate");
    assert.ok(item.notes.some((note) => /native/i.test(note)), `${name} needs a native behavior note`);
  }
  assert.equal(catalog.describeSdkCatalog("WidgetAnimation").status, "implemented");
  assert.equal(catalog.describeSdkCatalog("Gradient").status, "implemented");
  assert.equal(catalog.listSdkCatalog().some((item) => item.name === "spotify.media"), false);
});
