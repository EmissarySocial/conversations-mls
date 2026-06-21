# `/service` — Logic and Side Effects

All cross-cutting logic and every side effect (network, IndexedDB, crypto, redraws). Home of
the orchestrating `Controller` and the injectable services it coordinates. See the
[app README](../../README.md) §4 for the full interface table.

## What matters here

- **`controller.ts` is the orchestrator and the god-object we're splitting.** It owns app
  state and wires services together. A view-layer façade (`view/controller.ts`, `ViewController`)
  now sits in front of it; pure-UI concerns are being migrated out incrementally. When adding
  to the controller, ask: *is this a backend action or a presentation concern?* Presentation
  (page/modal state, reply composition, redraw-only methods) is destined for `ViewController`.
- **Depend on interfaces, not implementations.** Services are injected into the `Controller`
  as `I*` interfaces from `interfaces.ts` (`ICodec`, `IDatabase`, `IDelivery`, `IDirectory`,
  `IReceiver`, `IProxy`, `IHost`, `IWebFinger`, `IContacts`). That indirection is what makes
  the controller testable — keep new collaborators behind an interface.
- **`ICodec.receiveActivity()` returning `undefined` is a meaningful signal**, not an
  error or empty result: it means *"no-op, already fully handled"* (e.g. an MLS Welcome). Don't
  treat `undefined` as a failure path. See [app README](../../README.md) §7.
- **The inbound `receiveActivity` retry + `return await` rule is load-bearing.** Handlers are
  dispatched with `return await this.#handler(...)`, never bare `return`, so a rejected handler
  is caught by the retry loop (every 2s, up to 1 min — absorbs out-of-order delivery). A bare
  `return` of a rejected promise escapes the `try/catch` and silently disables retries. This is
  commented inline; preserve it.
- **`host.ts` is the only Emissary-specific seam.** Porting to another host = reimplement
  `IHost`. Don't let host-specific assumptions (htmx, specific routes) leak into other services.
- **Crypto stays on the device.** `cryptography.ts` + the `Database` encryption layer keep keys
  and group state local; the passcode-derived AES key is cached only in `sessionStorage`. Never
  send key material to the server. The codecs (`codecMls.ts` / `codecPlaintext.ts`) are the only
  things that should touch ciphertext.
