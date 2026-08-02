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
- [ ] Make SDK discovery agent-complete with exact contracts, canonical examples, and a scaffold command.
