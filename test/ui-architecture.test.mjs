import assert from "node:assert/strict";
import test from "node:test";
import { validateManifest } from "../src/manifest.mjs";

test("UI architecture exposes semantic themes and native composition patterns", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");

  assert.deepEqual(sdk.GlassPanel([sdk.Text("Now playing")]), {
    kind: "glassPanel",
    children: [{ kind: "text", text: "Now playing" }],
    style: {
      radius: 18,
      material: "thin",
      role: "panel",
      tokens: ["surface.panel", "border.subtle"]
    }
  });
  assert.deepEqual(sdk.MediaCard([sdk.Text("Track")], { density: "compact" }), {
    kind: "mediaCard",
    children: [{ kind: "text", text: "Track" }],
    style: {
      radius: 16,
      material: "thin",
      role: "surface",
      density: "compact"
    }
  });
  assert.deepEqual(sdk.Visualizer({ provider: sdk.useProvider("spotify.playback.isPlaying"), mode: "bars", tempo: 1.2 }), {
    kind: "visualizer",
    provider: "spotify.playback.isPlaying",
    visualizerMode: "bars",
    visualizerTempo: 1.2
  });
  assert.deepEqual(sdk.Artwork({ kind: "asset", name: "album-art" }), {
    kind: "image",
    source: { kind: "asset", name: "album-art" },
    style: {
      width: 64,
      height: 64,
      radius: 12,
      role: "media"
    }
  });
  assert.equal(sdk.TransportControls({}).kind, "row");
  assert.equal(sdk.TransportControls({}).children.length, 4);
});

test("manifest theme declarations accept only known Render themes", async () => {
  const base = {
    schemaVersion: 1,
    name: "Themed Widget",
    sdkVersion: "0.1.0",
    size: { width: 320, height: 180 },
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    capabilities: [],
    subscribe: []
  };

  assert.deepEqual(validateManifest({ ...base, theme: { default: "dark-glass", options: ["dark-glass", "light"] } }), []);
  assert.deepEqual(validateManifest({ ...base, theme: { default: "neon" } }), [
    { path: "theme.default", message: "must be a supported Render theme" }
  ]);
  assert.deepEqual(validateManifest({ ...base, theme: { default: "dark-glass", options: ["dark-glass", "neon"] } }), [
    { path: "theme.options[1]", message: "must be a supported Render theme" }
  ]);
});

test("unsupported semantic styling is reported at check", async () => {
  const { buildRuntimeTree } = await import("../src/runtime.mjs");
  const source = `
    import { widget, Text } from "@render/sdk";
    export default widget({
      "schemaVersion": 1,
      "name": "Invalid Style",
      "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 180 },
      "anchor": { "corner": "top-left", "offset": { "x": 0, "y": 0 } },
      "capabilities": [],
      "subscribe": []
    }, () => Text("Hello", { material: "neon" }));
  `;

  assert.throws(() => buildRuntimeTree(source), /material: unsupported material/);
});
