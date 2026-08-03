import assert from "node:assert/strict";
import test from "node:test";
import { parseOptions } from "../bin/render.mjs";

test("render move parses logical anchor options", () => {
  const options = parseOptions([
    "--workspace", "./Widget",
    "--corner", "top-right",
    "--offset-x", "16",
    "--offset-y", "20"
  ], "/tmp/render-repo");

  assert.equal(options.workspace, "/tmp/render-repo/Widget");
  assert.equal(options.corner, "top-right");
  assert.equal(options.offsetX, 16);
  assert.equal(options.offsetY, 20);
});

test("render adjustable operations parse their agent-facing options", () => {
  const options = parseOptions([
    "--workspace", "./Widget",
    "--width", "420",
    "--height", "360",
    "--mode", "compact"
  ], "/tmp/render-repo");

  assert.equal(options.width, 420);
  assert.equal(options.height, 360);
  assert.equal(options.mode, "compact");
});
