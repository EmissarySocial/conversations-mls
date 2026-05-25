// ts-mls TYpes
import { type KeyPackage } from "ts-mls"
import { decode } from "ts-mls"
import { mlsMessageDecoder } from "ts-mls"
import { wireformats } from "ts-mls"

import * as vocab from "../as/vocab"
import { Document } from "../as/document"

// Model Objects
import { NewAPKeyPackage } from "../model/ap-keypackage"

// ActivityPub objects
import { Actor } from "../as/actor"
import { newId } from "./utils"
import { decodeKeyPackage } from "./cryptography"
import { keyPackageIsExpired } from "./cryptography"

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

		var result: KeyPackage[] = []

		for (const actorId of actorIds) {

			// Retrieve all KeyPackage documents for this actor
			var documents: AsyncGenerator<Document>

			try {
				documents = this.listAllKeyPackages(actorId)
			} catch (error) {
				console.error("getKeyPackages: Failed to load KeyPackages for actor:", actorId, error)
				continue
			}

			// Process (and validate) each KeyPackage document before including it in the results
			for await (const document of documents) {

				try {

					// Decode the ActivityStreams document as a KeyPackage
					const keyPackage = decodeKeyPackage(document)

					// RULE: Do not include the KeyPackage if it is expired (not valid, not before current time, etc.)
					if (keyPackageIsExpired(keyPackage)) {
						continue
					}

					result.push(keyPackage)

				} catch (error) {
					console.error("getKeyPackages: Failed to decode KeyPackage document:", document.toObject(), error)
				}
			}
		}

		// Success, or what's left of it.
		return result
	}


	// createKeyPackage sends the provided KeyPackage to the server as a new ActivityPub `Create` activity.
	// It returns the ID of the newly created KeyPackage or throws an error on failure.
	createKeyPackage = async (publicPackage: KeyPackage): Promise<[string, string]> => {

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

	// deleteKeyPackage removes a single KeyPackage from the server
	deleteKeyPackage = async (keyPackageId: string) => {
		return await this.#deleteObject(keyPackageId)
	}

	// listAllKeyPackages is an async generator that yields all KeyPackage documents for a specific actor.
	async* listAllKeyPackages(actorId: string): AsyncGenerator<Document> {
		const actor = await new Actor().fromURL(actorId)
		const collection = await actor.mlsKeyPackages()
		const documents = collection.rangeDocuments()

		// Yield each KeyPackage document to the caller
		for await (const document of documents) {
			yield document
		}
	}

	/******************************************
	 * ActivityPub Methods
	 ******************************************/

	// createObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	#createObject = async <T>(object: T): Promise<[string, string]> => {

		const activityId = newId()
		const result = await this.#send(this.#outboxUrl, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: vocab.ActivityTypeCreate,
			id: activityId,
			actor: this.#actorId,
			to: [this.#actorId],
			object: object,
			instrument: this.#generatorId,
		})

		if (result == "") {
			throw new Error("Server MUST return an id for the created object.")
		}

		return [activityId, result]
	}

	// updateObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	#updateObject = async <T>(object: T): Promise<string> => {
		return await this.#send(this.#outboxUrl, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: vocab.ActivityTypeUpdate,
			id: newId(),
			actor: this.#actorId,
			object: object,
			instrument: this.#generatorId,
		})
	}

	// deleteObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	#deleteObject = async <T>(object: T): Promise<void> => {
		await this.#send(this.#outboxUrl, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: vocab.ActivityTypeDelete,
			id: newId(),
			actor: this.#actorId,
			object: object,
			instrument: this.#generatorId,
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
