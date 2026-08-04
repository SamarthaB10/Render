import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeTree } from "../src/runtime.mjs";

const source = `
  import { Column, Progress, Text, TextField, Toggle, useWidgetState, widget } from "@render/sdk";
  const render = () => {
    const title = useWidgetState("title", "Untitled");
    const draft = useWidgetState("draft", "Write here");
    const completed = useWidgetState("completed", false);
    const progress = useWidgetState("progress", 25);
    return Column([
      Text(title),
      TextField(draft),
      Toggle(completed),
      Progress(progress, 100)
    ]);
  };
  export default widget({
    "schemaVersion": 1, "name": "State test", "sdkVersion": "0.1.0",
    "size": { "width": 320, "height": 180 },
    "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
    "capabilities": [], "subscribe": []
  }, render);
`;

test("runtime uses initial widget state when no persisted snapshot exists", () => {
  const tree = buildRuntimeTree(source);

  assert.equal(tree.children[0].text, "Untitled");
  assert.equal(tree.children[1].text, "Write here");
  assert.equal(tree.children[2].value, 0);
  assert.equal(tree.children[3].value, 25);
  assert.deepEqual(tree.children[2].state, { key: "completed", initial: false });
});

test("runtime materializes persisted widget state without changing the source contract", () => {
  const tree = buildRuntimeTree(source, "widget.tsx", {
    state: {
      title: "Saved title",
      draft: "Saved draft",
      completed: true,
      progress: 75
    }
  });

  assert.equal(tree.children[0].text, "Saved title");
  assert.equal(tree.children[1].text, "Saved draft");
  assert.equal(tree.children[2].value, 1);
  assert.equal(tree.children[3].value, 75);
  assert.deepEqual(tree.children[3].state, { key: "progress", initial: 25 });
});

test("runtime rejects invalid state keys and ignores stale persisted values", () => {
  const invalidKey = source.replace('useWidgetState("title", "Untitled")', 'useWidgetState("", "Untitled")');
  assert.throws(() => buildRuntimeTree(invalidKey), /root\.children\[0\]\.state\.key: state keys must be non-empty/);

  const invalidInitial = source.replace('useWidgetState("progress", 25)', 'useWidgetState("progress", 150)');
  assert.throws(
    () => buildRuntimeTree(invalidInitial),
    /root\.children\[3\]\.state\.initial: progress state must be between zero and maximum/
  );

  const staleType = buildRuntimeTree(source, "widget.tsx", { state: { progress: "not a number" } });
  assert.equal(staleType.children[3].value, 25);

  const staleRange = buildRuntimeTree(source, "widget.tsx", { state: { progress: 150 } });
  assert.equal(staleRange.children[3].value, 25);
});
