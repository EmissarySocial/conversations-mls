// ts-mls imports
import { type CiphersuiteName } from "ts-mls"
import { type Credential } from "ts-mls"
import { defaultCredentialTypes } from "ts-mls"
import { defaultLifetime } from "ts-mls"
import { getCiphersuiteImpl } from "ts-mls"
import { generateKeyPackage } from "ts-mls"

// Interfaces
import type { IDatabase } from "./interfaces"
import type { IDelivery } from "./interfaces"
import type { IDirectory } from "./interfaces"
import type { IReceiver } from "./interfaces"

// Model objects
import { Actor } from "../as/actor"
import { NewAPKeyPackage } from "../model/ap-keypackage"

// Services
import { MLS } from "./mls"

// makeMLS loads the required dependencies for the MLS service,
// and returns a fully populated MLS instance once everything is ready.
export async function MLSFactory(
	database: IDatabase,
	delivery: IDelivery,
	directory: IDirectory,
	receiver: IReceiver,
	actor: Actor,
	clientName: string,
): Promise<MLS> {
	//
	// Use MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519 (ID: 1)
	// Using nobleCryptoProvider for compatibility (pure JS implementation)
	const cipherSuiteName: CiphersuiteName = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"
	const cipherSuite = await getCiphersuiteImpl(cipherSuiteName)

	// Try to load the KeyPackage from the IndexedDB database
	var dbKeyPackage = await database.loadKeyPackage()

	// Create a new KeyPackage if none exists
	if (dbKeyPackage == undefined) {
		//
		// Create a credential for this User
		const credential: Credential = {
			credentialType: defaultCredentialTypes.basic,
			identity: new TextEncoder().encode(actor.id()),
		}

		// Generate initial key package for this user
		var keyPackageResult = await generateKeyPackage({
			credential: credential,
			cipherSuite: cipherSuite,
			lifetime: defaultLifetime(),
		})

		// Publish the KeyPackage to the server
		const apKeyPackage = NewAPKeyPackage(clientName, actor.id(), keyPackageResult.publicPackage)
		const apKeyPackageURL = await directory.createKeyPackage(apKeyPackage)

		if (apKeyPackageURL == "") {
			throw new Error("Failed to create KeyPackage on server")
		}

		// Save the KeyPackage to the local database
		dbKeyPackage = {
			id: "self",
			keyPackageURL: apKeyPackageURL,
			clientName: clientName,
			publicKeyPackage: keyPackageResult.publicPackage,
			privateKeyPackage: keyPackageResult.privatePackage,
			cipherSuiteName: cipherSuiteName,
		}

		await database.saveKeyPackage(dbKeyPackage)
	}

	// Create and return the MLS service
	var result = new MLS(
		database,
		delivery,
		directory,
		cipherSuite,
		dbKeyPackage.publicKeyPackage,
		dbKeyPackage.privateKeyPackage,
		actor,
	)

	// Hoo-rah!
	return result
}
