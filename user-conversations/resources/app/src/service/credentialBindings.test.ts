import { expect, test } from 'vitest'
import { type Credential } from 'ts-mls'
import { CredentialBindings } from './credentialBindings'

// CredentialBindings is the MLS AuthenticationService. ts-mls has already proven the signature
// key controls the leaf before calling validateCredential, so these tests cover the identity↔key
// binding predicate: known-match accepts, mismatch / unknown / non-basic / empty rejects, and the
// bootstrap (trust-on-first-use) path used while joining a group.

// basicCredential builds a ts-mls "basic" credential carrying the given actor identity.
function basicCredential(identity: string): Credential {
	return {
		credentialType: 1, // defaultCredentialTypes.basic
		identity: new TextEncoder().encode(identity),
	} as unknown as Credential
}

const KEY_A = new Uint8Array([1, 2, 3, 4])
const KEY_B = new Uint8Array([5, 6, 7, 8])
const ALICE = 'https://alice.example/@alice'
const MALLORY = 'https://evil.example/@mallory'

test('a registered binding validates its own identity', async () => {
	const store = new CredentialBindings()
	store.register(KEY_A, ALICE)
	expect(await store.validateCredential(basicCredential(ALICE), KEY_A)).toBe(true)
})

test('a key bound to Alice rejects a credential claiming Mallory (impersonation)', async () => {
	const store = new CredentialBindings()
	store.register(KEY_A, ALICE)
	expect(await store.validateCredential(basicCredential(MALLORY), KEY_A)).toBe(false)
})

test('an unknown key is rejected in steady state', async () => {
	const store = new CredentialBindings()
	expect(await store.validateCredential(basicCredential(ALICE), KEY_A)).toBe(false)
})

test('non-basic credential is rejected', async () => {
	const store = new CredentialBindings()
	store.register(KEY_A, ALICE)
	const x509 = { credentialType: 2, identity: new TextEncoder().encode(ALICE) } as unknown as Credential
	expect(await store.validateCredential(x509, KEY_A)).toBe(false)
})

test('empty asserted identity is rejected', async () => {
	const store = new CredentialBindings()
	store.register(KEY_A, ALICE)
	expect(await store.validateCredential(basicCredential(''), KEY_A)).toBe(false)
})

test('register refuses to rebind a key to a different identity', async () => {
	const store = new CredentialBindings()
	store.register(KEY_A, ALICE)
	store.register(KEY_A, MALLORY) // ignored
	expect(await store.validateCredential(basicCredential(ALICE), KEY_A)).toBe(true)
	expect(await store.validateCredential(basicCredential(MALLORY), KEY_A)).toBe(false)
})

test('registerLeaf records the leaf credential↔key binding', async () => {
	const store = new CredentialBindings()
	store.registerLeaf({ credential: basicCredential(ALICE), signaturePublicKey: KEY_A })
	expect(await store.validateCredential(basicCredential(ALICE), KEY_A)).toBe(true)
})

test('bootstrap trusts an unknown key on first use and records it for later strict checks', async () => {
	const store = new CredentialBindings()

	const result = await store.withBootstrap(async () => {
		// During bootstrap an unknown key is accepted...
		return store.validateCredential(basicCredential(ALICE), KEY_A)
	})
	expect(result).toBe(true)

	// ...and the binding persists, so it now validates strictly (outside bootstrap).
	expect(await store.validateCredential(basicCredential(ALICE), KEY_A)).toBe(true)
	// ...while a different identity for that key is now rejected.
	expect(await store.validateCredential(basicCredential(MALLORY), KEY_A)).toBe(false)
})

test('bootstrap still rejects a credential that CONFLICTS with an existing binding', async () => {
	const store = new CredentialBindings()
	store.register(KEY_A, ALICE)

	const result = await store.withBootstrap(async () =>
		store.validateCredential(basicCredential(MALLORY), KEY_A)
	)
	expect(result).toBe(false)
})

test('bootstrap mode is restored to strict after withBootstrap, even on throw', async () => {
	const store = new CredentialBindings()

	await expect(store.withBootstrap(async () => { throw new Error('boom') })).rejects.toThrow('boom')

	// Strict again: an unknown key is rejected.
	expect(await store.validateCredential(basicCredential(ALICE), KEY_B)).toBe(false)
})
