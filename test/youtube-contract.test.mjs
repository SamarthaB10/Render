import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeTree } from "../src/runtime.mjs";

const manifest = (capabilities = ["network"]) => `{
  "schemaVersion": 1,
  "name": "YouTube Widget",
  "sdkVersion": "0.1.0",
  "size": { "width": 480, "height": 270 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": ${JSON.stringify(capabilities)},
  "subscribe": []
}`;

test("YouTubePlayer creates a validated native player node", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const tree = sdk.YouTubePlayer({ videoId: "M7lc1UVf-VE", controls: true });
  const source = `import { widget } from "@render/sdk"; export default widget(${manifest()}, () => (${JSON.stringify(tree)}));`;

  assert.deepEqual(buildRuntimeTree(source), {
    kind: "youtubePlayer",
    videoId: "M7lc1UVf-VE",
    allowLinkInput: false,
    autoplay: false,
    controls: true,
    style: {
      width: 480,
      height: 270,
      radius: 16,
      border: { color: "#cbd5e1", width: 1, radius: 16 },
      shadow: { color: "#ffffff", radius: 14, opacity: 0.12 },
      tokens: ["surface"]
    }
  });
});

test("YouTubePlayer requires network capability and a video ID", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const tree = sdk.YouTubePlayer("not-a-video-id");
  const missingNetwork = `import { widget } from "@render/sdk"; export default widget(${manifest([])}, () => (${JSON.stringify({ ...tree, videoId: "M7lc1UVf-VE" })}));`;
  assert.throws(() => buildRuntimeTree(missingNetwork), /requires the "network" capability/);

  const invalidID = `import { widget } from "@render/sdk"; export default widget(${manifest()}, () => (${JSON.stringify(tree)}));`;
  assert.throws(() => buildRuntimeTree(invalidID), /requires an 11-character YouTube video ID/);
});

test("YouTubePlayer catalog documents the native and permission contract", async () => {
  const catalog = await import("../packages/sdk/src/catalog.ts");
  const item = catalog.describeSdkCatalog("YouTubePlayer");

  assert.equal(item.status, "implemented");
  assert.match(item.notes.join(" "), /WKWebView/);
  assert.match(item.notes.join(" "), /network capability/);
});
