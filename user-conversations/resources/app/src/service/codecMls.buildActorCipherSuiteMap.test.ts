import { expect, test } from 'vitest'
import { type KeyPackage } from 'ts-mls'
import { buildActorCipherSuiteMap } from './codecMls'
import { CIPHER_X25519_AES128 } from './algorithms'

const SUITE_UNKNOWN = 99999  // not in the algorithms list

test('empty input returns empty map', () => {
	expect(buildActorCipherSuiteMap([])).toEqual(new Map())
})

test('single KeyPackage maps actor to its cipher suite', () => {
	const kp = makeActorKP('https://alice.example/actor', CIPHER_X25519_AES128)
	const result = buildActorCipherSuiteMap([kp])
	expect(result.size).toBe(1)
	expect(result.get('https://alice.example/actor')).toEqual(new Set([CIPHER_X25519_AES128]))
})

test('two KeyPackages from same actor with same suite are deduplicated', () => {
	const kp1 = makeActorKP('https://alice.example/actor', CIPHER_X25519_AES128)
	const kp2 = makeActorKP('https://alice.example/actor', CIPHER_X25519_AES128)
	const result = buildActorCipherSuiteMap([kp1, kp2])
	expect(result.size).toBe(1)
	expect(result.get('https://alice.example/actor')).toEqual(new Set([CIPHER_X25519_AES128]))
})

test('two KeyPackages from different actors produce separate entries', () => {
	const kpA = makeActorKP('https://alice.example/actor', CIPHER_X25519_AES128)
	const kpB = makeActorKP('https://bob.example/actor', CIPHER_X25519_AES128)
	const result = buildActorCipherSuiteMap([kpA, kpB])
	expect(result.size).toBe(2)
	expect(result.get('https://alice.example/actor')).toEqual(new Set([CIPHER_X25519_AES128]))
	expect(result.get('https://bob.example/actor')).toEqual(new Set([CIPHER_X25519_AES128]))
})

test('KeyPackage with no credential identity is skipped', () => {
	const kp = makeActorKP(undefined, CIPHER_X25519_AES128)
	expect(buildActorCipherSuiteMap([kp])).toEqual(new Map())
})

test('KeyPackage with unknown cipher suite is skipped', () => {
	const kp = makeActorKP('https://alice.example/actor', SUITE_UNKNOWN)
	expect(buildActorCipherSuiteMap([kp])).toEqual(new Map())
})

// makeActorKP builds a minimal KeyPackage stub for buildActorCipherSuiteMap tests.
// Only the fields accessed by buildActorCipherSuiteMap (cipherSuite + credential.identity) are populated.
function makeActorKP(actorId: string | undefined, suiteId: number): KeyPackage {
	return {
		cipherSuite: suiteId,
		leafNode: {
			credential: {
				credentialType: 1,
				identity: actorId == undefined ? undefined : new TextEncoder().encode(actorId),
			},
		},
	} as unknown as KeyPackage
}
