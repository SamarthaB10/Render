import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RENDER_WIDGET_CONTRACT_VERSION,
  RENDER_WORKER_PROTOCOL_VERSION,
  WIDGET_ACTION_NAMES,
  WIDGET_ACTION_CONNECTORS,
  WIDGET_CAPABILITIES,
  WIDGET_CONNECTOR_SCOPES,
  WIDGET_CONTRACT_CATALOG,
  WIDGET_NODE_KINDS,
  WIDGET_PROVIDER_CONNECTORS,
  WIDGET_PROVIDER_NAMES,
  WIDGET_WORKER_MESSAGE_KINDS
} from "../packages/sdk/src/widget-contract.generated.ts";
import { describeSdkCatalog, listSdkCatalog } from "../packages/sdk/src/catalog.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(readFileSync(path.join(root, "contracts/render-widget-contract.v1.json"), "utf8"));

test("canonical widget contract exposes the generated SDK surface", () => {
  assert.equal(contract.contractVersion, RENDER_WIDGET_CONTRACT_VERSION);
  assert.deepEqual(contract["x-render"].nodeKinds.map((item) => item.name), [...WIDGET_NODE_KINDS]);
  assert.deepEqual(contract["x-render"].capabilities, [...WIDGET_CAPABILITIES]);
  assert.deepEqual(contract["x-render"].providers.map((item) => item.name), [...WIDGET_PROVIDER_NAMES]);
  assert.deepEqual(contract["x-render"].actions.map((item) => item.name), [...WIDGET_ACTION_NAMES]);
  assert.deepEqual(contract["x-render"].connectorScopes, WIDGET_CONNECTOR_SCOPES);
  assert.deepEqual(Object.fromEntries(contract["x-render"].actions.filter((item) => item.connector).map((item) => [item.name, item.connector])), WIDGET_ACTION_CONNECTORS);
  assert.deepEqual(Object.fromEntries(contract["x-render"].providers.filter((item) => item.connector).map((item) => [item.name, item.connector])), WIDGET_PROVIDER_CONNECTORS);
  assert.deepEqual(contract.$defs.WidgetNode.properties.kind.enum, [...WIDGET_NODE_KINDS]);
});

test("canonical widget contract owns the worker protocol discriminators", () => {
  assert.equal(contract["x-render"].workerProtocol.version, RENDER_WORKER_PROTOCOL_VERSION);
  assert.deepEqual(contract["x-render"].workerProtocol.messageKinds, [...WIDGET_WORKER_MESSAGE_KINDS]);
});

test("canonical widget contract owns agent catalog membership", () => {
  const catalog = listSdkCatalog();
  const catalogNames = new Set(WIDGET_CONTRACT_CATALOG.map((item) => item.name));
  for (const item of contract["x-render"].nodeKinds) {
    assert.ok(catalogNames.has(item.sdkName ?? `${item.name[0].toUpperCase()}${item.name.slice(1)}`));
  }
  for (const item of [...contract["x-render"].providers, ...contract["x-render"].actions]) {
    assert.ok(catalogNames.has(item.name));
  }
  for (const name of [...contract["x-render"].connectors, ...contract["x-render"].capabilities]) {
    assert.ok(catalogNames.has(name));
  }
  for (const contractItem of WIDGET_CONTRACT_CATALOG) {
    const item = catalog.find((candidate) => candidate.name === contractItem.name);
    assert.deepEqual(
      { kind: item?.kind, summary: item?.summary, wireName: item?.wireName },
      {
        kind: contractItem.kind,
        summary: contractItem.summary,
        wireName: "wireName" in contractItem ? contractItem.wireName : undefined
      }
    );
  }
});

test("generated TypeScript includes structural manifest and node types", () => {
  const generated = readFileSync(path.join(root, "packages/sdk/src/widget-contract.generated.ts"), "utf8");
  assert.match(generated, /export type WidgetNodeContract =/);
  assert.match(generated, /export type WidgetManifestContract =/);
  assert.match(generated, /children\?: WidgetNodeContract\[\]/);
});

test("agent catalog signatures use canonical provider, connector, and action names", () => {
  const providerUnion = WIDGET_PROVIDER_NAMES.map(JSON.stringify).join(" | ");
  assert.equal(describeSdkCatalog("useProvider").signature, `useProvider(name: ${providerUnion}): ProviderBinding`);
  assert.match(describeSdkCatalog("useAccount").signature, /"spotify" \| "reminders"/);
  const actionSignature = describeSdkCatalog("WidgetAction").signature;
  for (const action of WIDGET_ACTION_NAMES) assert.match(actionSignature, new RegExp(action.replace(".", "\\.")));
});
