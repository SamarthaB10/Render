import assert from "node:assert/strict";
import test from "node:test";
import { extractManifest, validateManifest } from "../src/manifest.mjs";

test("extracts and validates the canonical widget manifest", () => {
  const source = `
    import { widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1,
      "name": "System Monitor",
      "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 180 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [],
      "subscribe": ["system.cpu", "system.memory"]
    }, () => null);
  `;

  const manifest = extractManifest(source);
  assert.deepEqual(validateManifest(manifest), []);
  assert.equal(manifest.name, "System Monitor");
});

test("reports unknown fields and invalid dimensions", () => {
  const issues = validateManifest({
    schemaVersion: 1,
    name: "Broken",
    sdkVersion: "0.1.0",
    size: { width: 0, height: 180 },
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    capabilities: [],
    subscribe: [],
    unexpected: true
  });

  assert.deepEqual(issues, [
    { path: "size.width", message: "must be greater than zero" },
    { path: "unexpected", message: "unknown manifest field" }
  ]);
});
