# Native design system and shared Widget channels

## Problem Statement

Render must produce Widgets that feel like deliberate native macOS surfaces, not generic AI-generated cards. The reference direction is sleek, compact, rounded, readable, and purposeful: dark hardware-like surfaces, restrained translucency, clear hierarchy, and motion that communicates state.

This is a platform concern, not a Spotify-only feature. A user may ask an agent for a Spotify controller and a separate visualizer, a timer and task list, a sports score and notification surface, or any other coordinated set of Widgets. Render needs one coherent visual system, reusable polished compositions, and a general host-owned way for independently running Widgets to share typed live state.

The platform must also remain honest about source availability. A visualizer must not fabricate audio data, and “tempo control” must not imply unsupported third-party playback-speed control.

## Solution

Extend Render with a native, agent-readable design system and a host-mediated shared-channel contract.

Render ships a dark-first default visual language for all Widgets: semantic themes, materials, typography, spacing, radii, borders, shadows, motion, density, and responsive behavior. SDK primitives automatically inherit the active theme. Authored raw styling is preserved until the user chooses a runtime theme; a chosen runtime theme then owns the Widget palette, typography, geometry, borders, and surfaces, while supported semantic design tokens remain explicit theme roles. Unsupported styling is rejected with actionable diagnostics.

Add polished composable patterns—MediaCard, Artwork, TransportControls, Visualizer, GlassPanel, status surfaces, and settings chrome—on top of the same catalog. These patterns remain native, typed, accessible, and adaptable to any domain.

Keep each Widget independently crash-isolated. Widgets coordinate only through explicit, versioned, typed channels mediated by the Render host. Channels provide a retained state snapshot for newly launched Widgets and live events for running Widgets. Access is capability-based, visible in metadata, and enforced by the host.

Spotify is the first media connector and first proof of the generic model. A Spotify controller and visualizer may share a host-owned playback session and channel, while unrelated Widgets remain independent. The baseline visualizer reacts to an honest shared playback clock and available metadata; richer audio-band visualization is optional and only appears when a permitted audio source exists.

## User Stories

