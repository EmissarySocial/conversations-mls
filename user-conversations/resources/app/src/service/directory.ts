// ts-mls Types
import { type KeyPackage } from "ts-mls"
import type { DBKeyPackage } from "../model/db-keypackage"

import * as vocab from "../as/vocab"
import { Activity } from "../as/activity"
import { Document } from "../as/document"

// Model Objects
import { NewAPKeyPackage } from "../model/ap-keypackage"

// ActivityPub objects
import { Actor } from "../as/actor"
import { newId } from "./utils"
import { decodeKeyPackage, keyPackageIsExpired, keyPackageIsSupported } from "./cryptography"
import type { IDelivery, IProxy } from "./interfaces"

export class Directory {

	readonly #delivery: IDelivery
	readonly #proxy: IProxy

	#actorId: string // ID of the local actor

	constructor(delivery: IDelivery, proxy: IProxy, actorId: string) {
		this.#delivery = delivery
		this.#actorId = actorId
		this.#proxy = proxy
	}

	stop = () => {
		this.#actorId = ""
	}

	setActor = (actor: Actor) => {
		this.#actorId = actor.id()
	}

	// getKeyPackage loads the KeyPackages published by a single actor
	getKeyPackages = async (actorIds: string[]): Promise<KeyPackage[]> => {

		let result: KeyPackage[] = []

		for (const actorId of actorIds) {

			// Retrieve all KeyPackage documents for this actor
			let documents: AsyncGenerator<Document>

			try {
				documents = this.getKeyPackagesByActor(actorId)
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
	createKeyPackage = async (dbKeyPackage: DBKeyPackage): Promise<[string, string]> => {
		return await this.#createObject(NewAPKeyPackage(dbKeyPackage))
	}

	// updateKeyPackage sends the provided KeyPackage to the server as an ActivityPub `Update` activity.
	updateKeyPackage = async (dbKeyPackage: DBKeyPackage): Promise<void> => {
		await this.#updateObject(NewAPKeyPackage(dbKeyPackage))
	}

	// deleteKeyPackage removes a single KeyPackage from the server
	deleteKeyPackage = async (keyPackageId: string) => {
		return await this.#deleteObject(keyPackageId)
	}

	// getKeyPackagesByActor is an async generator that yields all KeyPackage documents for a specific actor.
	async* getKeyPackagesByActor(actorId: string): AsyncGenerator<Document> {

		const actor = await this.#proxy.Actor(actorId)
		const collection = await actor.mlsKeyPackages()
		const documents = collection.rangeDocuments()

		// Yield each KeyPackage document to the caller
		for await (const document of documents) {

			// RULE: Do not yield KeyPackages if we do not recognize the format
			if (!keyPackageIsSupported(document)) {
				continue
			}

			yield document
		}
	}

	/******************************************
	 * ActivityPub Methods
	 ******************************************/

	// createObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	readonly #createObject = async <T>(object: T): Promise<[string, string]> => {

		const activityId = newId()
		const result = await this.#delivery.sendActivity(new Activity({
			"@context": "https://www.w3.org/ns/activitystreams",
			type: vocab.ActivityTypeCreate,
			id: activityId,
			actor: this.#actorId,
			to: [this.#actorId],
			object: object,
		}))

		if (result == "") {
			throw new Error("Server MUST return an id for the created object.")
		}

		return [activityId, result]
	}

	// updateObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	readonly #updateObject = async <T>(object: T): Promise<string> => {
		return await this.#delivery.sendActivity(new Activity({
			"@context": "https://www.w3.org/ns/activitystreams",
			type: vocab.ActivityTypeUpdate,
			id: newId(),
			actor: this.#actorId,
			object: object,
		}))
	}

	// deleteObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	readonly #deleteObject = async <T>(object: T): Promise<void> => {
		await this.#delivery.sendActivity(new Activity({
			"@context": "https://www.w3.org/ns/activitystreams",
			type: vocab.ActivityTypeDelete,
			id: newId(),
			actor: this.#actorId,
			object: object,
		}))
	}
}
