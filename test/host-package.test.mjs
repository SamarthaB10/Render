import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { selectHostPath } from "../src/runtime.mjs";

test("native host packaging declares the Reminders permission usage description", () => {
  const plist = readFileSync(new URL("../Sources/RenderHost/Info.plist", import.meta.url), "utf8");
  assert.match(plist, /NSRemindersFullAccessUsageDescription/);
  assert.match(plist, /Render uses your Reminders/);
});

test("runtime prefers the packaged host and points agents to the packaging command", () => {
  const runtime = readFileSync(new URL("../src/runtime.mjs", import.meta.url), "utf8");
  assert.match(runtime, /\.build\/debug\/RenderHost\.app\/Contents\/MacOS\/RenderHost/);
  assert.match(runtime, /npm run package:host/);
});

test("runtime selects a newer raw host after swift build over a stale app bundle", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "render-host-selection-"));
  const packaged = path.join(root, "RenderHost.app", "Contents", "MacOS", "RenderHost");
  const raw = path.join(root, "RenderHost");
  try {
    mkdirSync(path.dirname(packaged), { recursive: true });
    writeFileSync(packaged, "packaged");
    writeFileSync(raw, "raw");
    const older = new Date(1_000);
    const newer = new Date(2_000);
    utimesSync(packaged, older, older);
    utimesSync(raw, newer, newer);
    assert.equal(selectHostPath(packaged, raw), raw);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
