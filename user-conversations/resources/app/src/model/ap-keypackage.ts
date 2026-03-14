// KeyPackage is the ActivityPub representation of a KeyPackage

import { bytesToBase64 } from "ts-mls"
import { decode } from "ts-mls"
import { encode } from "ts-mls"
import type { KeyPackage } from "ts-mls"
import { mlsMessageEncoder } from "ts-mls"
import { mlsMessageDecoder } from "ts-mls"
import { protocolVersions } from "ts-mls"
import { base64ToBytes } from "ts-mls"
import { wireformats } from "ts-mls"

// https://swicg.github.io/activitypub-e2ee/mls#KeyPackage
export interface APKeyPackage {
	id: string
	type: "mls:KeyPackage"
	attributedTo: string
	to: "as:Public"
	mediaType: "message/mls"
	encoding: "base64"
	content: string
	generator: string
}

// NewAPKeyPackage creates a fully initialized KeyPackage object
// using the provided actorID and public KeyPackage.
export function NewAPKeyPackage(generator: string, actorID: string, publicPackage: KeyPackage): APKeyPackage {
	//
	// Encode the KeyPackage as an MLS message
	const keyPackageMessage = encode(mlsMessageEncoder, {
		keyPackage: publicPackage,
		wireformat: wireformats.mls_key_package,
		version: protocolVersions.mls10,
	})

	// TEST: Verify that we can decode the message we just encoded
	const keyPackageAsBase64 = bytesToBase64(keyPackageMessage)
	const decodedMessage = decode(mlsMessageDecoder, base64ToBytes(keyPackageAsBase64))

	return {
		id: "", // This will be appened by the server
		type: "mls:KeyPackage",
		to: "as:Public",
		attributedTo: actorID,
		mediaType: "message/mls",
		encoding: "base64",
		generator: generator,
		content: keyPackageAsBase64,
	}
}
