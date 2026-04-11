// ts-mls TYpes
import { type KeyPackage } from "ts-mls"
import { decode } from "ts-mls"
import { mlsMessageDecoder } from "ts-mls"
import { wireformats } from "ts-mls"

// Model Objects
import { type APKeyPackage } from "../model/ap-keypackage"
import { ContactFromActor, type Contact } from "../model/contact"

// ActivityPub objects
import { rangeDocuments } from "../as/collection"
import { Actor } from "../as/actor"
import { base64ToUint8Array } from "./utils"

export class Directory {

	#actorId: string // ID of the local actor
	#outboxUrl: string // Outbox URL of the local actor

	constructor() {
		this.#actorId = ""
		this.#outboxUrl = ""
	}

	stop = () => {
		this.#actorId = ""
		this.#outboxUrl = ""
	}

	setActor = (actor: Actor) => {
		this.#actorId = actor.id()
		this.#outboxUrl = actor.outbox()
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

	// createKeyPackage publishes a new KeyPackage to the User's outbox.
	createKeyPackage = async (keyPackage: APKeyPackage) => {
		return await this.#createObject(keyPackage)
	}

	updateKeyPackage = async (keyPackage: APKeyPackage) => {
		return await this.#updateObject(keyPackage)
	}

	deleteKeyPackage = async (keyPackageUrl: string) => {
		return await this.#deleteObject(keyPackageUrl)
	}

	// createObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	#createObject = async <T>(object: T) => {
		return await this.#send(this.#outboxUrl, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Create",
			actor: this.#actorId,
			object: object,
		})
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
		return await this.#send(this.#outboxUrl, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Delete",
			actor: this.#actorId,
			object: object,
		})
	}

	// send POSTs an ActivityPub activity to the specified outbox
	// and returns the Location header from the response
	#send = async <T>(outbox: string, activity: T) => {
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

	loadContact = async (id: string): Promise<Contact> => {
		const response = await new Actor().fromURL(id)
		return ContactFromActor(response)
	}
}
