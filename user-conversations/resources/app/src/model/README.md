# `/model` — Pure Data

Plain TypeScript types and pure functions. This is the **bottom layer**: it has no I/O, no
network, no IndexedDB, and (almost) no dependencies on other layers — so everything here is
trivially unit-testable without mocks. See the [app README](../../README.md) §3 for how this
fits the overall architecture.

## What matters here

- **Keep it pure.** No `fetch`, no `crypto`, no database, no `m.redraw()`. If you reach for a
  side effect, it belongs in `/service`, not here. The payoff is `group.test.ts` /
  `message.test.ts` running with zero setup.
- **One sanctioned upward edge.** `contact.ts` imports a *type* from `../as/actor`. That is the
  only `model → as` reference and it's type-only (erased at build). Don't add runtime
  `as/`/`service/`/`view/` imports here — it would invert the dependency arrows.
- **`group.ts` is the busiest file.** It defines `Group` vs. `EncryptedGroup` (the latter adds
  a ts-mls `ClientState`), the `GroupState` lifecycle enum, the `groupIsEncrypted()` type
  guard the codec-selection logic keys off, and `filterAndSortGroups()` — the pure core of
  sidebar filtering, deliberately extracted from the database so it tests in isolation.
- **`GroupState` rules live in the data, the transitions live in `/service`.** This file
  *names* the states; the rules for moving between them (WELCOME always surfaces; an ARCHIVED
  group revives on a new message) are enforced in `controller.ts` and tested there. Don't
  scatter transition logic into model helpers.
- **`ap-*.ts` are wire shapes, not domain types.** `ap-actor.ts`, `ap-keypackage.ts`,
  `ap-collection.ts` mirror raw ActivityPub payloads; the richer accessors live in `/as`.
