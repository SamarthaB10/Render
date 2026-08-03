# Render — Domain Context

Render is a native macOS desktop widget platform. Users describe what they
want to their own agents, and the agent creates a TypeScript/TSX widget that
appears on the desktop. Widgets are small always-available surfaces: live
data displays, interactive controls, or focused mini-apps.

## Widget

A self-contained surface living on the macOS desktop layer. A widget is
authored as a TypeScript module and rendered through Render's native SwiftUI
host. Embedded live web pages are not widgets; widgets use declared APIs and
host providers instead.

## Provider

A host-owned data source collected once and shared with subscribed widgets.
Examples include CPU, memory, time, and Spotify playback. Providers expose
typed loading, available, or unavailable values. They never fabricate live
data when the source is missing or access is denied.

## Connector

A host-owned integration that handles authentication, credential storage,
token refresh, and API calls for a service such as Spotify. Widget source
declares the connector and exact scopes; it never receives access tokens or
refresh tokens.

## Standard surface

What a widget can use without additional protected access: native SDK
primitives, declared providers, and explicitly declared capabilities. Network,
filesystem, account, and other machine access must be declared and explained
to the user before use.

## Conjure

The primary Render workflow: a user asks an agent for a widget, the agent
discovers the SDK, authors the TSX module, checks it, and runs it on the
desktop.

## Remix

The user asks an agent to change an existing widget—its color, layout,
position, data source, or controls. Render updates the widget in place while
retaining the last known-good version for rollback.

## Desktop placement

Widgets use logical anchors and offsets for their initial placement. After
creation, users can drag widgets directly on the desktop. The native host
clamps placement to a visible display and persists the physical position.

## Account availability

Successful OAuth proves that the account was authorized; it does not prove
that a provider operation is permitted. Spotify playback APIs require a
Premium account. A Spotify widget must show a clear unavailable reason for a
403 or missing device and must never replace it with fake playback data.

## Agent-readable contract

The SDK catalog, widget skill, check diagnostics, README, and implementation
roadmap are part of the agent contract. Every supported primitive, provider,
action, capability, failure, and required user permission should be
discoverable from those surfaces without reading the host implementation.

## Canonical Widget contract

The canonical Widget contract is the versioned, self-describing JSON Schema at
`contracts/render-widget-contract.v1.json`. It is the source of truth for the
agent-visible Widget manifest, retained tree, primitives, styles, providers,
actions, capabilities, connectors, and compatibility version. TypeScript,
native Swift, and agent-facing Markdown outputs are generated from it and CI
rejects drift between the source and those outputs.

## Widget lifecycle state

The policy state of an installed Widget: `stopped`, `candidate`, `starting`,
`running`, `recovering`, or `quarantined`. It is separate from the existing
`status` field so older CLI consumers remain compatible while promotion,
rollback, restart, and failure recovery become explicit.

## Lifecycle receipt

A durable JSONL record at `.render/logs/lifecycle.jsonl` for each lifecycle
transition. It names the Widget, request, prior and next state, reason,
active and last-known-good versions, process identity, and diagnostics.
