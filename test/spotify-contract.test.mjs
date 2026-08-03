import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeTree } from "../src/runtime.mjs";

const manifest = `{
  "schemaVersion": 1,
  "name": "Spotify Player",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 180 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": [
    "spotify.account",
    "spotify.track.title",
    "spotify.track.artist",
    "spotify.playback.isPlaying",
    "spotify.playback.progress",
    "spotify.playback.volume"
  ],
  "accounts": [{
    "connector": "spotify",
    "scopes": ["user-read-private", "user-read-playback-state", "user-read-currently-playing", "user-modify-playback-state"]
  }]
}`;

test("Spotify provider and action contracts remain declarative", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const tree = sdk.Column([
    sdk.Text(sdk.useProvider("spotify.track.title")),
    sdk.Text(sdk.useProvider("spotify.track.artist")),
    sdk.Progress(sdk.useProvider("spotify.playback.progress"), 100),
    sdk.Progress(sdk.useProvider("spotify.playback.volume"), 100),
    sdk.Button("Play", { type: "invoke", name: "spotify.play" })
  ]);

  const source = `import { widget } from "@render/sdk"; export default widget(${manifest}, () => (${JSON.stringify(tree)}));`;
  assert.deepEqual(buildRuntimeTree(source), tree);
});

test("Spotify catalog exposes exact first-slice provider and action names", async () => {
  const catalog = await import("../packages/sdk/src/catalog.ts");
  for (const name of [
    "spotify.account",
    "spotify.track.title",
    "spotify.track.artist",
    "spotify.playback.isPlaying",
    "spotify.playback.progress",
    "spotify.playback.volume",
    "spotify.play",
    "spotify.pause",
    "spotify.next",
    "spotify.previous",
    "spotify.set-volume"
  ]) {
    const item = catalog.describeSdkCatalog(name);
    assert.ok(item, `missing catalog item ${name}`);
    assert.equal(item.status, "implemented");
  }
});

test("Spotify runtime contracts require the account declaration and validate volume", async () => {
  const sdk = await import("../packages/sdk/src/index.ts");
  const manifestWithoutAccount = `${manifest.split(',\n  "accounts"')[0]}\n}`;
  const missingAccount = `import { widget, Text, useProvider } from "@render/sdk"; export default widget(${manifestWithoutAccount}, () => Text(useProvider("spotify.track.title")));`;
  assert.throws(() => buildRuntimeTree(missingAccount), /requires a spotify account requirement/);

  const invalidVolume = `import { widget, Button } from "@render/sdk"; export default widget(${manifest}, () => Button("Volume", { type: "set", name: "spotify.set-volume", value: 101 }));`;
  assert.throws(() => buildRuntimeTree(invalidVolume), /requires an integer set value between 0 and 100/);
  assert.equal(typeof sdk.Button, "function");
});
