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
import { decodeKeyPackage, keyPackageIdentity, keyPackageIsExpired, keyPackageIsSupported } from "./cryptography"
import type { IDelivery, IDirectory, IProxy } from "./interfaces"

export class Directory implements IDirectory {

	readonly #delivery: IDelivery
	readonly #proxy: IProxy

	#actorId: string // ID of the local actor

	constructor(delivery: IDelivery, proxy: IProxy, actorId: string) {
		this.#delivery = delivery
		this.#actorId = actorId
		this.#proxy = proxy
	}

	stop() {
		this.#actorId = ""
	}

	setActor(actor: Actor) {
		this.#actorId = actor.id()
	}

	// getKeyPackage loads the KeyPackages published by a single actor
	async getKeyPackages(actorIds: string[]): Promise<KeyPackage[]> {

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

					// SECURITY: The KeyPackage's credential identity MUST match the actor it was
					// fetched under. The credential identity is what getGroupMembers() and the
					// MLS authentication service trust as "who this key belongs to" — without this
					// bind, a hostile instance could serve a KeyPackage at its own actor URL while
					// claiming another actor's identity, forging group membership / sender identity.
					if (keyPackageIdentity(keyPackage) != actorId) {
						console.warn("getKeyPackages: KeyPackage credential identity does not match requested actor; dropping.", actorId)
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
	async createKeyPackage(dbKeyPackage: DBKeyPackage): Promise<[string, string]> {
		return await this.#createObject(NewAPKeyPackage(dbKeyPackage))
	}

	// updateKeyPackage sends the provided KeyPackage to the server as an ActivityPub `Update` activity.
	async updateKeyPackage(dbKeyPackage: DBKeyPackage): Promise<void> {
		await this.#updateObject(NewAPKeyPackage(dbKeyPackage))
	}

	// deleteKeyPackage removes a single KeyPackage from the server
	async deleteKeyPackage(keyPackageId: string) {
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

			// SECURITY (defense in depth): the document's ActivityPub "attributedTo" MUST match
			// the actor we requested. This catches a mismatched envelope one layer before the
			// credential-identity bind in getKeyPackages(); both the envelope and the MLS
			// credential must independently agree with the requested actor.
			if (document.attributedToId() != actorId) {
				console.warn("getKeyPackagesByActor: document attributedTo does not match requested actor; skipping.", actorId)
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
	async #createObject<T>(object: T): Promise<[string, string]> {

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
	async #updateObject<T>(object: T): Promise<string> {
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
	async #deleteObject<T>(object: T): Promise<void> {
		await this.#delivery.sendActivity(new Activity({
			"@context": "https://www.w3.org/ns/activitystreams",
			type: vocab.ActivityTypeDelete,
			id: newId(),
			actor: this.#actorId,
			object: object,
		}))
	}
}
