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

test("accepts a declarative connector account requirement", () => {
  const manifest = {
    schemaVersion: 1,
    name: "Spotify Mini Player",
    sdkVersion: "0.1.0",
    size: { width: 320, height: 180 },
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    capabilities: [],
    subscribe: ["spotify.playback"],
    accounts: [{
      connector: "spotify",
      scopes: ["user-read-playback-state", "user-modify-playback-state"]
    }]
  };

  assert.deepEqual(validateManifest(manifest), []);
});

test("accepts native surface sizing and shape declarations", () => {
  const manifest = {
    schemaVersion: 1,
    name: "Circular Clock",
    sdkVersion: "0.1.0",
    size: { width: 280, height: 280 },
    resizable: true,
    windowShape: "circle",
    anchor: { corner: "top-right", offset: { x: 24, y: 24 } },
    capabilities: [],
    subscribe: []
  };

  assert.deepEqual(validateManifest(manifest), []);
});

test("reports invalid native surface declarations", () => {
  const issues = validateManifest({
    schemaVersion: 1,
    name: "Broken Surface",
    sdkVersion: "0.1.0",
    size: { width: 320, height: 180 },
    resizable: "yes",
    windowShape: "pill",
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    capabilities: [],
    subscribe: []
  });

  assert.deepEqual(issues, [
    { path: "resizable", message: "must be a boolean" },
    { path: "windowShape", message: "must be \"rectangle\" or \"circle\"" }
  ]);
});

test("requires square design dimensions for circular surfaces", () => {
  const issues = validateManifest({
    schemaVersion: 1,
    name: "Non-square Circle",
    sdkVersion: "0.1.0",
    size: { width: 320, height: 180 },
    windowShape: "circle",
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    capabilities: [],
    subscribe: []
  });

  assert.deepEqual(issues, [
    { path: "size", message: "circle widgets require equal width and height" }
  ]);
});

test("reports unsupported connector and scope requirements", () => {
  const issues = validateManifest({
    schemaVersion: 1,
    name: "Broken Integration",
    sdkVersion: "0.1.0",
    size: { width: 320, height: 180 },
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    capabilities: [],
    subscribe: [],
    accounts: [{ connector: "not-supported", scopes: ["read-anything"] }]
  });

  assert.deepEqual(issues, [
    {
      path: "accounts[0].connector",
      message: "unsupported connector 'not-supported'; use render sdk list to choose a supported connector"
    }
  ]);
});
