---
name: render-widget
description: Create, run, remix, and recover native macOS widgets through Render's SDK and workspace-scoped CLI.
---

# Render widget authoring

Use this skill when a user asks for a desktop widget. Render widgets are native macOS desktop surfaces authored through the canonical `@render/sdk` contract. The widget source of truth is `widget.tsx` inside a dedicated Render workspace.

Use the installed `render` command when available. When working directly from this repository, replace `render` in the examples with `node bin/render.mjs`.

## Operating contract

- Work only inside the requested or newly created Render workspace.
- Do not edit unrelated projects, repository files, or global configuration.
- Use primitives and providers from `@render/sdk`; do not invent DOM, HTML, CSS, browser APIs, webviews, or arbitrary native APIs.
- Keep the manifest explicit: size, logical anchor, capabilities, and provider subscriptions must be declared.
- Treat CLI diagnostics as the source of truth. Fix the reported path and message before trying to run again.
- A failed candidate must never replace the last-known-good widget.
- Do not claim an integration works when its provider, action contract, or capability enforcement is not shipped.
- Conjure creates a source Widget, Share preserves that readable source artifact, and Remix patches the installed source in place; never substitute a compiled artifact, workspace pointer, DOM, HTML, CSS, webview, or private native view.

## Required workflow

### 1. Discover the available contract

The catalog is the authoritative, agent-readable SDK contract. Do not infer an API from a summary or invent a missing primitive. Inspect the full JSON contract before authoring:

```bash
render sdk list --json
render sdk describe <primitive-or-provider-or-type> --json
```

Each described item includes its exact `importPath`, TypeScript `signature`, canonical `example`, and any `notes` or required declarations. Select only cataloged primitives, styles, types, providers, actions, and capabilities. A name in the roadmap is not an import: use it only when the catalog describes it as supported for the active SDK version.

If the request needs something missing—such as Spotify playback, an image provider, or an interactive button—report the exact missing catalog item or capability, explain what platform contract is absent, and stop that part of the Widget. Do not substitute fake data, a browser fallback, a private native API, or an invented Render API. If the supported design needs network, filesystem, app, account, or other machine access, declare the narrowest capability and ask the user for permission before proceeding.

For the Phase 9 surface, the roadmap families are layout, typography/content, visuals, controls/actions, collections/data, and providers/integrations. The shipped first slice is `Box`, `Spacer`, `Divider`, `Icon`, `Image`, `Button`, `Progress`, `Grid`, typed actions/provider states, and the JSX runtime. Treat any item as unavailable until `render sdk list --json` and `render sdk describe ... --json` expose its exact contract and support status.

### 2. Create or identify an isolated workspace

For a new widget, use the canonical scaffold. It creates an isolated workspace and a valid SDK-only `widget.tsx`:

```bash
render scaffold --workspace "$WORKSPACE"
```

`render init` remains available as the compatibility spelling for creating the same default workspace. If the workspace already contains `widget.tsx`, preserve its identity and remix it in place. Never create a second active widget for a remix request.

### 3. Author `widget.tsx`

Import only from `@render/sdk`. Keep the widget declarative and serializable:

```tsx
import { Column, Gauge, Text, useProvider, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "System Monitor",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 180 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": ["system.cpu", "system.memory"]
}, () => Column([
  Text("CPU"),
  Gauge(useProvider("system.cpu"), 100),
  Text("Memory"),
  Gauge(useProvider("system.memory"), 100)
]));
```

The scaffold above is the canonical CPU/RAM example. It is also the canonical example for the first provider-backed widget path. For another composition, inspect every primitive with `render sdk describe <name> --json` and copy its documented signature and example. The current runtime supports all cataloged layout, content, control, and progress primitives, plus constrained typed styles and automatic TSX. `useTimer` remains cataloged for a future host-scheduled update contract and is not yet rendered by the native host. Image URL/provider sources are cataloged gaps and `render check` rejects them until their capability-backed providers ship. Every future primitive must ship as SDK type, JSX/runtime contract, catalog entry, native renderer, validation, agent documentation, focused tests, and performance evidence before the skill may use it.

For network or filesystem access, declare the narrowest required capability and ask the user for permission before proceeding. Never place credentials or tokens in `widget.tsx`.

### 4. Validate before running

```bash
render check --workspace "$WORKSPACE" --json
```

The JSON result is the machine-readable contract. Resolve every diagnostic before invoking the native host.

### 5. Run and confirm the live state

```bash
render run --workspace "$WORKSPACE" --json
render status --workspace "$WORKSPACE" --json
```

Wait for the status result to report the active widget as running and, when native supervision is available, `worker.status` as `ready`. The status JSON also exposes the worker protocol version, worker process ID, restart count, latest resource sample, and actionable diagnostics. For iterative edits, use:

```bash
render run --workspace "$WORKSPACE" --watch
```

Successful edits update the existing widget in place. The first prototype is draggable; placement is persisted by the native host. The implemented local providers are `system.cpu`, `system.memory`, and `system.time`; `system.time` is rendered as the host-local clock when bound to `Text`.

### 6. Remix, move, and recover

- For a visual remix, edit the existing `widget.tsx`, then run `render check` and `render run` again.
- For logical movement, update the manifest anchor rather than hard-coding screen coordinates.
- To move through the lifecycle boundary, use a logical corner and optional offsets:

```bash
render move --workspace "$WORKSPACE" --corner top-right --offset-x 24 --offset-y 24 --json
```

- Never pass raw screen coordinates to `render move`.
- If a candidate fails, inspect `render status --json`; keep the last-known-good version running.
- If the worker exits, inspect `render status --json` while it reports `restarting`; the native supervisor retains the current tree and retries with bounded backoff.
- Do not treat a `restarting` worker as a blank-widget success. Wait for `worker.status: "ready"` or use the diagnostic path to repair the candidate.
- To restore a prior successful version, run:

```bash
render rollback --workspace "$WORKSPACE" --version <snapshot-version>
```

Report the resulting active and last-known-good versions to the user.

## North-star behavior

The long-term goal is to handle requests such as “I need a mini 4x4 widget that plays my Spotify music.” The current CPU/RAM widget is only the first reference fixture. A future implementation must add cataloged image, icon, button, progress, provider, action, account, and permission contracts before claiming that request is supported.
