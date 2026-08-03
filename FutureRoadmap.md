# Render Future Roadmap

Render's long-term goal is a native macOS widget platform that an agent can operate end to end. A user should be able to say, “Make me a mini Spotify player,” and have Render discover the SDK, author a typed TSX module, request only the permissions it needs, validate it, run it, and safely remix it later.

This roadmap starts from the current local prototype. It is intentionally separate from [`ImplementationDoc.md`](ImplementationDoc.md), which records the implementation phases already completed and the near-term foundation work.

## Product invariants

Every future phase should preserve these properties:

- Widgets render as native macOS surfaces from typed TypeScript/TSX modules. The runtime does not expose a DOM or require a webview fallback.
- A widget failure cannot take down the host or another widget.
- A failed remix never replaces the last-known-good version.
- Agents can discover the exact SDK contract, capabilities, permissions, commands, and failure-repair instructions from machine-readable output and checked-in documentation.
- Network, filesystem, account, and other privileged operations remain host-owned and capability-based. Secrets stay out of widget source and logs.
- Placement, settings, lifecycle state, and widget identity survive relaunches and are represented by explicit contracts.
- Performance claims have receipts. Limits are measured from representative widgets before they become enforcement budgets.

## Current baseline

The current prototype already provides a local Swift/AppKit and SwiftUI host, a TypeScript SDK and catalog, a serializable widget tree, validation, snapshots, last-known-good promotion, watch mode, logical placement, native dragging, host-owned authentication, and the first Spotify connector.

The main gaps are deliberate: one active widget is the supported local path, the supervisor boundary still needs to become a true multi-widget runtime, and installation currently requires developer tooling and terminal commands. Spotify playback also depends on the account's service-level access; an OAuth success does not guarantee playback access.

## Delivery sequence

The phases below are ordered by dependency. Each phase is marked `Planned` until its acceptance criteria are implemented and verified.

### Phase F1 — Independent widget runtimes

Status: Planned. Highest priority.

Change the current single-widget lifecycle into a supervisor that owns a separate native worker process for every running widget. Keep the existing serializable tree and worker protocol as the contract boundary. Use XPC where it provides reliable macOS process identity and lifecycle management; keep transport details behind the protocol so the widget contract does not depend on one IPC implementation.

Implementation steps:

- Define a stable widget identity, runtime directory, state file, log stream, and process record for each widget.
- Move launch, readiness, stop, restart, health checks, and crash classification into the supervisor.
- Ensure each worker has an independent process lifetime and that worker failure is isolated from the host and every other worker.
- Preserve last-known-good snapshots and promote a candidate only after validation and native readiness.
- Make status truthful after launch timeouts, crashes, stale PIDs, sleep/wake, and manual termination.
- Add measured resource observations for each worker before introducing enforcement budgets.

Acceptance criteria:

- Multiple widgets can run concurrently under one host-managed supervisor.
- Killing or crashing one worker leaves the host and other widgets running.
- A failed candidate leaves the previous version visible and actionable diagnostics identify the repair path.
- Stop, restart, status, and logs address one widget without ambiguous global process state.

### Phase F2 — One-click installation and lifecycle management

Status: Planned. Depends on F1's supervisor contract.

Turn Render into a user-installable macOS application. A new user should not need Swift, Node, SwiftPM, or a terminal to run installed widgets.

Implementation steps:

- Produce a signed macOS application bundle containing the host, supervisor, worker runtime, CLI support, SDK catalog, and required resources.
- Add a first-run flow that creates the Render data directory, explains permissions, and verifies the runtime before accepting widgets.
- Install into the standard Applications location and provide a recoverable uninstall path.
- Register a launch-at-login mechanism owned by the app, with an explicit user choice and a visible setting to change it.
- Restore widget definitions, versions, placement, and permissions after login, reboot, sleep, wake, and closing the computer lid.
- Add versioned migrations for runtime state and a repair path when an update cannot restore a widget.
- Complete signing, notarization, update, and distribution work before calling the installer production-ready.

Acceptance criteria:

- A fresh Mac can install and launch Render through one user-facing flow.
- Installed widgets return after a normal restart and after sleep/wake without requiring terminal commands.
- An update preserves working widgets and placement, or reports exactly what needs repair.
- The app explains every system permission it requests and continues to run widgets that do not need a denied permission.

### Phase F3 — Seamless agent remixes

Status: Planned. Depends on F1 and the installed lifecycle from F2.

Make “change the color,” “move this beside my calendar,” and larger agent-generated edits safe, observable, and reversible.

Implementation steps:

- Define an agent-facing runtime API over the existing CLI operations, with stable request IDs and JSON schemas.
- Give every remix a workspace identity, source snapshot, candidate snapshot, validation result, readiness result, and promotion result.
- Stage a candidate in an isolated worker before swapping it into the visible widget.
- Update in place only after the candidate is ready; keep the prior version visible during compilation or failure.
- Add structured diff and preview information so an agent can explain what changed and why.
- Persist settings separately from generated source so a user preference such as color or position can be changed without rewriting unrelated code.
- Make watch mode debounce edits, coalesce safe changes, and expose its current state in status output.
- Make rollback and recovery work after a host restart, not only during one terminal session.

Acceptance criteria:

