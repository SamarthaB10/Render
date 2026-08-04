import assert from "node:assert/strict";
import test from "node:test";
import * as sdk from "../packages/sdk/src/index.ts";
import { describeSdkCatalog } from "../packages/sdk/src/catalog.ts";

test("SDK exposes typed persistent state bindings at supported control seams", () => {
  const completed = sdk.useWidgetState("completed", false);

  assert.deepEqual(completed, {
    kind: "state",
    key: "completed",
    initial: false
  });
  assert.deepEqual(sdk.Text(completed), {
    kind: "text",
    state: { key: "completed", initial: false }
  });
  assert.deepEqual(sdk.Toggle(completed), {
    kind: "toggle",
    value: 0,
    state: { key: "completed", initial: false }
  });
  assert.deepEqual(sdk.TextField(sdk.useWidgetState("draft", "Write here")), {
    kind: "textField",
    text: "",
    state: { key: "draft", initial: "Write here" }
  });
  assert.deepEqual(sdk.Progress(sdk.useWidgetState("progress", 25), 100), {
    kind: "progress",
    value: 0,
    maximum: 100,
    state: { key: "progress", initial: 25 }
  });
});

test("persistent state is discoverable through the SDK catalog", () => {
  const item = describeSdkCatalog("useWidgetState");

  assert.equal(item.status, "implemented");
  assert.match(item.signature, /useWidgetState/);
  assert.match(item.example, /useWidgetState/);
});
