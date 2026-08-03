# Render implementation TODO

## Phase 1 - Toolchain and native host proof

- [x] Add SwiftPM/AppKit host source with a transparent desktop window boundary.
- [x] Add the serializable widget-tree protocol.
- [x] Add focused tests for protocol validation and encoding.

## Phase 2 - SDK and CLI contracts

- [x] Add `@render/sdk` package and initial primitives.
- [x] Add manifest and capability validation.
- [x] Add workspace-scoped `render init`, `render check`, and `render status`.

## Phase 3 - First widget path

- [x] Render the initial primitive tree natively.
- [x] Add CPU/RAM providers and one-second host updates.
- [x] Add watch reload, snapshots, persistence, and rollback.

## Phase 4 - Future isolation preparation

- [x] Add versioned supervisor/worker protocol boundaries.
- [x] Measure runtime and snapshot performance before setting tripwires; receipt: `perf/receipts/first-prototype.json`.

## Phase 5 - Agent discovery

- [x] Add the canonical SDK catalog and `render sdk list` / `render sdk describe` commands.
- [x] Add the Render agent skill with catalog-guided arbitrary widget authoring; CPU/RAM is the first fixture and Spotify-style integrations are the north-star validation.
- [x] Add logical `render move` with atomic anchor updates and lifecycle reruns.
- [x] Verify the agent skill through the complete create, remix, move, check, watch, and rollback workflow using the deterministic host boundary.
- [x] Make SDK discovery agent-complete with exact contracts, canonical examples, and a scaffold command.

## Phase 6 - Crash isolation

- [x] Define the versioned supervisor/worker message contract and compatibility negotiation.
- [x] Execute widget TypeScript in a disposable Node worker owned by RenderHost.
- [x] Keep the last-known-good native tree active while a worker restarts.
- [x] Add bounded restart backoff and actionable worker diagnostics.
- [x] Add session-scoped worker state/tree files for safe candidate handoff.
- [x] Add measured CPU and resident-memory telemetry with explicit tripwires.
- [x] Route native run, watch, move, and rollback through the supervisor path.
- [x] Verify worker crash recovery on the target macOS runtime.

## Phase 9 - Native JSX and SDK surface

- [x] Define `jsx`, `jsxs`, and `Fragment` plus typed native style props without DOM or CSS exposure.
- [x] Add `Box`, `Spacer`, and `Divider` through the complete SDK/catalog/native/validation/docs/test/receipt boundary.
- [x] Add `Icon`, `Image`, `Button`, and `Progress` with serializable state and typed actions.
- [x] Define provider values, loading/unavailable states, and the capability declarations required by the first slice.
- [x] Make SDK discovery exact enough for a fresh agent to author without guessing imports or signatures.
- [x] Add actionable unsupported-capability diagnostics and prohibit invented primitives, providers, actions, fake data, DOM, and webview fallbacks.
- [x] Add focused tests and performance receipts, then verify an interactive Widget through check, run, remix, move, watch, and rollback.

Phase 9 is complete for the first vertical slice. URL/provider image sources,
media playback, account authentication, and filesystem/network operations
remain explicit cataloged capability gaps until their host contracts ship.

## Phase 10 - Host-owned authenticated integrations

- [ ] Define generic connector/account requirements with exact scope strings and serializable account states.
- [ ] Validate connector requirements at the SDK/CLI boundary and publish them through `render sdk list` / `render sdk describe`.
- [ ] Add host-owned auth lifecycle state and secure credential storage without exposing tokens to widget workers.
- [ ] Add Render-owned connect/denied/unavailable UI and retry from the settings panel.
- [ ] Add Spotify PKCE authorization, refresh, current playback, track metadata, progress, volume, and playback actions.
- [ ] Add allowlisted host networking, response validation, rate-limit/error handling, and structured action results.
- [ ] Add hover-only liquid-glass settings control with a confirmed stop flow and process metadata.
- [ ] Add a canonical Spotify widget and update the Render agent skill with exact integration guidance.
- [ ] Verify the full authenticated widget workflow and record test/performance receipts.
