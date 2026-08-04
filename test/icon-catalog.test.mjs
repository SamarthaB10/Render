import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalIconName, SDK_ICON_NAMES } from "../packages/sdk/src/icon-catalog.ts";

test("generated SDK icon catalog matches the pinned native Lucide resource", () => {
  const resource = JSON.parse(readFileSync(new URL("../Sources/RenderHost/LucideResources/catalog.json", import.meta.url)));
  assert.equal(resource.version, "1.26.0");
  assert.equal(SDK_ICON_NAMES.length, 1998);
  assert.deepEqual(Object.keys(resource.icons).sort(), [...SDK_ICON_NAMES]);
  assert.equal(canonicalIconName("play"), "play");
  assert.equal(canonicalIconName("play.fill"), "play");
  assert.equal(canonicalIconName("definitely-not-a-lucide-icon"), null);
});