1. As a Widget author, I want a coherent native default theme, so that a newly generated Widget looks polished without hand-styling every primitive.
2. As a Widget author, I want semantic themes for surfaces, text, accents, controls, borders, and motion, so that agents can compose consistent designs from typed tokens.
3. As a user, I want a dark-first default with charcoal surfaces, restrained translucency, thin highlights, and one controlled accent, so that Widgets feel like native desktop hardware.
4. As a user, I want an accessible light theme, so that Widgets remain usable in bright environments.
5. As a user, I want deliberate shape hierarchy, so that surfaces, panels, controls, and status pills do not all look identically rounded.
6. As a Widget author, I want basic primitives to inherit the active theme, so that Columns, Text, Buttons, TextFields, Lists, Timers, and MediaCards fit the system by default.
7. As an agent, I want typed token overrides, so that requests such as “make this blue” or “make this monochrome” can be implemented precisely.
8. As an agent, I want unsupported CSS-like styling to produce repairable diagnostics, so that I can choose the nearest supported primitive instead of silently creating a broken surface.
9. As a user, I want to switch between supported themes from settings, so that I can personalize a Widget without rebuilding it.
10. As a user, I want theme, density, size, mode, lock state, and placement preferences to persist locally, so that my desktop arrangement survives relaunches.
11. As an agent, I want a request such as “make it retro” to produce a complete coherent theme variation, so that typography, surfaces, controls, borders, and motion change together.
12. As a user, I want subtle purposeful motion by default, so that Widgets feel responsive without becoming distracting.
13. As a user, I want visualizers, timers, and playback surfaces to use richer motion where appropriate, so that changing state is understandable at a glance.
14. As a user, I want reduced-motion preferences respected, so that animated Widgets remain comfortable and accessible.
15. As a Widget author, I want reusable native patterns such as MediaCard, TransportControls, Visualizer, Artwork, and GlassPanel, so that common experiences can be built accurately from the SDK.
16. As an agent, I want those patterns tunable through typed props and theme tokens, so that I can meet a user’s layout and visual direction without inventing private primitives.
17. As a user, I want every Widget to receive host-managed settings chrome, so that settings, resize, connection, kill, and recovery controls are always available.
18. As a user, I want the settings control to appear unobtrusively on hover and remain reachable by keyboard or accessibility focus, so that the desktop surface stays clean without hiding essential controls.
19. As a user, I want the settings panel to show theme, density, size, active connections, permissions, process identity, and kill/recovery actions, so that runtime behavior is understandable.
20. As a user, I want Widgets to remain separate processes, so that a visualizer crash cannot take down my media controller or unrelated Widgets.
21. As a Widget author, I want to declare channels I publish or subscribe to, so that coordination is explicit and auditable.
22. As a Widget author, I want channel schemas typed and versioned, so that Widgets can evolve independently without silently misreading state.
23. As a newly launched Widget, I want an immediate retained state snapshot, so that a visualizer does not wait for an arbitrary future event to know what is playing.
24. As a running Widget, I want live channel events, so that playback, timer, task, score, and notification surfaces update smoothly.
25. As a user, I want the host to mediate shared channels, so that Widgets never call one another directly or gain hidden access to global state.
26. As a user, I want channel access capability-based, so that a Widget can access only the shared state it declared and I approved.
27. As a user, I want channel access shown in Widget metadata and settings, so that I can understand and revoke connections.
28. As a Widget author, I want a domain-neutral channel system, so that the same infrastructure can connect media, productivity, sports, finance, weather, and notification Widgets.
29. As a user, I want authenticated services to use host-owned connector sessions, so that multiple Widgets can share one approved account session without repeated login prompts.
30. As a Widget author, I want Widgets to reference a connector session without receiving raw secrets, so that authentication remains secure and portable.
31. As a user, I want a Spotify controller and separate visualizer to share one playback session, so that both surfaces reflect the same track, progress, play state, volume, and commands.
32. As a user, I want native playback actions such as previous, play, pause, next, seek where supported, and volume, so that I can control playback from the desktop.
33. As a user, I want Spotify artwork and attribution handled by the host-owned media pattern, so that media surfaces remain compliant and consistent.
34. As a user, I want the visualizer to show an honest playback-driven animation when raw audio bands are unavailable, so that it remains useful without fabricated data.
35. As a user, I want richer spectrum visualization when a permitted audio-band source is available, so that advanced visualizations can be built without unsupported assumptions.
36. As a user, I want tempo controls to adjust visualizer or metronome response rather than falsely claiming to change Spotify playback speed, so that the UI accurately reflects capabilities.
37. As an agent, I want provider availability to distinguish live, silent, and unavailable states, so that generated Widgets can show useful empty and permission states instead of fake values.
38. As a user, I want denied permissions to affect only the requesting Widget operation, so that unrelated Widgets continue working.
39. As an agent, I want the catalog to describe primitives, patterns, providers, actions, channels, permissions, themes, and platform availability, so that I can select accurate supported building blocks.
40. As an agent, I want check diagnostics to name the contract, source location, invalid value, expected form, and repair, so that unsupported requests can be fixed without reading Render internals.
41. As a user, I want a valid remix to update a Widget in place while preserving identity, placement, settings, and channel subscriptions, so that personalization is smooth.
42. As a user, I want a failed remix to leave the last-known-good Widget visible, so that failures never leave a blank desktop surface.
43. As an operator, I want channel and process state observable through status output, so that crashes, stale connections, and unavailable providers are diagnosable.
44. As a performance-conscious user, I want visualizer updates, channel fan-out, and native rendering measured, so that the sleek experience does not become a CPU or memory regression.
45. As a developer, I want the full SDK-to-native vertical slice tested, so that a catalog entry cannot appear supported while the host cannot render it.

## Implementation Decisions

