import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readPreferences, writePreferences } from "../src/preferences.mjs";

test("widget preferences persist size, mode, and lock state", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "render-preferences-"));
  const renderRoot = path.join(workspace, ".render/runtime");
  mkdirSync(renderRoot, { recursive: true });

  writePreferences(workspace, { width: 420, height: 360, mode: "compact", locked: true });
  assert.deepEqual(readPreferences(workspace), {
    width: 420,
    height: 360,
    mode: "compact",
    locked: true
  });
});
