import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeTree } from "../src/runtime.mjs";

test("countdown is a persistent native timer control", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const duration = sdk.useWidgetState("timerSeconds", 1_500);

  assert.deepEqual(sdk.Countdown({
    seconds: duration,
    minimum: 60,
    maximum: 7_200,
    step: 60,
    style: { color: "#ffffff" }
  }), {
    kind: "countdown",
    value: 1_500,
    minimum: 60,
    maximum: 7_200,
    step: 60,
    state: { key: "timerSeconds", initial: 1_500 },
    style: { color: "#ffffff" }
  });

  const catalog = await import("../packages/sdk/src/catalog.ts");
  const item = catalog.describeSdkCatalog("Countdown");
  assert.equal(item.status, "implemented");
  assert.match(item.notes.join(" "), /start, pause, reset/i);
  assert.match(item.notes.join(" "), /one-second schedule/i);
});

test("text fields expose a persistent multiline notes surface", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  assert.deepEqual(sdk.TextField({
    text: sdk.useWidgetState("notes", "Write here"),
    multiline: true,
    style: { height: 140 }
  }), {
    kind: "textField",
    text: "",
    state: { key: "notes", initial: "Write here" },
    multiline: true,
    style: { height: 140 }
  });
});

test("runtime validates countdown ranges and state bindings", () => {
  const source = (seconds, minimum = 60, maximum = 7_200, step = 60) => `
    import { Countdown, useWidgetState, widget } from "@render/sdk";
    export default widget({
      "schemaVersion": 1,
      "name": "Timer",
      "sdkVersion": "0.1.0",
      "size": { "width": 360, "height": 280 },
      "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
      "capabilities": [],
      "subscribe": []
    }, () => Countdown({
      seconds: useWidgetState("timerSeconds", ${seconds}),
      minimum: ${minimum},
      maximum: ${maximum},
      step: ${step}
    }));
  `;

  assert.equal(buildRuntimeTree(source(1_500)).kind, "countdown");
  assert.throws(() => buildRuntimeTree(source(30)), /countdown seconds must be between minimum and maximum/);
  assert.throws(() => buildRuntimeTree(source(1_500, 60, 60)), /countdown maximum must be greater than minimum/);
  assert.throws(() => buildRuntimeTree(source(1_500, 60, 7_200, 0)), /countdown step must be a finite number greater than zero/);
});
