// ts-mls TYpes
import { defaultLifetime, getCiphersuiteImpl, type CiphersuiteName, type Credential } from "ts-mls"
import { type KeyPackage } from "ts-mls"
import { decode } from "ts-mls"
import { defaultCredentialTypes } from "ts-mls"
import { generateKeyPackage } from "ts-mls"
import { mlsMessageDecoder } from "ts-mls"
import { wireformats } from "ts-mls"

// Model Objects
import { NewAPKeyPackage, type APKeyPackage } from "../model/ap-keypackage"
import { ContactFromActor, type Contact } from "../model/contact"

// ActivityPub objects
import { rangeDocuments } from "../as/collection"
import { Actor } from "../as/actor"
import { base64ToUint8Array } from "./utils"
import { newKeyPackage } from "./cryptography"

export class Directory {

	#actorId: string // ID of the local actor 
	#outboxUrl: string // Outbox URL of the local actor
	#generatorId: string // ID of the generator
	#generatorName: string // Name of the generator

	constructor(actorId: string) {
		this.#actorId = actorId
		this.#outboxUrl = ""
		this.#generatorId = ""
		this.#generatorName = ""
	}

	stop = () => {
		this.#actorId = ""
		this.#outboxUrl = ""
		this.#generatorId = ""
		this.#generatorName = ""
	}

	setActor = (actor: Actor) => {
		this.#actorId = actor.id()
		this.#outboxUrl = actor.outbox()
	}

	setGenerator = (generatorId: string, generatorName: string) => {
		this.#generatorId = generatorId
		this.#generatorName = generatorName
	}

	// getKeyPackage loads the KeyPackages published by a single actor
	getKeyPackages = async (actorIds: string[]): Promise<KeyPackage[]> => {

		console.log("getKeyPackages", actorIds)
		var result: KeyPackage[] = []

		for (const actorId of actorIds) {

			try {
				const actor = await new Actor().fromURL(actorId)
				const keyPackages = rangeDocuments(actor.mlsKeyPackages())

				for await (const keyPackage of keyPackages) {

					const contentBytes = base64ToUint8Array(keyPackage.content())
					const decodedKeyPackage = decode(mlsMessageDecoder, contentBytes)

					if (decodedKeyPackage == undefined) {
						console.warn("getKeyPackages: Failed to decode KeyPackage for item:", keyPackage.toObject())
						continue
					}

					if (decodedKeyPackage.wireformat !== wireformats.mls_key_package) {
						console.warn("getKeyPackages: Unexpected wireformat for KeyPackage:", decodedKeyPackage.wireformat)
						continue
					}

					result.push(decodedKeyPackage.keyPackage)
				}

			} catch (error) {
				console.error("getKeyPackages: Failed to load KeyPackages for actor:", actorId, error)
			}
		}

		console.log("getKeyPackages result", result)
		return result
	}


	// createKeyPackage sends the provided KeyPackage to the server as a new ActivityPub `Create` activity.
	// It returns the ID of the newly created KeyPackage or throws an error on failure.
	createKeyPackage = async (publicPackage: KeyPackage): Promise<string> => {

		// Create an ActivityPub JSON-LD object for the KeyPackage
		const keyPackage = NewAPKeyPackage(
			"", // ID will be assigned by the server
			this.#generatorId,
			this.#generatorName,
			this.#actorId,
			publicPackage,
		)

		// Create a new KeyPackage and return the ID of the newly created KeyPackage
		return await this.#createObject(keyPackage)
	}

	// updateKeyPackage sends the provided KeyPackage to the server as an ActivityPub `Update` activity.
	// It returns the ID of the updated KeyPackage or throws an error on failure.
	updateKeyPackage = async (keyPackageId: string, publicPackage: KeyPackage): Promise<void> => {

		// Create an ActivityPub JSON-LD object for the KeyPackage
		const keyPackage = NewAPKeyPackage(
			keyPackageId,
			this.#generatorId,
			this.#generatorName,
			this.#actorId,
			publicPackage,
		)

		// Update the KeyPackage via the ActivityPub API
		await this.#updateObject(keyPackage)
	}

	deleteKeyPackage = async (keyPackageId: string) => {
		return await this.#deleteObject(keyPackageId)
	}

	// createObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	#createObject = async <T>(object: T) => {
		const result = await this.#send(this.#outboxUrl, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Create",
			actor: this.#actorId,
			object: object,
		})

		if (result == "") {
			throw new Error("Server MUST return an id for the created object.")
		}

		return result
	}

	// updateObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	#updateObject = async <T>(object: T) => {
		return await this.#send(this.#outboxUrl, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Update",
			actor: this.#actorId,
			object: object,
		})
	}

	// deleteObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	#deleteObject = async <T>(object: T) => {
		await this.#send(this.#outboxUrl, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Delete",
			actor: this.#actorId,
			object: object,
		})
	}

	// send POSTs an ActivityPub activity to the Actor's outbox
	// returns the location of the affected Object.
	// It throws an error if the fetch fails or if the response 
	// does not provide a Location header.
	#send = async <T>(outbox: string, activity: T): Promise<string> => {

		// Send the Activity to the server
		const response = await fetch(outbox, {
			method: "POST",
			body: JSON.stringify(activity),
			credentials: "include",
		})

		if (!response.ok) {
			throw new Error(`Failed to fetch ${outbox}: ${response.status} ${response.statusText}`)
		}

		return response.headers.get("Location") || ""
	}
}
