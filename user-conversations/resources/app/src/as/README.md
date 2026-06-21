# `/as` — ActivityStreams Object Model

Typed, lazy wrappers over the wildly-polymorphic JSON that ActivityPub actually puts on the
wire. `ASObject` (`object.ts`) is the base; `Document`, `Activity`, `Actor`, `Collection`
extend it. See the [app README](../../README.md) §3 for context.

## What matters here

- **`convert.ts` is the load-bearing file — read it before debugging any "why is this field
  wrong?" bug.** AP values are maddeningly polymorphic: a single property may be a string id,
  an embedded object, an array of either, or absent. `toString` / `toInteger` / `toArray` /
  `toMap` coerce all of that into predictable shapes. Most "the data looks wrong" issues are a
  coercion edge case here, not a logic bug upstream.
- **Accessor methods, not fields.** You call `document.content()`, `activity.actorId()` — not
  `document.content`. Add new properties as accessors that go through `convert.ts`, so the
  polymorphism stays handled in exactly one place.
- **Sync vs. async access is a real distinction, not a style choice.**
  - `objectAsDocument()` / `objectAsMap()` read an **embedded** object with **no** network
    fetch — safe to call in synchronous render code.
  - `object()` / `attributedTo()` / `inReplyTo()` may **fetch by id** over the network.
  - MLS objects are always embedded, which is *why* `isMlsActivity()` can decide
    synchronously. Don't "simplify" a sync accessor into the fetching variant.
- **Remote fetches go through the host proxy, never directly.** `loaders.ts` / the `Proxy`
  service fetch via the actor's `endpoints.proxyUrl` (the browser can't sign HTTP requests; the
  server does). Anything that resolves a remote URL must carry the proxy URL
  (`.withProxy(...)`).
- **Codec selection is a header check that lives here.** `Document.isMlsDocument()` decides
  MLS-vs-plaintext purely from `mediaType: message/mls` + `encoding: base64` + non-empty
  `content`. The vocab constants are in `vocab.ts`. If you change those headers, you change
  routing — see the [app README](../../README.md) §4.
