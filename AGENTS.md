# AGENTS.md

Notes for AI agents and humans working in this repository.

## Received-message sender identity (MLS)

When the client receives an MLS-encrypted activity, three "sender" identities are
involved. Only one of them is cryptographically authenticated:

| | Identity | Source | Trust |
|---|---|---|---|
| **A** | Outer ActivityPub `attributedTo` on the envelope | `document.attributedToId()` | Untrusted JSON. Authenticated indirectly by the **HTTP signature** on the inbound request. |
| **B** | MLS leaf credential identity of the authenticated sender | the sender leaf in `clientState`'s ratchet tree | **Cryptographically authenticated** by MLS. |
| **C** | Inner `actor` / `attributedTo` in the decrypted activity | `result.actorId()` | Untrusted JSON (inside the ciphertext). |

**The goal is to require `A == B == C`.**

### Current state (interim)

We enforce **`A == C`** at the codec boundary in
`service/codecMls.ts` → `#receiveActivity_PublicPrivateMessage`, via the exported
`senderIdentityMatches()` helper. Combined with HTTP-signature verification of **A**,
this prevents the trivial spoof where a sender attributes a message to a different actor.

We do **not** yet bind to **B**. `ts-mls` (currently `2.0.0-rc.11`) does not expose the
authenticated sender leaf index on application-message results, and for *private* messages
the leaf index is inside the encrypted `senderData` and is not reachable through the public
API. A request has been filed with the `ts-mls` author. When `ts-mls` surfaces the sender
leaf, add the **B** binding:

1. get the sender leaf index from the processed message,
2. look up the leaf node in `group.clientState`'s ratchet tree
   (`getCredentialFromLeafIndex` looks usable),
3. decode the credential identity and assert it equals **A** and **C**.

### ⚠️ Retry handling caveat — re-check when retries are reworked

`controller.ts` → `receiveActivity` currently treats **every** thrown error as transient and
**retries up to 30 times (every 2s)**. The sender-identity mismatch in `codecMls.ts` throws,
so a forged/mismatched message will retry-loop for ~1 minute before being dropped. This is
wasteful but not dangerous (such a message is never stored).

A sender-identity mismatch is a **permanent** failure, not a transient one. When the retry
logic is reworked, make identity mismatches a hard-drop (no retry). Audit the throw sites in
`#receiveActivity_PublicPrivateMessage` at that time.

## Attachment URLs (untrusted → href/src)

Inbound attachment URLs are attacker-controlled and do **not** pass through HTML
sanitization (unlike message `content`, which DOMPurify cleans) — they bind directly into
`<a href>` / `<img|video|audio src>`. The scheme allowlist lives at the parse boundary in
`as/document.ts` → `isSafeAttachmentURL()`, called from `parseAttachment()` (the sole place
inbound attachments become typed `Attachment` objects). Disallowed-scheme attachments are
dropped at ingestion, so no `javascript:`/`vbscript:` URL ever reaches a sink.

Keep this guard in the parser, not in callers: locally-created attachments (file picker,
`data:` URIs) and legacy DB rehydration do not pass through `parseAttachment`, and a future
new caller of `Document.attachments()` must not be able to reintroduce the gap. Allowed
schemes: `https:`, `http:`, `data:`, `blob:`.

## MLS credential authentication (`AuthenticationService` / `validateCredential`)

`service/credentialBindings.ts` (`CredentialBindings`) is the MLS `AuthenticationService` wired
into the codec's `#context()`. ts-mls calls `validateCredential` only AFTER it has proven the
signature key controls the leaf, so the hook answers ONE thing: "is this asserted identity bound
to this signature key?" — a **pure local lookup, never a network/directory/liveness check.**

**Do not** make it fetch published KeyPackages to check liveness (an earlier attempt did, and was
rolled back): published KeyPackages are single-use, rotated, and remote, so that rejects your own
rotated key and legitimate members. Bindings are instead registered when a key is known-fresh —
from fetched (KP2-validated) KeyPackages in `addGroupMembers`, from the ratchet tree in
`#registerGroupBindings` before each `processMessage`, and for self at construction / on rotation.
Joining from a Welcome runs under `withBootstrap` (trust-on-first-use; the Welcome's authenticity
is established by the private-key match) because ts-mls validates the encrypted tree during the
`joinGroup` call. The rolled-back network-lookup version (`service/authService.ts`,
`ActivityPubAuthenticationService`) has been deleted — do not reintroduce it.

## Plaintext-group membership authorization (KNOWN GAP — deferred)

The **plaintext** (unencrypted) receive path does not authorize inbound activities against group
membership. The *identity* of the sender is sound — the emissary server's inbox verifies HTTP
signatures and binds the signed key to the activity's `actor` (hannibal `HTTPSig` validator), so
`activity.actorId()` cannot be spoofed. What is missing is the **authorization** question — "is
this authenticated actor allowed to act on this group?" — which the server intentionally leaves to
the client (it delivers any direct message to any user, by design):

- **P1 — `Like`/reaction** (`#receiveActivity_Like`): a reaction from a non-member is recorded.
  Attribution is correct (authenticated actor), so impact is minor.
- **P2 — `Acknowledge`** (`#receiveActivity_Acknowledge`): a read-receipt from a non-member is
  pushed to `message.received[]`. Attribution is correct; impact is minor.
- **P3 — `Create`/`Update`** (`codecPlaintext.ts` `#receiveActivity_CreateOrUpdateGroup` →
  `#findNewGroupMembers`): a `Create` resolving (via `context` or `inReplyTo`) to an **existing**
  plaintext group whose sender is NOT a member injects a message into that conversation AND
  silently **auto-adds the sender** to the member list. This is the meaningful one (an
  authenticated stranger joins an existing private conversation and receives future messages).
  MLS groups are unaffected — membership there is cryptographic (ratchet tree + `validateCredential`).

**Deferred deliberately.** These are common-sense rules for a *private group discussion*, but
ActivityPub "direct messages" are tricky and we must interoperate with existing tools that will
NOT follow these conventions (e.g. a first message from someone you have never grouped with is how
a new conversation legitimately begins). A naive "reject non-members" rule would break that
bootstrapping and cross-tool interop. The eventual fix must distinguish **new-conversation
bootstrapping** (first contact → allowed) from **posting into / joining an EXISTING group**
(sender must already be a member → otherwise reject or quarantine), and be validated against real
federated peers (Mastodon, Bonfire, etc.) before turning it on.
