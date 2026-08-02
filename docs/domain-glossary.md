# Render domain glossary

Ubiquitous language for the Render project. Terms are added as they crystallize in design sessions. This document contains domain definitions, not implementation details.

> Naming note: the source document calls the portable format a `.render` file in its heading and refers to `.weave` in the body. That naming decision remains unresolved; both references are preserved here until the project chooses one.

## Widget

A self-contained, always-available surface living on the desktop layer. A Widget can be a live data display such as a clock, visualizer, or graph; an interactive control such as a media controller or todo list; or a tiny self-contained app such as a pomodoro, chat overlay, or simple game.

Embedded live web content, meaning a rendered webpage, is not a Widget. Widgets reach the web through APIs rather than embedding pages. Web embedding is very low priority and likely cut because APIs remove most of the need for it.

## Provider

A data source collected once by the host and fanned out to every subscribed Widget, such as system stats, media, time, or weather. Providers are shared and curated. They are distinct from a Widget's direct API access, which is per-Widget and declared.

## Provider availability

A Provider is either live, silent, or unavailable:

- **Live**: the host is producing data.
- **Silent**: no current value is available, which is valid live behavior.
- **Unavailable**: the host cannot honestly collect the source because the OS, hardware, permission, or route is missing.

An unavailable Provider sends no fabricated live frames. Platform permission language stays in host diagnostics and setup UX rather than entering Widget source.

## Renderer

The internal path that turns a Widget's retained display operations into pixels and presents them on its OS surface. Renderer policy is platform-owned: the healthy path, reference or fallback path, resource lifetime, and any helper process may differ by OS, but Widget source and the public SDK never do. Performance accounting includes every participating Widget, host, and renderer process.

## Standard surface

What a Widget may do without additional user-facing consent:

- Subscribe to Providers.
- Call network origins declared in its manifest.
- Keep its own scoped key-value state.

## The Loop

Render's core product motion is three verbs on one flywheel:

- **Conjure**: prompt your agent and a Widget appears on your desktop.
- **Share**: send the Widget, which is always its source.
- **Remix**: have your agent patch someone else's Widget to your taste.

Each verb's output is the next verb's input. None stands alone; building Conjure should make Share and Remix nearly free.

## Conjure

Creating a Widget by prompting your own agent, from prompt to desktop in under a minute. This is the primary authoring act in Render; hand-writing Widget code is the special case, not the norm.

## Portable Widget file

The portable, shareable form of a Widget: readable source and assets plus an auditable declared surface, provenance, and lineage. It is never a compiled artifact or a pointer to its author's workspace. Opening the file means reading the Widget. The exact extension remains unresolved; see the naming note above.

## Installed Widget

A Widget Render has accepted into the local library. Its runnable source is a Render-owned copy made from a portable Widget file, never the sender's working directory. Changing it begins a Remix.

## Remix

The act of personalizing someone else's Widget by having your agent patch its source - restyling it, resizing it, or rewiring its data. Remixing is Render's answer to personalization; there is no global theming system. The author's shipped look is the intended vision. Making it yours is a Remix, not a runtime override.

## System capability

Anything that touches the user's machine beyond the Standard surface. Capabilities form a ladder rather than one bucket:

1. Notifications - harmless.
2. Launching an app or opening a URL - mild.
3. Running commands or reading arbitrary files - dangerous.

The dangerous rungs exist but require loud, explicit, per-Widget consent. Render deliberately rejects the incumbent posture where skins can simply do anything.
