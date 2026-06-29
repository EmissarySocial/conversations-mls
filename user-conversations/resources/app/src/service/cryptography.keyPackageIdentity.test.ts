import { expect, test } from 'vitest'
import { type KeyPackage } from 'ts-mls'
import { keyPackageIdentity } from './cryptography'

// keyPackageIdentity extracts the actor ID a KeyPackage's credential claims to belong to.
// Directory.getKeyPackages() uses it to bind a fetched KeyPackage to the actor it was
// requested under, so a hostile instance cannot serve a package claiming another actor's
// identity. A missing or non-"basic" credential yields "" (which never matches a real actor).

// makeKP builds a minimal KeyPackage with the given credential type / identity.
function makeKP(identity: string | undefined, credentialType: number = 1): KeyPackage {
	return {
		cipherSuite: 1,
		leafNode: {
			credential: {
				credentialType,
				identity: identity == undefined ? undefined : new TextEncoder().encode(identity),
			},
		},
	} as unknown as KeyPackage
}

test('returns the decoded credential identity for a basic credential', () => {
	expect(keyPackageIdentity(makeKP('https://alice.example/@alice'))).toBe('https://alice.example/@alice')
})

test('a different identity is returned verbatim (so a bind check can reject it)', () => {
	// A package fetched under alice but claiming mallory must be detectable as a mismatch.
	expect(keyPackageIdentity(makeKP('https://evil.example/@mallory'))).toBe('https://evil.example/@mallory')
})

test('non-basic credential type yields "" (never matches a real actor)', () => {
	// credentialType 2 == x509; not a basic credential, so no actor identity is asserted.
	expect(keyPackageIdentity(makeKP('https://alice.example/@alice', 2))).toBe('')
})

test('missing credential yields ""', () => {
	const kp = { cipherSuite: 1, leafNode: {} } as unknown as KeyPackage
	expect(keyPackageIdentity(kp)).toBe('')
})

test('empty identity yields "" (does not match a real actor id)', () => {
	expect(keyPackageIdentity(makeKP(''))).toBe('')
})