- A user can ask an agent for a small visual change and see the existing widget update without losing its identity or placement.
- A failed remix remains invisible, reports a repairable diagnostic, and leaves the last-known-good version running.
- The agent can inspect the exact active version, pending candidate, previous versions, and settings through JSON.
- A user can stop or roll back a widget from its native settings control and from the CLI.

### Phase F4 — Expand the native primitive system

Status: Planned. Start after the runtime contract is stable; deliver in vertical slices.

The SDK should give agents a deep, coherent set of native building blocks instead of forcing them to invent one-off primitives. Add each family end to end: TypeScript contract, catalog entry, JSX/runtime behavior, native renderer, validation, tests, agent documentation, accessibility behavior, and performance receipt.

Initial primitive families:

- Layout: `ScrollView`, constraints, measured/adaptive layout, safe-area and multi-display placement, reusable component composition.
- Input: `TextField`, `Toggle`, `Slider`, `Picker`, date/time controls, focus management, keyboard navigation, and accessible labels.
- Collections: `List`, sections, virtualized repeated content, loading/empty/error states, and stable identity for updates.
- Data visualization: line, bar, area, sparkline, ring, and richer gauge primitives with bounded animation and readable fallbacks.
- Media: artwork, image loading and caching through host-owned providers, playback state, transport controls, and volume controls.
- System surfaces: notifications, open-app/open-URL actions, filesystem-backed resources, network-backed resources, calendar, weather, and other capability-gated providers.
- Styling: semantic themes, gradients, typography scales, icons, borders, shadows, materials, transitions, and reduced-motion behavior.

Do not add a primitive only because it is easy to expose. A primitive is ready when an agent can discover when to use it, compose it with the existing catalog, receive actionable diagnostics, and run it without a hidden web dependency.

### Phase F5 — Agent-first SDK discovery and generation

Status: Planned. Evolves alongside F4.

Make the SDK legible to an agent before it writes code.

Implementation steps:

- Version the SDK catalog and expose complete JSON schemas for primitives, props, style values, providers, actions, capabilities, permissions, and platform availability.
- Add examples and fixtures for common widget shapes: system monitor, clock, media player, dashboard, launcher, list, and chart.
- Add a capability planner that turns a widget request into required primitives, providers, actions, and permission prompts.
- Improve `check --json` so every failure includes the source path, contract name, invalid value, expected form, and a concrete repair suggestion.
- Add scaffold templates that generate typed TSX modules and the smallest valid manifest for each widget family.
- Document compatibility and migration rules so agents can update older widget modules instead of guessing.

Acceptance criteria:

- A fresh agent can discover the catalog without reading implementation internals.
- A generated widget uses only catalogued primitives and passes validation without manual translation.
- Unsupported requests produce a precise missing-contract report rather than fake data or a web fallback.

### Phase F6 — Reliability, performance, and security hardening

Status: Planned. Runs continuously after F1.

Use real widget workloads to harden the platform before broad distribution.

Implementation areas:

- Record CPU, memory, launch, render, IPC, and recovery receipts for representative widget suites.
- Add measured tripwires for pathological trees, runaway updates, oversized assets, provider loops, and excessive logging.
- Deduplicate host providers and cache safe reads without leaking account data across widgets.
- Redact secrets and sensitive paths from diagnostics; audit Keychain and capability boundaries.
- Test multi-monitor layouts, Spaces, display changes, accessibility, reduced motion, dark/light appearance, and sleep/wake transitions.
- Add crash reports that identify the widget, version, worker state, and last successful operation without collecting widget secrets.
- Verify that a denied capability affects only the requesting operation and does not block unrelated widgets.

### Phase F7 — Sharing and widget portability

Status: Planned. Only after installation and runtime recovery are reliable.

Make widgets easy to move and remix without turning Render into an unsafe package runner.

Potential capabilities:

- Export/import a typed widget source bundle with its catalog version and declared capabilities.
- Preserve remix lineage, settings, and last-known-good snapshots when a widget is copied.
- Provide a reviewable permission summary before an imported widget runs.
- Support a local widget library and reproducible examples for agents and humans.

## Dependency map

```text
Current local foundation
        |
        v
F1 independent runtimes -----> F2 one-click installer and relaunch
        |                                      |
        +---------------------> F3 seamless agent remixes
                                               |
                         +---------------------+------------------+
                         v                                        v
                F4 native primitive families              F5 agent discovery
                         \                                        /
                          +--------------> F6 hardening
                                                   |
                                                   v
                                          F7 sharing and portability
```

## Definition of roadmap complete

Render is ready for the next product stage when a user can install it once, ask an agent for a typed native widget, approve only the requested capabilities, run several widgets independently, close or restart the Mac, return to the same widgets, and ask the agent to remix one widget without disturbing the others. Every failure must be visible, attributable, reversible, and actionable from both the native UI and the agent-facing contract.

## Decisions still requiring explicit product review

- The exact macOS packaging, signing identity, notarization, and update channel.
- Whether the supervisor is a login-launched app process, a LaunchAgent, or a combination of both.
- The final XPC protocol and how it coexists with the current local worker protocol.
- How much widget state is persisted by Render versus by a widget's declared storage provider.
- The permission UX for network, filesystem, account, notifications, and other capabilities.
- The compatibility policy for Spotify playback features and other third-party service restrictions.
