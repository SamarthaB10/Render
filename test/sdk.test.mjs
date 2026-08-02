import assert from "node:assert/strict";
import test from "node:test";

test("SDK exposes a serializable primitive contract", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const tree = sdk.Column([sdk.Text("CPU"), sdk.Gauge(42, 100)], { color: "#1565c0" });

  assert.deepEqual(tree, {
    kind: "column",
    children: [
      { kind: "text", text: "CPU" },
      { kind: "gauge", value: 42, maximum: 100 }
    ],
    style: { color: "#1565c0" }
  });
  assert.deepEqual(sdk.useProvider("system.cpu"), { kind: "provider", name: "system.cpu" });
  assert.deepEqual(sdk.useTimer(1000), { kind: "timer", intervalMs: 1000 });
});
