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
- Keep the manifest explicit: size, logical anchor, capabilities, provider subscriptions, and connector account requirements must be declared.
- If the widget should be user-resizable, declare `adjustable` with measured min/max bounds and only the responsive modes the widget actually supports. Use the optional render context (`{ mode, size }`) for adaptive layout; do not scale blindly or create a private resize primitive.
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

If the request needs something missing—such as a provider, action, or connector whose catalog status is `planned` or `contract-only`—report the exact catalog item and status, explain what host contract is absent, and stop that part of the widget. Do not substitute fake data, a browser fallback, a private native API, or an invented Render API. If the supported design needs network, filesystem, app, account, or other machine access, declare the narrowest capability and ask the user for permission before proceeding.

For the Phase 9 surface, the roadmap families are layout, typography/content, visuals, controls/actions, collections/data, and providers/integrations. The shipped first slice includes `Box`, `Spacer`, `Divider`, `Icon`, `Image`, `Button`, `TextField`, `TextEditor`, `Toggle`, `Timer`, `TaskList`, `List`, `YouTubePlayer`, `ScrollView`, `Progress`, `Grid`, typed actions/provider states, the JSX runtime, and the host-owned `WidgetAdjustable`/`WidgetRenderContext` contract. `Timer`, `TaskList`, and `TextEditor` are host-owned stateful primitives: timers persist countdown state across relaunch, task lists support direct editing, completion, adding, removal, and persistence, and editors persist user text. `List` is the generic read-only collection surface in this slice; use `WidgetListItem` for static rows or a structured provider such as `reminders.items`. `YouTubePlayer` is the explicit network-backed media surface: it accepts a validated YouTube video ID, requires `network` in the manifest, and supports a persisted native link-input toggle through `allowLinkInput`. Use stable keys for stateful nodes so user data survives remixes and reordering. Treat any item as unavailable until `render sdk list --json` and `render sdk describe ... --json` expose its exact contract and support status.

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

The scaffold above is the canonical CPU/RAM example. It is also the canonical example for the first provider-backed widget path. For another composition, inspect every primitive with `render sdk describe <name> --json` and copy its documented signature and example. The current runtime supports all cataloged layout, content, control, task-list, timer, scroll, editor, and progress primitives, plus constrained typed styles and automatic TSX. `useTimer` remains cataloged for a future host-scheduled update binding; use `Timer` for a visible host-owned countdown surface. Image URL/provider sources are cataloged gaps and `render check` rejects them until their capability-backed providers ship. Every future primitive must ship as SDK type, JSX/runtime contract, catalog entry, native renderer, validation, agent documentation, focused tests, and performance evidence before the skill may use it.

For stateful study or planning widgets, inspect the exact contracts before authoring. `Timer` includes an in-widget duration editor; `TaskList` includes direct editing, completion, add/remove, reorder, and clear-completed controls; `DateTimePicker` provides a native persisted date/time selection:

```bash
render sdk describe Timer --json
render sdk describe TaskList --json
render sdk describe WidgetTaskItem --json
render sdk describe List --json
render sdk describe WidgetListItem --json
render sdk describe YouTubePlayer --json
render sdk describe YouTubePlayerProps --json
render sdk describe ScrollView --json
render sdk describe TextEditor --json
render sdk describe DateTime --json
render sdk describe DateTimePicker --json
```

For an adjustable widget, inspect the exact contract before authoring:

```bash
render sdk describe WidgetAdjustable --json
render sdk describe WidgetRenderContext --json
```

The host exposes native resize handles when `adjustable.enabled` is true. The settings panel also exposes width/height, lock, reset, and declared responsive modes. Use these explicit operations for agent-driven changes:

```bash
render resize --workspace "$WORKSPACE" --width 420 --height 300 --json
render mode --workspace "$WORKSPACE" --mode compact --json
render mode --workspace "$WORKSPACE" --mode auto --json
render reset-size --workspace "$WORKSPACE" --json
```

Size, mode, lock state, and placement persist locally across relaunches. They are runtime preferences, not shared source state. If a remix removes the saved mode, Render switches to `auto`, reports the recovery, and keeps the last-known-good widget active.

For network or filesystem access, declare the narrowest required capability and ask the user for permission before proceeding. Never place credentials or tokens in `widget.tsx`.

For an authenticated integration, declare the connector and exact scopes in the manifest. The current contract-only Spotify shape is:

```tsx
"accounts": [{
  "connector": "spotify",
  "scopes": [
    "user-read-private",
    "user-read-playback-state",
    "user-read-currently-playing",
    "user-modify-playback-state"
  ]
}]
```

`RenderHost` owns OAuth, secure credential storage, refresh, API calls, and permission state. Never put access tokens, refresh tokens, client secrets, or arbitrary OAuth URLs in the widget source. Spotify is implemented when `render sdk describe spotify --json` reports `status: "implemented"`, but the local host still needs a Spotify client ID configured before authorization can open.

OAuth success does not guarantee playback access. Spotify playback endpoints
require Premium access; if the host reports HTTP 403, explain that limitation
and keep the widget in an explicit unavailable state. Do not invent track,
progress, volume, or device data and do not ask the agent to regenerate the
widget as though this were a TSX error.

For native macOS Reminders, inspect the implemented connector and each
provider/action before authoring:

```bash
render sdk describe reminders --json
render sdk describe reminders.account --json
render sdk describe reminders.items --json
render sdk describe reminders.incompleteCount --json
render sdk describe reminders.next.title --json
render sdk describe reminders.next.dueDate --json
render sdk describe reminders.create --json
render sdk describe reminders.update --json
render sdk describe reminders.complete --json
render sdk describe reminders.delete --json
```

Declare the exact account scopes in the manifest:

```tsx
"accounts": [{
  "connector": "reminders",
  "scopes": ["reminders.read", "reminders.write"]
}]
```

Use provider bindings for redacted status/count/next-item display and
explicit action payloads for mutations. `reminders.create` requires
`{ title }` and accepts optional `listName` and ISO `dueDate`;
`reminders.update` requires an opaque `id` and accepts `title`, `dueDate`
(or `null`), and `completed`; `reminders.complete` requires `id` and
defaults `completed` to `true`; `reminders.delete` requires `id`. The
native host asks for permission through the settings panel and keeps
EventKit objects out of the widget. Run `npm run package:host` before using
permission-gated providers; the generated app bundle carries
`NSRemindersFullAccessUsageDescription` so macOS can show the system prompt.
`List(useProvider("reminders.items"))` is read-only in this slice; use the
explicit Reminders actions for mutations until row action bindings ship.

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

Successful edits update the existing widget in place. The first prototype is draggable; placement is persisted by the native host. The implemented local providers are `system.cpu`, `system.memory`, and `system.time`; `system.time` is rendered as the host-local clock when bound to `Text`. Spotify providers/actions are host-backed and remain explicit unavailable states until the user connects an account.

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

The long-term goal is to handle requests such as “I need a mini 4x4 widget that plays my Spotify music.” The SDK now exposes the generic account requirement, Spotify playback providers/actions, secure host authorization, and Render-owned permission UI. The agent must still configure the local Spotify client ID and let the user accept permissions before claiming the widget is connected.
