import { test, expect, describe } from 'vitest'
import { defaultCredentialTypes, type Credential, type KeyPackage } from "ts-mls"

import { ActivityPubAuthenticationService } from "./authService"
import type { IDirectory } from "./interfaces"

const ACTOR = "https://alice.test/users/alice"

// stubDirectory returns an IDirectory whose getKeyPackages yields the supplied list.
function stubDirectory(keyPackages: KeyPackage[]): IDirectory {
	return {
		stop: () => { /* no-op */ },
		setActor: () => { /* no-op */ },
		getKeyPackagesByActor: (async function* () { })(),
		getKeyPackages: async () => keyPackages,
		createKeyPackage: async () => ["", ""],
		updateKeyPackage: async () => { /* no-op */ },
		deleteKeyPackage: async () => { /* no-op */ },
	} as unknown as IDirectory
}

// basicCredential builds a CredentialBasic carrying the given actor id.
function basicCredential(actorId: string): Credential {
	return {
		credentialType: defaultCredentialTypes.basic,
		identity: new TextEncoder().encode(actorId),
	} as Credential
}

// keyPackageWithSignatureKey builds a minimal KeyPackage carrying a signature key.
function keyPackageWithSignatureKey(key: Uint8Array): KeyPackage {
	return { leafNode: { signaturePublicKey: key } } as unknown as KeyPackage
}

describe("ActivityPubAuthenticationService.validateCredential", () => {

	test("rejects a non-basic credential type", async () => {
		const service = new ActivityPubAuthenticationService(stubDirectory([]))
		const credential = { credentialType: defaultCredentialTypes.x509, identity: new Uint8Array() } as Credential

		expect(await service.validateCredential(credential, new Uint8Array([1, 2, 3]))).toBe(false)
	})

	test("rejects an empty actor identity", async () => {
		const service = new ActivityPubAuthenticationService(stubDirectory([]))
		const credential = basicCredential("")

		expect(await service.validateCredential(credential, new Uint8Array([1, 2, 3]))).toBe(false)
	})

	test("accepts when a published KeyPackage carries the asserted signature key", async () => {
		const signatureKey = new Uint8Array([10, 20, 30, 40])
		const service = new ActivityPubAuthenticationService(stubDirectory([
			keyPackageWithSignatureKey(new Uint8Array([1, 1, 1, 1])),
			keyPackageWithSignatureKey(signatureKey),
		]))

		expect(await service.validateCredential(basicCredential(ACTOR), signatureKey)).toBe(true)
	})

	test("rejects when no published KeyPackage matches the asserted key", async () => {
		const service = new ActivityPubAuthenticationService(stubDirectory([
			keyPackageWithSignatureKey(new Uint8Array([1, 1, 1, 1])),
		]))

		expect(await service.validateCredential(basicCredential(ACTOR), new Uint8Array([9, 9, 9, 9]))).toBe(false)
	})

	test("rejects when the actor has no published KeyPackages", async () => {
		const service = new ActivityPubAuthenticationService(stubDirectory([]))
		expect(await service.validateCredential(basicCredential(ACTOR), new Uint8Array([1, 2, 3]))).toBe(false)
	})

	test("rejects when a matching key has a different length", async () => {
		// uint8ArrayEqual must reject keys whose prefix matches but length differs
		const service = new ActivityPubAuthenticationService(stubDirectory([
			keyPackageWithSignatureKey(new Uint8Array([10, 20, 30])),
		]))

		expect(await service.validateCredential(basicCredential(ACTOR), new Uint8Array([10, 20, 30, 40]))).toBe(false)
	})
})
