import { test, expect, describe } from 'vitest'

// The as/* layer reads a global Temporal; install the polyfill for the test env.
import { Temporal } from "@js-temporal/polyfill"
;(globalThis as any).Temporal ??= Temporal

import { Document } from "../as/document"
import {
	generateAESKey,
	deriveKeyFromPassword,
	wrapKey,
	unwrapKey,
	encodeKeyToBase64,
	decodeKeyFromBase64,
	keyPackageIsExpired,
	keyPackageIsSupported,
	shouldRefreshKeyPackage,
	decodeKeyPackage,
	cipherSuiteImplementation,
	newKeyPackage,
} from "./cryptography"

// A 16-byte salt/IV is the minimum the WebCrypto helpers require.
function bytes(length: number, fill = 7): ArrayBuffer {
	return new Uint8Array(length).fill(fill).buffer
}

/******************************************
 * WebCrypto: AES key generation
 ******************************************/

describe("generateAESKey", () => {

	test("produces an extractable AES-GCM 256 key", async () => {
		const key = await generateAESKey()
		expect(key.type).toBe("secret")
		expect(key.extractable).toBe(true)
		expect((key.algorithm as AesKeyAlgorithm).name).toBe("AES-GCM")
		expect((key.algorithm as AesKeyAlgorithm).length).toBe(256)
		expect(key.usages).toContain("encrypt")
		expect(key.usages).toContain("decrypt")
	})

	test("produces a different key each time", async () => {
		const a = await encodeKeyToBase64(await generateAESKey())
		const b = await encodeKeyToBase64(await generateAESKey())
		expect(a).not.toBe(b)
	})
})

/******************************************
 * WebCrypto: base64 key round-trip
 ******************************************/

describe("encodeKeyToBase64 / decodeKeyFromBase64", () => {

	test("round-trips an AES key back to the same bytes", async () => {
		const original = await generateAESKey()
		const encoded = await encodeKeyToBase64(original)
		expect(typeof encoded).toBe("string")
		expect(encoded.length).toBeGreaterThan(0)

		const decoded = await decodeKeyFromBase64(encoded)
		const reencoded = await encodeKeyToBase64(decoded)
		expect(reencoded).toBe(encoded)
	})

	test("a decoded key can decrypt data encrypted by the original", async () => {
		const original = await generateAESKey()
		const decoded = await decodeKeyFromBase64(await encodeKeyToBase64(original))

		const iv = crypto.getRandomValues(new Uint8Array(12))
		const plaintext = new TextEncoder().encode("secret message")
		const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, original, plaintext)
		const recovered = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, decoded, ciphertext)

		expect(new TextDecoder().decode(recovered)).toBe("secret message")
	})
})

/******************************************
 * WebCrypto: password-derived key + wrap/unwrap
 ******************************************/

describe("deriveKeyFromPassword", () => {

	test("rejects a salt shorter than 16 bytes", async () => {
		await expect(deriveKeyFromPassword("passcode", bytes(8))).rejects.toThrow(/Salt must be at least 16 bytes/)
	})

	test("derives a wrapping key for a 16-byte salt", async () => {
		const key = await deriveKeyFromPassword("passcode", bytes(16))
		expect(key.usages).toContain("wrapKey")
		expect(key.usages).toContain("unwrapKey")
	})

	test("the same password + salt derive an interchangeable key", async () => {
		const salt = bytes(16)
		const iv = bytes(16)
		const encryptionKey = await generateAESKey()

		const wrappingA = await deriveKeyFromPassword("hunter2", salt)
		const wrappingB = await deriveKeyFromPassword("hunter2", salt)

		// A key wrapped with one derivation can be unwrapped with the other
		const wrapped = await wrapKey(encryptionKey, wrappingA, iv)
		const unwrapped = await unwrapKey(wrapped, wrappingB, iv)

		expect(await encodeKeyToBase64(unwrapped)).toBe(await encodeKeyToBase64(encryptionKey))
	})

	test("a different password cannot unwrap the key", async () => {
		const salt = bytes(16)
		const iv = bytes(16)
		const encryptionKey = await generateAESKey()

		const rightKey = await deriveKeyFromPassword("correct", salt)
		const wrongKey = await deriveKeyFromPassword("wrong", salt)

		const wrapped = await wrapKey(encryptionKey, rightKey, iv)
		await expect(unwrapKey(wrapped, wrongKey, iv)).rejects.toThrow()
	})
})

describe("wrapKey / unwrapKey", () => {

	test("round-trips the encryption key", async () => {
		const salt = bytes(16, 3)
		const iv = bytes(16, 9)
		const wrappingKey = await deriveKeyFromPassword("pw", salt)
		const encryptionKey = await generateAESKey()

		const wrapped = await wrapKey(encryptionKey, wrappingKey, iv)
		expect(wrapped.byteLength).toBeGreaterThan(0)

		const unwrapped = await unwrapKey(wrapped, wrappingKey, iv)
		expect(unwrapped.extractable).toBe(true)
		expect(await encodeKeyToBase64(unwrapped)).toBe(await encodeKeyToBase64(encryptionKey))
	})

	test("unwrapping with the wrong IV fails", async () => {
		const salt = bytes(16)
		const wrappingKey = await deriveKeyFromPassword("pw", salt)
		const encryptionKey = await generateAESKey()

		const wrapped = await wrapKey(encryptionKey, wrappingKey, bytes(16, 1))
		await expect(unwrapKey(wrapped, wrappingKey, bytes(16, 2))).rejects.toThrow()
	})
})

/******************************************
 * KeyPackage logic (pure)
 ******************************************/

