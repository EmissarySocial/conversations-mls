import { type AuthenticationService, type Credential, type CredentialBasic, defaultCredentialTypes } from "ts-mls"

import { uint8ArrayToBase64 } from "./utils"

// CredentialBindings is the app's MLS AuthenticationService. ts-mls calls validateCredential()
// only AFTER it has cryptographically verified that the signature key controls the leaf, so the
// only question we answer is the identity↔key binding: "is this asserted identity allowed to use
// this signature key?" That is a pure, local lookup — never a network/directory/liveness check
// (a live published-KeyPackage lookup was the cause of the earlier rollback; see AGENTS.md).
//
// Bindings are recorded as (signature key → actor identity) the moment the key is known-fresh:
// from KeyPackages we fetch to add members (where the identity↔actor bind is enforced), from the
// ratchet tree of every group we load (before that group's messages are processed), and from our
// own KeyPackage at startup and after each rotation.
export class CredentialBindings implements AuthenticationService {

	// Map of base64(signaturePublicKey) → actor identity.
	readonly #bindings = new Map<string, string>()

	// When true, validateCredential trusts-on-first-use: it records the asserted identity for an
	// unknown key and accepts it, instead of rejecting. This is needed ONLY while joining a group
	// from a Welcome message, where ts-mls validates the entire (encrypted) ratchet tree during
	// the joinGroup() call — so we cannot have pre-registered those leaves. The Welcome's
	// authenticity is established separately (it was encrypted for THIS device). Outside of a
	// join, this stays false and validation is strict.
	#bootstrap = false

	// register records that `identity` is the actor bound to `signaturePublicKey`. A later
	// re-registration with a DIFFERENT identity for the same key is rejected and logged — keys
	// are per-leaf and must not be reassigned to a new identity.
	register(signaturePublicKey: Uint8Array, identity: string): void {

		if (identity == "") {
			return
		}

		const key = uint8ArrayToBase64(signaturePublicKey)
		const existing = this.#bindings.get(key)

		if (existing != undefined && existing != identity) {
			console.warn("CredentialBindings: refusing to rebind a signature key to a new identity", existing, "->", identity)
			return
		}

		this.#bindings.set(key, identity)
	}

	// registerLeaf records the binding carried by a single ratchet-tree / KeyPackage leaf node
	// (a {credential, signaturePublicKey} pair). Non-basic credentials carry no actor identity
	// and are ignored.
	registerLeaf(leaf: { credential: Credential; signaturePublicKey: Uint8Array }): void {

		if (leaf.credential.credentialType != defaultCredentialTypes.basic) {
			return
		}

		const identity = new TextDecoder().decode((leaf.credential as CredentialBasic).identity)
		this.register(leaf.signaturePublicKey, identity)
	}

	// withBootstrap runs `fn` with trust-on-first-use enabled (see #bootstrap), restoring strict
	// validation afterward even if `fn` throws. Wrap the joinGroup() call in this.
	//
	// CAUTION: #bootstrap is an instance flag that spans `fn`'s `await`. While it is set, ANY
	// validateCredential on this instance trusts-on-first-use — so no OTHER MLS operation may run
	// on this codec during the window, or it could accept an unknown key it should reject. The
	// reentrancy guard below makes an overlapping bootstrap fail loudly instead of silently
	// widening the trust window; the caller is responsible for not interleaving other codec ops
	// (the receive path that drives joins is serialized by the receiver's poll lock).
	async withBootstrap<T>(fn: () => Promise<T>): Promise<T> {

		if (this.#bootstrap) {
			throw new Error("CredentialBindings.withBootstrap: already bootstrapping (concurrent join not allowed)")
		}

		this.#bootstrap = true
		try {
			return await fn()
		} finally {
			this.#bootstrap = false
		}
	}

	// validateCredential is the ts-mls hook. It returns TRUE iff the credential is a basic
	// credential whose asserted identity matches the identity we have on record for this
	// (already-signature-verified) signature key. During a bootstrap join, an unknown key is
	// recorded and accepted instead (trust-on-first-use); a CONFLICTING known binding is always
	// rejected, even during bootstrap.
	async validateCredential(credential: Credential, signaturePublicKey: Uint8Array): Promise<boolean> {

		// Only basic credentials carry an actor identity.
		if (credential.credentialType != defaultCredentialTypes.basic) {
			return false
		}

		const asserted = new TextDecoder().decode((credential as CredentialBasic).identity)

		if (asserted == "") {
			return false
		}

		const bound = this.#bindings.get(uint8ArrayToBase64(signaturePublicKey))

		// No binding on record: reject in steady state. During a bootstrap join, trust-on-first-use
		// and record the binding so subsequent (strict) validations of this key succeed.
		if (bound == undefined) {

			if (this.#bootstrap) {
				this.register(signaturePublicKey, asserted)
				return true
			}

			console.warn("CredentialBindings: no binding on record for signature key asserting identity", asserted)
			return false
		}

		return bound == asserted
	}
}
