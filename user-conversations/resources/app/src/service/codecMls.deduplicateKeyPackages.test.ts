import { expect, test } from 'vitest'
import { type KeyPackage } from 'ts-mls'
import { deduplicateKeyPackages } from './codecMls'

const deviceA = new Uint8Array([0x01, 0x02, 0x03])
const deviceB = new Uint8Array([0x04, 0x05, 0x06])

test('empty input returns empty array', () => {
	expect(deduplicateKeyPackages([])).toEqual([])
})

test('single KeyPackage is returned unchanged', () => {
	const kp = makeKP(deviceA, 1000n)
	expect(deduplicateKeyPackages([kp])).toEqual([kp])
})

test('two KeyPackages from different devices are both returned', () => {
	const kpA = makeKP(deviceA, 1000n)
	const kpB = makeKP(deviceB, 2000n)
	const result = deduplicateKeyPackages([kpA, kpB])
	expect(result).toHaveLength(2)
	expect(result).toContain(kpA)
	expect(result).toContain(kpB)
})

test('two KeyPackages from the same device: keeps the one with the later notAfter', () => {
	const older = makeKP(deviceA, 1000n)
	const newer = makeKP(deviceA, 2000n)
	const result = deduplicateKeyPackages([older, newer])
	expect(result).toHaveLength(1)
	expect(result[0]).toBe(newer)
})

test('order does not matter: newer first still wins', () => {
	const older = makeKP(deviceA, 1000n)
	const newer = makeKP(deviceA, 2000n)
	const result = deduplicateKeyPackages([newer, older])
	expect(result).toHaveLength(1)
	expect(result[0]).toBe(newer)
})

test('KeyPackage with no lifetime loses to one with any notAfter', () => {
	const noLifetime = makeKP(deviceA)
	const withLifetime = makeKP(deviceA, 1n)
	const result = deduplicateKeyPackages([noLifetime, withLifetime])
	expect(result).toHaveLength(1)
	expect(result[0]).toBe(withLifetime)
})

test('mixed devices: deduplicates per device independently', () => {
	const a1 = makeKP(deviceA, 1000n)
	const a2 = makeKP(deviceA, 3000n)
	const b1 = makeKP(deviceB, 2000n)
	const result = deduplicateKeyPackages([a1, b1, a2])
	expect(result).toHaveLength(2)
	expect(result).toContain(a2)
	expect(result).toContain(b1)
})

// makeKP builds a minimal KeyPackage stub for deduplicateKeyPackages tests.
// Only the fields accessed by deduplicateKeyPackages (signaturePublicKey + lifetime.notAfter) are populated.
function makeKP(signaturePublicKey: Uint8Array, notAfter?: bigint): KeyPackage {
	return {
		leafNode: {
			signaturePublicKey,
			lifetime: notAfter == undefined ? undefined : { notBefore: 0n, notAfter },
		},
	} as unknown as KeyPackage
}