// makeKeyPackage builds a minimal KeyPackage-shaped object with the given lifetime
// window (epoch seconds). Only the fields these functions read are populated.
function makeKeyPackage(notBefore: bigint, notAfter: bigint): any {
	return {
		leafNode: {
			lifetime: { notBefore, notAfter },
			credential: {
				credentialType: 1, // defaultCredentialTypes.basic
				identity: new TextEncoder().encode("https://example.test/users/me"),
			},
		},
	}
}

describe("keyPackageIsExpired", () => {

	const now = BigInt(Math.floor(Date.now() / 1000))

	test("returns true for a null key package", () => {
		expect(keyPackageIsExpired(null as any)).toBe(true)
	})

	test("returns true when the lifetime is missing", () => {
		// A real package always has a credential; only the lifetime is absent here.
		const noLifetime = {
			leafNode: {
				credential: {
					credentialType: 1,
					identity: new TextEncoder().encode("https://example.test/users/me"),
				},
			},
		}
		expect(keyPackageIsExpired(noLifetime as any)).toBe(true)
	})

	test("returns true (does not throw) for a malformed package with no lifetime or credential", () => {
		// keyPackageIsExpired logs the identity when the lifetime is missing; that
		// must not crash even when the credential is also absent.
		expect(keyPackageIsExpired({ leafNode: {} } as any)).toBe(true)
	})

	test("returns true when notBefore is in the future", () => {
		expect(keyPackageIsExpired(makeKeyPackage(now + 3600n, now + 7200n))).toBe(true)
	})

	test("returns true when notAfter is in the past", () => {
		expect(keyPackageIsExpired(makeKeyPackage(now - 7200n, now - 3600n))).toBe(true)
	})

	test("returns false for a currently-valid lifetime", () => {
		expect(keyPackageIsExpired(makeKeyPackage(now - 3600n, now + 3600n))).toBe(false)
	})
})

describe("shouldRefreshKeyPackage", () => {

	test("returns true when published is more than 48 hours ago", () => {
		const doc = new Document({ type: "KeyPackage", published: "2000-01-01T00:00:00Z" })
		expect(shouldRefreshKeyPackage(doc)).toBe(true)
	})

	test("returns false when published is recent", () => {
		const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
		const doc = new Document({ type: "KeyPackage", published: recent })
		expect(shouldRefreshKeyPackage(doc)).toBe(false)
	})
})

// supportedDoc builds a KeyPackage document with valid defaults, overridable per test.
function supportedDoc(overrides: Record<string, any> = {}): Document {
	return new Document({
		type: "KeyPackage",
		mediaType: "message/mls",
		encoding: "base64",
		ciphersuite: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
		...overrides,
	})
}

describe("keyPackageIsSupported", () => {

	test("accepts a well-formed KeyPackage document", () => {
		expect(keyPackageIsSupported(supportedDoc())).toBe(true)
	})

	test("rejects a document with the wrong type", () => {
		expect(keyPackageIsSupported(supportedDoc({ type: "Note" }))).toBe(false)
	})

	test("rejects a document with the wrong mediaType", () => {
		expect(keyPackageIsSupported(supportedDoc({ mediaType: "text/plain" }))).toBe(false)
	})

	test("rejects a document with the wrong encoding", () => {
		expect(keyPackageIsSupported(supportedDoc({ encoding: "hex" }))).toBe(false)
	})

	test("rejects an unsupported ciphersuite", () => {
		expect(keyPackageIsSupported(supportedDoc({ ciphersuite: "MLS_BOGUS_SUITE" }))).toBe(false)
	})
})

describe("decodeKeyPackage validation", () => {

	test("throws when the document type is wrong", () => {
		const doc = new Document({ type: "Note", mediaType: "message/mls", encoding: "base64", content: "AAAA" })
		expect(() => decodeKeyPackage(doc)).toThrow(/type 'KeyPackage'/)
	})

	test("throws when the mediaType is wrong", () => {
		const doc = new Document({ type: "KeyPackage", mediaType: "text/plain", encoding: "base64", content: "AAAA" })
		expect(() => decodeKeyPackage(doc)).toThrow(/mediaType 'message\/mls'/)
	})

	test("throws when the encoding is wrong", () => {
		const doc = new Document({ type: "KeyPackage", mediaType: "message/mls", encoding: "hex", content: "AAAA" })
		expect(() => decodeKeyPackage(doc)).toThrow(/encoding 'base64'/)
	})

	test("throws when the content is not a decodable KeyPackage", () => {
		const doc = new Document({ type: "KeyPackage", mediaType: "message/mls", encoding: "base64", content: "AAAA" })
		expect(() => decodeKeyPackage(doc)).toThrow(/Unable to decode KeyPackage/)
	})
})

/******************************************
 * MLS ciphersuite + key package generation (real ts-mls)
 ******************************************/

describe("MLS key package generation", () => {

	test("cipherSuiteImplementation returns a usable ciphersuite", async () => {
		const suite = await cipherSuiteImplementation()
		expect(suite).toBeDefined()
	})

	test("newKeyPackage produces a public + private package for the actor", async () => {
		const actorId = "https://example.test/users/me"
		const { publicPackage, privatePackage } = await newKeyPackage(actorId)

		expect(publicPackage).toBeDefined()
		expect(privatePackage).toBeDefined()

		// The credential identity round-trips back to the actor ID
		const identity = new TextDecoder().decode((publicPackage.leafNode.credential as any).identity)
		expect(identity).toBe(actorId)
	})

	test("a freshly generated key package is not expired", async () => {
		const { publicPackage } = await newKeyPackage("https://example.test/users/me")
		expect(keyPackageIsExpired(publicPackage)).toBe(false)
	})
})
