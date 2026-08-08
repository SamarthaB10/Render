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

test("reports independent semantic and structural manifest issues together", () => {
  const issues = validateManifest({
    schemaVersion: 1,
    name: "Broken",
    sdkVersion: "0.1.0",
    size: { width: 0, height: 180, hostOnly: true },
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    capabilities: [],
    subscribe: []
  });

  assert.deepEqual(issues, [
    { path: "size.width", message: "must be greater than zero" },
    { path: "size.hostOnly", message: "field is not declared by the WidgetSize contract" }
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
    subscribe: ["spotify.account"],
    accounts: [{
      connector: "spotify",
      scopes: ["user-read-playback-state", "user-modify-playback-state"]
    }]
  };

  assert.deepEqual(validateManifest(manifest), []);
});

test("rejects subscriptions outside the canonical provider contract", () => {
  const issues = validateManifest({
    schemaVersion: 1,
    name: "Unknown Provider",
    sdkVersion: "0.1.0",
    size: { width: 320, height: 180 },
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    capabilities: [],
    subscribe: ["host.private"]
  });

  assert.deepEqual(issues, [{
    path: "subscribe[0]",
    message: "unsupported provider 'host.private'; use render sdk list to choose a host provider"
  }]);
});

test("accepts adjustable bounds and responsive modes", () => {
  const manifest = {
    schemaVersion: 1,
    name: "Adaptive Todo",
    sdkVersion: "0.1.0",
    size: { width: 280, height: 300 },
    anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
    adjustable: {
      enabled: true,
      minSize: { width: 180, height: 180 },
      maxSize: { width: 720, height: 720 },
      responsive: {
        modes: {
          compact: { minWidth: 180, minHeight: 180 },
          regular: { minWidth: 280, minHeight: 300 },
          expanded: { minWidth: 420, minHeight: 420 }
        },
        default: "regular"
      }
    },
    capabilities: [],
    subscribe: []
  };

  assert.deepEqual(validateManifest(manifest), []);
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
