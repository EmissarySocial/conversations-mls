import type { KeyPackage } from "ts-mls"

import { bytesToBase64 } from "ts-mls"
import { encode } from "ts-mls"
import { mlsMessageEncoder } from "ts-mls"
import { protocolVersions } from "ts-mls"
import { wireformats } from "ts-mls"

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
		ciphersuite: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"
	}
}

// encodeKeyPackage represents a KeyPackage as a base64-encoded MLS message
export function encodeKeyPackage(keyPackage: KeyPackage): string {

	// Encode the KeyPackage as an MLS message
	const keyPackageMessage = encode(mlsMessageEncoder, {
		keyPackage: keyPackage,
		wireformat: wireformats.mls_key_package,
		version: protocolVersions.mls10,
	})

	// Encode the messag to base64 for transport
	return bytesToBase64(keyPackageMessage)
}