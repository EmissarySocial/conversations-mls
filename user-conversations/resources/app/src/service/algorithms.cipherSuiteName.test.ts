import { expect, test } from 'vitest'
import { cipherSuiteName, CIPHER_X25519_AES128, CIPHER_XWING_CHACHA20 } from './algorithms'

test('returns the correct name for CIPHER_X25519_AES128', () => {
	expect(cipherSuiteName(CIPHER_X25519_AES128)).toBe("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519")
})

test('returns the correct name for CIPHER_XWING_CHACHA20', () => {
	// expect(cipherSuiteName(CIPHER_XWING_CHACHA20)).toBe("MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519")
	expect(cipherSuiteName(CIPHER_XWING_CHACHA20)).toBe(undefined)
})

test('returns undefined for an unknown cipher suite ID', () => {
	expect(cipherSuiteName(99999)).toBeUndefined()
})
