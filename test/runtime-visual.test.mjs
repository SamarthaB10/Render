import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeTree } from "../src/runtime.mjs";

function sourceFor(render, subscribe = []) {
  return `
    import { widget } from "@render/sdk";
    ${render}
    export default widget({
      "schemaVersion": 1, "name": "Visual test", "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 180 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [], "subscribe": ${JSON.stringify(subscribe)}
    }, render);
  `;
}

test("runtime accepts a valid serializable visual tree", () => {
  const tree = buildRuntimeTree(sourceFor(`
    import {
      Animate, Clip, Gradient, Image, SegmentedProgress, Spectrum, Texture, Text, Transform,
    } from "@render/sdk";
    const render = () => Clip([
      Gradient([
        Texture({ kind: "builtin", name: "grain" }),
        Transform([
          Image({
            source: { kind: "asset", name: "avatar" },
            options: { fit: "cover", repeat: "none", position: "center", tint: "#ffffff" }
          })
        ], { rotation: 4, scale: 1.05, offsetX: 2 }),
        SegmentedProgress(68, 10, 100),
        Spectrum([0.2, 0.8], 1)
      ], [
        { color: "#0f172a", position: 0 },
        { color: "#2563eb", position: 1 }
      ]),
      Animate(Text("Visual"), {
        property: "opacity", from: 0.4, to: 1, duration: 600,
        delay: 20, repeat: 2, easing: "ease-in-out"
      })
    ]);
  `));

  assert.equal(tree.kind, "clip");
  assert.equal(tree.children[0].kind, "gradient");
  assert.equal(tree.children[0].children[0].kind, "texture");
  assert.equal(tree.children[0].children[1].transform.scale, 1.05);
  assert.deepEqual(tree.children[0].children[1].children[0].options, {
    fit: "cover", repeat: "none", position: "center", tint: "#ffffff"
  });
  assert.equal(tree.children[0].children[2].kind, "segmentedProgress");
  assert.equal(tree.children[0].children[3].kind, "spectrum");
  assert.equal(tree.children[1].animation.repeat, 2);
  assert.doesNotThrow(() => JSON.stringify(tree));
});

test("runtime rejects invalid visual fields with actionable paths", () => {
  const cases = [
    [
      "gradient stop position",
      sourceFor(`
        import { Gradient, Text } from "@render/sdk";
        const render = () => Gradient([Text("bad")], [
          { color: "#000", position: 0 }, { color: "#fff", position: 2 }
        ]);
      `),
      /root\.stops\[1\]\.position: gradient stop position must be a finite number between zero and one/
    ],
    [
      "texture source",
      sourceFor(`
        import { Texture } from "@render/sdk";
        const render = () => Texture({ kind: "builtin", name: "noise" });
      `),
      /root\.source\.name: built-in texture name must be grain or grid/
    ],
    [
      "transform scale",
      sourceFor(`
        import { Text, Transform } from "@render/sdk";
        const render = () => Transform([Text("bad")], { scale: 0 });
      `),
      /root\.transform\.scale: transform scale must be a finite number greater than zero/
    ],
    [
      "image options",
      sourceFor(`
        import { Image } from "@render/sdk";
        const render = () => Image("avatar", { fit: "stretch" });
      `),
      /root\.options\.fit: image fit must be contain, cover, or fill/
    ],
    [
      "animation duration",
      sourceFor(`
        import { Animate, Text } from "@render/sdk";
        const render = () => Animate(Text("bad"), { property: "opacity", from: 0, to: 1, duration: 0 });
      `),
      /root\.animation\.duration: animation duration must be a finite number greater than zero/
    ],
    [
      "external image source",
      sourceFor(`
        import { Image } from "@render/sdk";
        const render = () => Image({ kind: "url", url: "https://example.com/image.png" });
      `),
      /root\.source: URL images require the manifest capability "network" and user permission/
    ]
  ];

  for (const [name, source, expected] of cases) {
    assert.throws(() => buildRuntimeTree(source), expected, name);
  }
});
