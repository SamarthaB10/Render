import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateManifest } from "../src/manifest.mjs";
import { initWorkspace, promoteSnapshot, restoreSnapshot } from "../src/workspace.mjs";

const baseManifest = {
  schemaVersion: 1,
  name: "Asset Widget",
  sdkVersion: "0.1.0",
  size: { width: 320, height: 180 },
  anchor: { corner: "top-left", offset: { x: 0, y: 0 } },
  capabilities: [],
  subscribe: []
};

test("validates declared workspace assets", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-assets-"));
  mkdirSync(path.join(workspace, "assets"));
  writeFileSync(path.join(workspace, "assets", "grain.png"), "placeholder");

  assert.deepEqual(validateManifest({ ...baseManifest, assets: ["grain.png"] }, { workspace }), []);
});

test("rejects missing and escaping workspace assets", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-assets-"));
  mkdirSync(path.join(workspace, "assets"));

  const issues = validateManifest({ ...baseManifest, assets: ["missing.png", "../secret.txt"] }, { workspace });
  assert.match(issues.find((issue) => issue.path === "assets[0]").message, /does not exist/);
  assert.match(issues.find((issue) => issue.path === "assets[1]").message, /inside/);
});

test("rejects workspace assets that symlink outside the asset directory", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-assets-"));
  mkdirSync(path.join(workspace, "assets"));
  const external = path.join(workspace, "outside.txt");
  writeFileSync(external, "outside");
  symlinkSync(external, path.join(workspace, "assets", "linked.txt"));

  const issues = validateManifest({ ...baseManifest, assets: ["linked.txt"] }, { workspace });
  assert.match(issues.find((issue) => issue.path === "assets[0]").message, /symlinks/);
});

test("preserves workspace assets through last-known-good snapshots", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-assets-"));
  initWorkspace(workspace);
  writeFileSync(path.join(workspace, "assets", "grain.png"), "original");
  writeFileSync(path.join(workspace, ".render", "runtime", "tree.json"), "{}\n");
  writeFileSync(path.join(workspace, ".render", "runtime", "manifest.json"), "{}\n");

  const snapshot = promoteSnapshot(workspace);
  writeFileSync(path.join(workspace, "assets", "grain.png"), "candidate");
  writeFileSync(path.join(workspace, "assets", "candidate-only.png"), "candidate");
  restoreSnapshot(workspace, snapshot.version);

  assert.equal(readFileSync(path.join(workspace, "assets", "grain.png"), "utf8"), "original");
  assert.equal(existsSync(path.join(workspace, "assets", "candidate-only.png")), false);
});

test("validates local font declarations against declared assets", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-fonts-"));
  mkdirSync(path.join(workspace, "assets"));
  writeFileSync(path.join(workspace, "assets", "Display.ttf"), "font placeholder");

  assert.deepEqual(validateManifest({
    ...baseManifest,
    assets: ["Display.ttf"],
    fonts: [{ asset: "Display.ttf", family: "Display" }]
  }, { workspace }), []);
});

test("rejects undeclared, unsupported, and duplicate font assets", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-fonts-"));
  mkdirSync(path.join(workspace, "assets"));
  writeFileSync(path.join(workspace, "assets", "Display.woff"), "font placeholder");

  const issues = validateManifest({
    ...baseManifest,
    assets: ["Display.woff"],
    fonts: [{ asset: "Display.woff" }, { asset: "Missing.ttf" }, { asset: "Missing.ttf" }]
  }, { workspace });
  assert.match(issues.find((issue) => issue.path === "fonts[0].asset").message, /ttf or \.otf/);
  assert.match(issues.find((issue) => issue.path === "fonts[1].asset").message, /manifest\.assets/);
  assert.match(issues.findLast((issue) => issue.path === "fonts[2].asset").message, /more than once/);
});
