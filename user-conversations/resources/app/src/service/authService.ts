import { type AuthenticationService, type Credential, type CredentialBasic, defaultCredentialTypes } from "ts-mls"

import { type IDirectory } from "./interfaces"
import { uint8ArrayEqual } from "./utils"

// ActivityPubAuthenticationService validates MLS credentials by checking that the asserted
// signature key appears in the actor's published KeyPackages on their ActivityPub profile.
// This replaces the unsafe stub that unconditionally returns true.
export class ActivityPubAuthenticationService implements AuthenticationService {
	readonly #directory: IDirectory

	constructor(directory: IDirectory) {
		this.#directory = directory
	}

	async validateCredential(credential: Credential, signaturePublicKey: Uint8Array): Promise<boolean> {

		// Only CredentialBasic carries an actor identity; reject all other types
		if (credential.credentialType !== defaultCredentialTypes.basic) {
			console.log(`AuthenticationService: FALSE: Invalid credential type: ${credential.credentialType}`)
			return false
		}

		const actorId = new TextDecoder().decode((credential as CredentialBasic).identity)

		if (!actorId) {
			console.log(`AuthenticationService: FALSE: Invalid actor ID: ${actorId}`)
			return false
		}

		// Fetch the actor's currently published KeyPackages from their ActivityPub profile
		const keyPackages = await this.#directory.getKeyPackages([actorId])

		// Accept if any published KeyPackage carries the asserted signature key
		const result = keyPackages.some(kp => uint8ArrayEqual(kp.leafNode.signaturePublicKey, signaturePublicKey))

		console.log(`AuthenticationService: Validated credential for actor ${actorId}. Result: ${result}`, keyPackages)
		return result
	}
}
