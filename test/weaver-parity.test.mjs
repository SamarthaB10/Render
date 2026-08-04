import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildRuntimeTree } from "../src/runtime.mjs";
import { checkWorkspace } from "../src/workspace.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(repositoryRoot, "examples", "weaver-parity");
const fixturePath = path.join(fixtureRoot, "widget.tsx");

test("Weaver-class fixture passes the complete authoring check", () => {
  const result = checkWorkspace(fixtureRoot, "weaver-parity-check");

  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
  assert.deepEqual(result.diagnostics, []);
});

test("Weaver-class fixture exercises every essential UI parity seam", () => {
  const source = readFileSync(fixturePath, "utf8");
  const tree = buildRuntimeTree(source);
  const serialized = JSON.stringify(tree);

  for (const primitive of ["Slider", "Button", "Icon", "Image", "Texture", "Gradient", "SegmentedProgress"]) {
    assert.match(source, new RegExp(`\\b${primitive}\\b`));
  }
  assert.match(serialized, /GeistPixel-Square/);
  assert.match(serialized, /"interaction"/);
  assert.match(serialized, /"pressed"/);
  assert.match(serialized, /"radius":\{/);
  assert.match(serialized, /"kind":"inset"/);
  assert.match(serialized, /"kind":"outset"/);
  assert.match(serialized, /"kind":"slider"/);
  assert.match(serialized, /"provider":"system.time"/);
  assert.match(serialized, /"state":\{"key":"level","initial":38\}/);
  assert.match(serialized, /"overflow":"hidden"/);
  assert.doesNotMatch(source, /08:42 PM|Text\("38"/);
  assert.doesNotMatch(source, /window\.|document\.|fetch\(|<iframe|<canvas/i);
});
