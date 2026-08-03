import assert from "node:assert/strict";
import test from "node:test";
import * as sdk from "../packages/sdk/src/index.ts";
import {
  TsxRuntimeError,
  buildTsxRuntimeTree,
  transpileTsx
} from "../src/tsx-runtime.mjs";
import { buildRuntimeTree } from "../src/runtime.mjs";

const manifest = `{
  "schemaVersion": 1,
  "name": "TSX test",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 180 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": []
}`;

test("transpiles and executes a native JSX widget", () => {
  const tree = buildTsxRuntimeTree(`
    import { Column, Text, widget } from "@render/sdk";
    export default widget(${manifest}, () => (
      <Column style={{ color: "#1565c0" }}>
        <Text key="title">Hello from JSX</Text>
      </Column>
    ));
  `, { sdk });

  assert.deepEqual(tree, {
    kind: "column",
    children: [{ kind: "text", text: "Hello from JSX", key: "title" }],
    style: { color: "#1565c0" }
  });
  assert.equal(JSON.stringify(tree).includes("document"), false);
});

test("supports fragments by flattening them into a native container", () => {
  const tree = buildTsxRuntimeTree(`
    import { Column, Text, widget } from "@render/sdk";
    export default widget(${manifest}, () => <>
      <Text>A</Text>
      <Text>B</Text>
    </>);
  `, { sdk });

  assert.deepEqual(tree, {
    kind: "box",
    children: [{ kind: "text", text: "A" }, { kind: "text", text: "B" }]
  });
});

test("passes the active responsive mode through the render context", () => {
  const adaptiveManifest = manifest.slice(0, -1) + ', "adjustable": { "enabled": true, "responsive": { "modes": { "compact": { "minWidth": 180, "minHeight": 180 }, "regular": { "minWidth": 280, "minHeight": 300 } }, "default": "regular" } } }';
  const tree = buildTsxRuntimeTree(`
    import { Text, widget } from "@render/sdk";
    export default widget(${adaptiveManifest}, ({ mode }) => <Text>{mode}</Text>);
  `, { sdk, renderContext: { mode: "compact" } });

  assert.deepEqual(tree, { kind: "text", text: "compact" });
});

test("preserves call-style widget sources", () => {
  const tree = buildTsxRuntimeTree(`
    import { Column, Text, widget } from "@render/sdk";
    export default widget(${manifest}, () => Column([Text("Call style")]));
  `, { sdk });

  assert.deepEqual(tree, {
    kind: "column",
    children: [{ kind: "text", text: "Call style" }]
  });
});

test("reports browser JSX and APIs with actionable diagnostics", () => {
  assert.throws(
    () => transpileTsx(`
      import { widget } from "@render/sdk";
      const title = document.title;
      export default widget(${manifest}, () => <div>{title}</div>);
    `),
    (error) => {
      assert.ok(error instanceof TsxRuntimeError);
      assert.equal(error.code, "unsupported-browser-construct");
      assert.match(error.message, /Render SDK primitives|document|<div>/i);
      return true;
    }
  );
});

test("reports malformed TSX with a source-oriented diagnostic", () => {
  assert.throws(
    () => transpileTsx(`export default widget(${manifest}, () => <Column>`),
    (error) => {
      assert.ok(error instanceof TsxRuntimeError);
      assert.equal(error.code, "tsx-syntax-error");
      assert.match(error.message, /widget\.tsx|JSX|syntax|closing/i);
      return true;
    }
  );
});

test("runtime validation accepts the interactive native Phase 9 slice", () => {
  const tree = buildRuntimeTree(`
    import { Button, Grid, Progress, Text, widget } from "@render/sdk";
    export default widget(${manifest}, () => Grid({
      columns: 2,
      children: [
        Button("Refresh", { type: "invoke", name: "widget.refresh" }),
        Progress(42, 100),
        Text("Ready")
      ]
    }));
  `);

  assert.equal(tree.kind, "grid");
  assert.equal(tree.children[0].action.name, "widget.refresh");
  assert.equal(tree.children[1].maximum, 100);
});

test("runtime validation names unsupported style fields", () => {
  assert.throws(
    () => buildRuntimeTree(`
      import { Text, widget } from "@render/sdk";
      export default widget(${manifest}, () => Text("Ready", { css: "color: red" }));
    `),
    /root\.style\.css: unknown style property/
  );
});

test("runtime validation names unsupported actions", () => {
  assert.throws(
    () => buildRuntimeTree(`
      import { Button, widget } from "@render/sdk";
      export default widget(${manifest}, () => Button("Play", { type: "invoke", name: "media.play" }));
    `),
    /unsupported action 'media\.play'/
  );
});

test("runtime validation rejects invented providers and deferred image sources", () => {
  assert.throws(
    () => buildRuntimeTree(`
      import { Text, useProvider, widget } from "@render/sdk";
      export default widget(${manifest.replace('"subscribe": []', '"subscribe": ["weather.current"]')}, () => Text(useProvider("weather.current")));
    `),
    /unsupported provider 'weather\.current'/
  );
  assert.throws(
    () => buildRuntimeTree(`
      import { Image, widget } from "@render/sdk";
      export default widget(${manifest}, () => Image({ kind: "url", url: "https://example.com/art.png" }));
    `),
    /URL images require the manifest capability/
  );
});

test("bounds widget render execution inside the disposable runtime", () => {
  assert.throws(
    () => buildTsxRuntimeTree(`
      import { widget } from "@render/sdk";
      export default widget(${manifest}, () => { while (true) {} });
    `, { timeoutMs: 10 }),
    (error) => {
      assert.ok(error instanceof TsxRuntimeError);
      assert.equal(error.code, "tsx-render-error");
      assert.match(error.message, /timed out/i);
      return true;
    }
  );
});
