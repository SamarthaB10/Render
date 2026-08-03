import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RENDER_WIDGET_CONTRACT_VERSION,
  WIDGET_ACTION_NAMES,
  WIDGET_CAPABILITIES,
  WIDGET_CONNECTOR_SCOPES,
  WIDGET_NODE_KINDS,
  WIDGET_PROVIDER_NAMES
} from "../packages/sdk/src/widget-contract.generated.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(readFileSync(path.join(root, "contracts/render-widget-contract.v1.json"), "utf8"));

test("canonical widget contract exposes the generated SDK surface", () => {
  assert.equal(contract.contractVersion, RENDER_WIDGET_CONTRACT_VERSION);
  assert.deepEqual(contract["x-render"].nodeKinds.map((item) => item.name), [...WIDGET_NODE_KINDS]);
  assert.deepEqual(contract["x-render"].capabilities, [...WIDGET_CAPABILITIES]);
  assert.deepEqual(contract["x-render"].providers.map((item) => item.name), [...WIDGET_PROVIDER_NAMES]);
  assert.deepEqual(contract["x-render"].actions.map((item) => item.name), [...WIDGET_ACTION_NAMES]);
  assert.deepEqual(contract["x-render"].connectorScopes, WIDGET_CONNECTOR_SCOPES);
  assert.deepEqual(contract.$defs.WidgetNode.properties.kind.enum, [...WIDGET_NODE_KINDS]);
});
