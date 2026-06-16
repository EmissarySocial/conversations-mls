import { bytesToBase64, encode, keyPackageEncoder } from "ts-mls"

import { CIPHER_X25519_AES128, cipherSuiteName } from "../service/algorithms"
import type { DBKeyPackage } from "./db-keypackage"

// https://swicg.github.io/activitypub-e2ee/mls#KeyPackage
export interface APKeyPackage {
	id: string
	type: "KeyPackage"
	attributedTo: string
	to: "Public"
	mediaType: "message/mls"
	encoding: "base64"
	content: string
	name: string
	summary: string
	generator: {
		id: string,
		type: "Application",
		name: string,
	}
	ciphersuite: string
}

// NewAPKeyPackage creates a fully initialized KeyPackage object
// using the provided DBKeyPackage.
export function NewAPKeyPackage(dbKeyPackage: DBKeyPackage): APKeyPackage {

	// Encode the KeyPackage as an MLS message
	const keyPackageAsBase64 = encodeKeyPackage(dbKeyPackage)

	return {
		id: dbKeyPackage.keyPackageURL,
		type: "KeyPackage",
		to: "Public",
		attributedTo: dbKeyPackage.actorId,
		mediaType: "message/mls",
		encoding: "base64",
		content: keyPackageAsBase64,
		name: dbKeyPackage.signature,
		summary: dbKeyPackage.emojiKey.map(emoji => emoji[0]).join(""),
		generator: {
			id: dbKeyPackage.generatorId,
			type: "Application",
			name: dbKeyPackage.generatorName,
		},
		ciphersuite: cipherSuiteName(CIPHER_X25519_AES128) ?? ""
	}
}

// encodeKeyPackage represents a KeyPackage as a base64-encoded raw TLS KeyPackage.
// Uses the raw format (version + cipherSuite + initKey + leafNode + extensions + signature)
// without the MlsMessage wrapper, matching the format used by Bonfire and other implementations.
export function encodeKeyPackage(dbKeyPackage: DBKeyPackage): string {
	return bytesToBase64(encode(keyPackageEncoder, dbKeyPackage.publicKeyPackage))
}