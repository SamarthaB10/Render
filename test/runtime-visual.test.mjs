import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeTree } from "../src/runtime.mjs";

function sourceFor(render, subscribe = [], assets = []) {
  return `
    import { widget } from "@render/sdk";
    ${render}
    export default widget({
      "schemaVersion": 1, "name": "Visual test", "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 180 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [], "subscribe": ${JSON.stringify(subscribe)}, "assets": ${JSON.stringify(assets)}
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
  `, [], ["avatar"]));

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

test("runtime preserves the expanded serializable style contract", () => {
  const tree = buildRuntimeTree(sourceFor(`
    import { Column, Text } from "@render/sdk";
    const render = () => Column([Text("42", {
      font: {
        size: 14, leading: 18, tracking: 0.2, alignment: "center",
        lineLimit: 2, tabularNumbers: true, truncation: "tail"
      }
    })], {
      width: { unit: "percent", value: 50 },
      height: "auto",
      minWidth: 120,
      maxWidth: { unit: "fraction", value: 2 },
      minHeight: "fit",
      maxHeight: "fill",
      aspectRatio: 1.5,
      padding: { horizontal: 12, vertical: 8, top: 10 },
      margin: { horizontal: -4, bottom: -2 },
      alignSelf: "center",
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: { unit: "fraction", value: 1 },
      flexWrap: "wrap",
      radius: { topLeft: 16, topRight: 8, bottomRight: 4, bottomLeft: 2 },
      shadow: { color: "#000", radius: 4 },
      shadows: [
        { kind: "outset", color: "#000", radius: 8, y: 4, opacity: 0.3 },
        { kind: "inset", radius: 1 },
        { kind: "text", radius: 2, y: 1 }
      ],
      overflow: "clip"
    });
  `));

  assert.deepEqual(tree.style.width, { unit: "percent", value: 50 });
  assert.equal(tree.style.height, "auto");
  assert.deepEqual(tree.style.padding, { horizontal: 12, vertical: 8, top: 10 });
  assert.deepEqual(tree.style.margin, { horizontal: -4, bottom: -2 });
  assert.deepEqual(tree.style.radius, { topLeft: 16, topRight: 8, bottomRight: 4, bottomLeft: 2 });
  assert.equal(tree.style.shadows[1].kind, "inset");
  assert.equal(tree.children[0].style.font.tabularNumbers, true);
  assert.doesNotThrow(() => JSON.stringify(tree));
});

test("runtime gives actionable diagnostics for invalid expanded styles", () => {
  const cases = [
    ["percentage", { width: { unit: "percent", value: 101 } }, /root\.style\.width\.value: percentage length must be at most 100/],
    ["fraction", { flexBasis: { unit: "fraction", value: 0 } }, /root\.style\.flexBasis\.value: relative length must be greater than zero/],
    ["padding", { padding: { horizontal: -1 } }, /root\.style\.padding\.horizontal: spacing must be non-negative/],
    ["corner radius", { radius: { topLeft: -1 } }, /root\.style\.radius\.topLeft: radius must be non-negative/],
    ["line limit", { font: { lineLimit: 1.5 } }, /root\.style\.font\.lineLimit: must be a positive integer/],
    ["shadow kind", { shadows: [{ kind: "glow" }] }, /root\.style\.shadows\[0\]\.kind: must be outset, inset, or text/],
    ["overflow", { overflow: "scroll" }, /root\.style\.overflow: must be visible, hidden, or clip/]
  ];

  for (const [name, style, expected] of cases) {
    const source = sourceFor(`
      import { Text } from "@render/sdk";
      const render = () => Text("bad", ${JSON.stringify(style)});
    `);
    assert.throws(() => buildRuntimeTree(source), expected, name);
  }
});

test("runtime accepts SDK icons and rejects host-dependent symbol names", () => {
  assert.doesNotThrow(() => buildRuntimeTree(sourceFor(`
    import { Icon } from "@render/sdk";
    const render = () => Icon("play.fill");
  `)));
  assert.throws(() => buildRuntimeTree(sourceFor(`
    import { Icon } from "@render/sdk";
    const render = () => Icon("host-only-symbol");
  `)), /unknown SDK icon 'host-only-symbol'/);
});
