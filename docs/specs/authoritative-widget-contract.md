# Authoritative SDK-to-native contract

## Decision

`contracts/render-widget-contract.v1.json` is the single authoritative description of Render's portable Widget boundary. It owns the manifest, serialized tree, worker messages, primitive and provider names, capabilities, connectors, actions, themes, and protocol discriminators.

`scripts/generate-widget-contract.mjs` is an adapter, not a second contract. It checks duplicated JSON Schema metadata for drift and produces the checked-in TypeScript types and constants, agent catalog membership, Swift discriminators and supported-value sets, and the readable SDK reference. CI runs `npm run contract:check` and rejects stale generated files.

The runtime loads the canonical schema directly. Existing JavaScript and Swift validators remain responsible for semantic rules that JSON Schema cannot express clearly, such as primitive-specific fields, capability requirements, sibling key uniqueness, connector scopes, and actionable repair messages. Structural validation runs at the same runtime boundary after those semantic checks. Worker messages are discriminated by kind, including separate render request and response shapes. Native decoding uses generated discriminators and field sets, and generation fails when a canonical field is absent from the Swift decoder.

## Change path

Change the JSON contract first. Then run `npm run contract:generate` and update semantic behavior only where the new contract requires it. A catalog entry is not complete until the SDK, runtime, worker transport, native decoder/validator, generated documentation, and compatibility tests agree.

Version 1 changes must remain backwards compatible and additive. Removing or changing the meaning of a serialized field, enum case, or message requires a new contract version and an explicit compatibility path. A schema version and a worker protocol version are separate because either boundary may evolve independently.

## Acceptance matrix

| Surface | Derived or verified from the contract |
| --- | --- |
| TypeScript SDK | Literal unions and structural `WidgetNode`, `WidgetManifest`, action, JSON value, and worker message types are generated |
| Agent discovery | Catalog membership, wire names, kinds, and summaries are generated; examples remain curated overlays |
| Runtime | Manifest and serialized tree structure are validated against the schema; semantic checks add domain-specific diagnostics |
| Worker transport | Protocol version, message kinds, and message structure are generated or schema-validated |
| Swift host | Node and worker discriminators plus canonical field sets are generated; generation verifies decoder coverage |
| Documentation | `docs/sdk-contract.md` is generated |
| Drift prevention | `contract:check`, TypeScript compilation, and the shared `contracts/fixtures/widget-contract.v1.compatibility.json` fixture fail when JavaScript and Swift surfaces disagree |

## Non-goals

- Generating authored SDK helper implementations or native rendering code. Those are behavior, not wire shape.
- Replacing specific semantic diagnostics with generic schema errors.
- Adding a new dependency or a separate schema registry.
