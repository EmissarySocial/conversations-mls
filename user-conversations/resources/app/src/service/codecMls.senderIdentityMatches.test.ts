import { expect, test } from 'vitest'
import { senderIdentityMatches } from './codecMls'

// senderIdentityMatches binds the decrypted activity's actor (C) to the outer
// ActivityPub envelope's attributedTo (A). Both are attacker-authored and MUST
// agree before a received MLS message is trusted. See AGENTS.md for the full model.

test('matching identities are accepted', () => {
	expect(senderIdentityMatches('https://alice.example/actor', 'https://alice.example/actor')).toBe(true)
})

test('mismatched identities are rejected (spoofed sender)', () => {
	// Mallory sends a message but attributes it to Alice in the decrypted activity.
	expect(senderIdentityMatches('https://alice.example/actor', 'https://mallory.example/actor')).toBe(false)
})

test('empty decrypted actor is never trusted', () => {
	expect(senderIdentityMatches('', 'https://alice.example/actor')).toBe(false)
})

test('empty envelope attributedTo is never trusted', () => {
	expect(senderIdentityMatches('https://alice.example/actor', '')).toBe(false)
})

test('two empty identities do not match (not a vacuous pass)', () => {
	expect(senderIdentityMatches('', '')).toBe(false)
})

test('comparison is exact (no normalization of trailing slash)', () => {
	// We require exact equality; near-misses must be rejected rather than silently
	// normalized, since either side could be attacker-controlled.
	expect(senderIdentityMatches('https://alice.example/actor', 'https://alice.example/actor/')).toBe(false)
})
