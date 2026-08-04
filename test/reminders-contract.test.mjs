import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeTree } from "../src/runtime.mjs";

const manifest = `{
  "schemaVersion": 1,
  "name": "Reminders Widget",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 220 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": ["reminders.account", "reminders.items", "reminders.incompleteCount", "reminders.next.title", "reminders.next.dueDate"],
  "accounts": [{ "connector": "reminders", "scopes": ["reminders.read", "reminders.write"] }]
}`;

test("Reminders providers and explicit actions stay inside the SDK boundary", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const tree = sdk.Column([
    sdk.Text(sdk.useProvider("reminders.account")),
    sdk.Text(sdk.useProvider("reminders.incompleteCount")),
    sdk.Text(sdk.useProvider("reminders.next.title")),
    sdk.Text(sdk.useProvider("reminders.next.dueDate")),
    sdk.List(sdk.useProvider("reminders.items")),
    sdk.Button("Add", { type: "invoke", name: "reminders.create", payload: { title: "Review notes" } }),
    sdk.Button("Done", { type: "invoke", name: "reminders.complete", payload: { id: "opaque-id" } }),
    sdk.Button("Delete", { type: "invoke", name: "reminders.delete", payload: { id: "opaque-id" } })
  ]);

  const source = `import { widget } from "@render/sdk"; export default widget(${manifest}, () => (${JSON.stringify(tree)}));`;
  assert.deepEqual(buildRuntimeTree(source), tree);
});

test("List accepts static rows and structured provider rows", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  assert.deepEqual(sdk.List([
    { id: "chapter", title: "Review chapter 3", subtitle: "Today", completed: true }
  ]), {
    kind: "list",
    items: [{ id: "chapter", title: "Review chapter 3", subtitle: "Today", completed: true }]
  });

  const source = `import { widget, List, useProvider } from "@render/sdk"; export default widget(${manifest}, () => List(useProvider("reminders.items")));`;
  assert.deepEqual(buildRuntimeTree(source), { kind: "list", provider: "reminders.items" });
});

test("List rejects malformed static rows with actionable diagnostics", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const tree = sdk.List([
    { id: "duplicate", title: "First" },
    { id: "duplicate", title: "Second" }
  ]);
  const source = `import { widget } from "@render/sdk"; export default widget(${manifest}, () => (${JSON.stringify(tree)}));`;
  assert.throws(() => buildRuntimeTree(source), /root\.items\[1\]\.id: list item ids must be unique/);
});

test("Reminders actions require an account and actionable payloads", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const missingAccount = `import { widget, Button } from "@render/sdk"; export default widget(${manifest.replace(/,\n  "accounts"[\s\S]*?\n}/, "\n}")}, () => Button("Add", { type: "invoke", name: "reminders.create", payload: { title: "Review notes" } }));`;
  assert.throws(() => buildRuntimeTree(missingAccount), /requires a reminders account requirement/);

  const invalidPayload = `import { widget, Button } from "@render/sdk"; export default widget(${manifest}, () => Button("Add", { type: "invoke", name: "reminders.create", payload: {} }));`;
  assert.throws(() => buildRuntimeTree(invalidPayload), /payload.title/);

  const readOnly = manifest.replace('reminders.read", "reminders.write', 'reminders.read');
  const writeWithoutScope = `import { widget, Button } from "@render/sdk"; export default widget(${readOnly}, () => Button("Add", { type: "invoke", name: "reminders.create", payload: { title: "Review notes" } }));`;
  assert.throws(() => buildRuntimeTree(writeWithoutScope), /requires the reminders.write scope/);
  assert.equal(typeof sdk.Button, "function");
});

test("Reminders account scopes are exact and discoverable", async () => {
  const catalog = await import("../packages/sdk/src/catalog.ts");
  const connector = catalog.describeSdkCatalog("reminders");
  assert.equal(connector.status, "implemented");
  assert.deepEqual(connector.inputs, ["reminders.read", "reminders.write"]);
  assert.equal(catalog.describeSdkCatalog("reminders.create").status, "implemented");
});
