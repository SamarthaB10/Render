import assert from "node:assert/strict";
import test from "node:test";

import { buildRuntimeTree } from "../src/runtime.mjs";

function sourceFor(render) {
  return `
    import { widget } from "@render/sdk";
    ${render}
    export default widget({
      "schemaVersion": 1,
      "name": "Interaction test",
      "sdkVersion": "0.1.0",
      "size": { "width": 320, "height": 180 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [],
      "subscribe": []
    }, render);
  `;
}

test("interactive primitives keep state and native appearance descriptors serializable", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const level = sdk.useWidgetState("level", 38);

  assert.deepEqual(sdk.Slider({
    value: level,
    minimum: 0,
    maximum: 100,
    step: 1,
    style: {
      backgroundColor: "#1e293b",
      interaction: {
        cursor: "pointer",
        hover: { backgroundColor: "#312e81", opacity: 0.9 },
        pressed: { backgroundColor: "#1e1b4b", scale: 0.98 },
        focus: { borderColor: "#a5b4fc" },
        disabled: { opacity: 0.45 }
      }
    }
  }), {
    kind: "slider",
    value: 38,
    minimum: 0,
    maximum: 100,
    step: 1,
    state: { key: "level", initial: 38 },
    style: {
      backgroundColor: "#1e293b",
      interaction: {
        cursor: "pointer",
        hover: { backgroundColor: "#312e81", opacity: 0.9 },
        pressed: { backgroundColor: "#1e1b4b", scale: 0.98 },
        focus: { borderColor: "#a5b4fc" },
        disabled: { opacity: 0.45 }
      }
    }
  });

  assert.deepEqual(sdk.Button({
    label: sdk.Icon("play"),
    action: { type: "invoke", name: "widget.refresh" },
    disabled: true
  }), {
    kind: "button",
    children: [{ kind: "icon", name: "play" }],
    action: { type: "invoke", name: "widget.refresh" },
    disabled: true
  });

  assert.equal(JSON.stringify(sdk.Slider({ value: level })).includes("function"), false);
});

test("runtime accepts the native interaction contract", () => {
  const tree = buildRuntimeTree(sourceFor(`
    import { Button, Column, Icon, Slider, Text, useWidgetState } from "@render/sdk";
    const level = useWidgetState("level", 38);
    const render = () => Column([
      Button({
        label: Icon({
          name: "play",
          style: { interaction: { pressed: { color: "#b6b6b6" } } }
        }),
        action: { type: "invoke", name: "widget.refresh" },
        style: {
          interaction: {
            cursor: "pointer",
            hover: { backgroundColor: "#262626" },
            pressed: {
              backgroundColor: "#141414",
              opacity: 0.8,
              scale: 0.98,
              borderColor: "#ffffff",
              shadow: { color: "#000000", radius: 4, y: 2, opacity: 0.3, kind: "inset" }
            }
          }
        }
      }),
      Slider({ value: level, minimum: 0, maximum: 100, step: 1 }),
      Text("38%", { font: { tabularNumbers: true } })
    ]);
  `));

  assert.equal(tree.children[0].style.interaction.cursor, "pointer");
  assert.equal(tree.children[0].children[0].style.interaction.pressed.color, "#b6b6b6");
  assert.equal(tree.children[1].kind, "slider");
  assert.equal(tree.children[1].state.key, "level");
});

test("runtime rejects malformed interaction descriptors with actionable paths", () => {
  const cases = [
    [
      "cursor",
      `Button("Bad", { type: "invoke", name: "widget.refresh" }, { interaction: { cursor: "hand" } })`,
      /root\.style\.interaction\.cursor: cursor must be/
    ],
    [
      "pressed opacity",
      `Button("Bad", { type: "invoke", name: "widget.refresh" }, { interaction: { pressed: { opacity: 2 } } })`,
      /root\.style\.interaction\.pressed\.opacity: must be a finite number between zero and one/
    ],
    [
      "slider range",
      `Slider({ value: 4, minimum: 10, maximum: 5 })`,
      /root\.maximum: slider maximum must be greater than minimum/
    ],
    [
      "slider step",
      `Slider({ value: 4, step: 0 })`,
      /root\.step: slider step must be a finite number greater than zero/
    ]
  ];

  for (const [name, expression, expected] of cases) {
    assert.throws(() => buildRuntimeTree(sourceFor(`
      import { Button, Slider } from "@render/sdk";
      const render = () => ${expression};
    `)), expected, name);
  }
});

test("interaction and slider contracts are agent-discoverable", async () => {
  const catalog = await import("../packages/sdk/src/catalog.ts");

  assert.equal(catalog.describeSdkCatalog("Slider").kind, "primitive");
  assert.match(catalog.describeSdkCatalog("Slider").signature, /Slider/);
  assert.equal(catalog.describeSdkCatalog("WidgetInteractionStyle").kind, "style");
  assert.match(catalog.describeSdkCatalog("WidgetInteractionStyle").notes.join(" "), /native/i);
});
