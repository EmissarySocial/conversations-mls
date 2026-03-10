import {type KeyPackage} from "ts-mls"
import {decode} from "ts-mls"
import {mlsMessageDecoder} from "ts-mls"
import {wireformats} from "ts-mls"
import {type APKeyPackage} from "../model/ap-keypackage"
import {ContactFromActor, type Contact} from "../model/contact"
import {Collection, rangeDocuments} from "../ap/collection"
import {base64ToUint8Array} from "./utils"
import {Actor} from "../ap/actor"

export class Directory {
	#actorID: string // ID of the local actor
	#outboxURL: string // Outbox URL of the local actor

	constructor(actorID: string, outboxURL: string) {
		this.#actorID = actorID
		this.#outboxURL = outboxURL
	}

	// getKeyPackage loads the KeyPackages published by a single actor
	getKeyPackages = async (actorIDs: string[]): Promise<KeyPackage[]> => {
		var result: KeyPackage[] = []

		for (const actorID of actorIDs) {
			const actor = await new Actor().fromURL(actorID)
			const keyPackages = rangeDocuments(actor.mlsKeyPackages())

			for await (const keyPackage of keyPackages) {
				//
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
		}

		return result
	}

	// createKeyPackage publishes a new KeyPackage to the User's outbox.
	createKeyPackage = async (keyPackage: APKeyPackage) => {
		return await this.#createObject<APKeyPackage>(keyPackage)
	}

	// createObject POSTs an ActivityPub object to the user's outbox
	// and returns the Location header from the response
	#createObject = async <T>(object: T) => {
		return await this.#send(this.#outboxURL, {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Create",
			actor: this.#actorID,
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

	getContact = async (id: string): Promise<Contact> => {
		const response = await new Actor().fromURL(id)
		return ContactFromActor(response)
	}
}
