import type { KeyPackage } from "ts-mls"

import { bytesToBase64 } from "ts-mls"
import { encode } from "ts-mls"
import { keyPackageEncoder } from "ts-mls"

import { CIPHER_X25519_AES128, cipherSuiteName } from "../service/algorithms"

// https://swicg.github.io/activitypub-e2ee/mls#KeyPackage
export interface APKeyPackage {
	id: string
	type: "KeyPackage"
	attributedTo: string
	to: "Public"
	mediaType: "message/mls"
	encoding: "base64"
	content: string
	generator: {
		id: string,
		type: "Application",
		name: string,
	}
	ciphersuite: string
}

// NewAPKeyPackage creates a fully initialized KeyPackage object
// using the provided actorID and public KeyPackage.
export function NewAPKeyPackage(keyPackageId: string, generatorId: string, generatorName: string, actorID: string, publicPackage: KeyPackage): APKeyPackage {

	// Encode the KeyPackage as an MLS message
	const keyPackageAsBase64 = encodeKeyPackage(publicPackage)

	return {
		id: keyPackageId,
		type: "KeyPackage",
		to: "Public",
		attributedTo: actorID,
		mediaType: "message/mls",
		encoding: "base64",
		content: keyPackageAsBase64,
		generator: {
			id: generatorId,
			type: "Application",
			name: generatorName,
		},
		ciphersuite: cipherSuiteName(CIPHER_X25519_AES128) ?? ""
	}
}

// encodeKeyPackage represents a KeyPackage as a base64-encoded raw TLS KeyPackage.
// Uses the raw format (version + cipherSuite + initKey + leafNode + extensions + signature)
// without the MlsMessage wrapper, matching the format used by Bonfire and other implementations.
export function encodeKeyPackage(keyPackage: KeyPackage): string {
	return bytesToBase64(encode(keyPackageEncoder, keyPackage))
}