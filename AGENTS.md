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