- Render’s public boundary remains the typed TypeScript/TSX SDK and serializable declarative tree. Widgets do not use a DOM, webview, embedded webpage, private native view, or bespoke provider implementation.
- Add a first-class semantic design-system contract covering theme identity, materials, surface hierarchy, typography roles, spacing, radii, borders, shadows, accent roles, density, motion, reduced motion, and responsive layout tokens.
- The default theme is dark-first and native macOS-inspired. Accessible light and other coherent variants are catalogued rather than arbitrary raw CSS.
- Explicit styling overrides defaults only through supported typed tokens and pattern props. Invalid styling is rejected with agent-repairable diagnostics.
- Add composable native patterns for media and polished surfaces. Patterns are catalogued SDK contracts.
- Host-managed Widget chrome is applied outside authored content for every Widget. It provides settings, resize, connection metadata, kill/recovery controls, keyboard access, and accessibility labels.
- User runtime preferences persist locally and separately from portable source. Shared source carries declared defaults and responsive rules, not another user’s size, theme selection, lock state, mode, or placement.
- Introduce a domain-neutral shared-channel contract with a stable name, schema version, publisher/subscriber declarations, capability requirements, retained state, event shape, and compatibility rules.
- The host is the only channel broker. Widgets publish commands or state and subscribe to validated snapshots/events; Widgets do not call one another directly.
- Channels expose both a retained snapshot and live events. A new subscriber receives the latest compatible snapshot, then ordered live events.
- Channel access is declared in metadata, checked before runtime, exposed in status/settings, and enforced per Widget. No hidden global state is available.
- The first built-in channel is a generic host-owned media session with Spotify as the initial connector. It must not encode Spotify-only assumptions.
- Authenticated integrations use host-owned connector sessions. Tokens and secrets remain in secure host storage; Widgets receive only contract-shaped state/actions.
- Spotify controller and visualizer Widgets can bind to one host-owned media session while remaining separately crash-isolated and restartable.
- The baseline visualizer consumes honest shared playback state, a monotonic host playback clock, and available metadata. It does not claim raw spectrum data without a permitted source.
- Add an optional audio-band capability. It is unavailable unless the host has a valid permitted source; unavailable state is explicit and never fabricated.
- Tempo controls target visualizer/metronome response rate. Spotify playback speed is not represented as supported by this feature.
- Provider state retains live, silent, and unavailable semantics. Native surfaces own loading, empty, denied, stale, and error presentation.
- Channel fan-out and native updates must respect reduced motion, avoid unbounded update loops, and be measured before enforcement budgets are added.
- Extend the existing highest seam: SDK catalog and types -> check/runtime validation -> worker protocol -> host-owned providers and channel broker -> native SwiftUI renderer and chrome. A primitive or channel is complete only when this vertical slice, documentation, and tests exist.
- Preserve supervisor/worker isolation and last-known-good promotion. Theme or channel failures must not replace the active tree or affect unrelated Widget workers.
- The first acceptance composition is a polished playback controller and separate visualizer sharing one media session, plus an unrelated Widget running concurrently. Killing the visualizer must not affect the controller; recovery must restore the visualizer’s last-known-good state.

## Testing Decisions

- Test observable behavior at the highest seam: SDK declarations and discovery, check diagnostics, host-mediated channel behavior, native rendering, settings chrome, persistence, and process isolation.
- Extend catalog tests for theme tokens, polished pattern schemas, channel declarations, connector sessions, accessibility metadata, reduced motion, and unsupported-style diagnostics.
- Extend runtime validation for declarations, capabilities, schema versions, publisher/subscriber rules, provider availability, and compatibility errors.
- Add protocol tests for retained snapshot delivery, ordered live events, compatibility, denied access, reconnect, stale subscribers, and broker recovery.
- Add native host tests for theme inheritance, explicit overrides, shape hierarchy, resizing, chrome availability, keyboard/accessibility reachability, reduced motion, unavailable visualizer state, and persistence.
- Add integration tests that create two independent Widgets, connect them through one typed channel, relaunch one subscriber, and verify snapshot then live events.
- Add failure tests that terminate one Worker and confirm the host and unrelated Widget remain active, then verify last-known-good recovery.
- Add Spotify connector contract tests for shared session state and playback actions without embedding secrets. Service-level playback unavailability remains explicit.
- Add performance receipts for channel fan-out, visualizer cadence, rendering, memory, and CPU using representative controller, visualizer, and unrelated Widget workloads.
- Prefer existing SDK, runtime, fleet, Worker, preferences, native-host, and contract-test patterns. Test behavior rather than private implementation details.
- The acceptance test is the complete agent lifecycle: discover the catalog, create isolated typed modules, run check --json, run native Widgets, observe shared state, remix theme/layout, move/resize, watch edits, introduce failure, and restore last-known-good.

## Out of Scope

- Arbitrary CSS, DOM, embedded webpages, or webview-based Widget content.
- Direct Widget-to-Widget calls or unscoped global event buses.
- Exposing connector secrets or raw access tokens to Widget source.
- Claiming arbitrary Spotify playback-speed control.
- Fabricating spectrum/audio data without a permitted source.
- A full digital audio workstation, beat-matching engine, or audio editing system.
- Replacing Spotify or other provider applications.
- Marketplace, remote sharing, and hosted Widget execution.
- One-click installation, signing, notarization, updater, and distribution work.
- Final XPC transport decisions; the channel contract remains transport-independent.
- Sharing local theme, size, mode, lock, or placement preferences with another user.

## Further Notes

The visual reference becomes a platform rule: Render should feel like a small native instrument panel, not a generated web dashboard. Spotify is the motivating example, but the design system, host chrome, connector sessions, and shared channels are general Render capabilities.

Deliver this in thin vertical slices on the combined feature branch: semantic theme and host chrome, generic retained-state/live-event channels, shared media session and visualizer pattern, then catalog and end-to-end acceptance fixtures. Preserve the current local-first CLI and SwiftUI/AppKit architecture. MCP remains unnecessary for this contract.
