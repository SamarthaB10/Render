import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
