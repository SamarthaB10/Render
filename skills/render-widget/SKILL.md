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

## Required workflow

### 1. Discover the available contract

Before authoring, inspect the SDK catalog:

```bash
render sdk list
render sdk describe <primitive-or-provider>
```

Select only cataloged primitives, styles, providers, and capabilities. If the request needs something missing—such as Spotify playback, an image provider, or an interactive button—explain that the integration is not yet available and do not substitute fake data or an invented API.

### 2. Create or identify an isolated workspace

Use a dedicated workspace for the widget:

```bash
render init --workspace "$WORKSPACE"
```

If the workspace already contains `widget.tsx`, preserve its identity and remix it in place. Never create a second active widget for a remix request.

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

Wait for the status result to report the active widget as running. For iterative edits, use:

```bash
render run --workspace "$WORKSPACE" --watch
```

Successful edits update the existing widget in place. The first prototype is draggable; placement is persisted by the native host.

### 6. Remix, move, and recover

- For a visual remix, edit the existing `widget.tsx`, then run `render check` and `render run` again.
- For logical movement, update the manifest anchor rather than hard-coding screen coordinates.
- If a candidate fails, inspect `render status --json`; keep the last-known-good version running.
- To restore a prior successful version, run:

```bash
render rollback --workspace "$WORKSPACE" --version <snapshot-version>
```

Report the resulting active and last-known-good versions to the user.

## North-star behavior

The long-term goal is to handle requests such as “I need a mini 4x4 widget that plays my Spotify music.” The current CPU/RAM widget is only the first reference fixture. A future implementation must add cataloged image, icon, button, progress, provider, action, account, and permission contracts before claiming that request is supported.
