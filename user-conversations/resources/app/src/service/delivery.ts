import { type MlsGroupInfo, type MlsMessage } from "ts-mls"
import { type MlsFramedMessage } from "ts-mls"
import { type MlsWelcomeMessage } from "ts-mls"

import { bytesToBase64, type Encoder } from "ts-mls"
import { encode } from "ts-mls"
import { decode } from "ts-mls"
import { mlsMessageEncoder } from "ts-mls"
import { mlsMessageDecoder } from "ts-mls"

import { MLS } from "./mls"
import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"
import { groupIsEncrypted, type Group } from "../model/group"

// Delivery service sends messages via ActivityPub
export class Delivery {
	//

	// actorId is the ID of the user sending messages
	#actorId: string

	// outboxUrl is the URL of the user's outbox
	#outboxUrl: string

	constructor(actorId: string, outboxUrl: string) {
		this.#actorId = actorId
		this.#outboxUrl = outboxUrl
	}

	/**
	 * load GETs an ActivityPub resource with proper Accept headers.
	 * If a URL is provided, then it fetches the resource from the network.
	 * If an object is provided, it simply returns it.
	 *
	 * @param url - The URL to fetch
	 * @returns The parsed JSON response
	 * @throws Error if the fetch fails
	 */
	load = async <T>(url: string) => {
		//
		// If the URL is already an object, return it directly
		if (typeof url != "string") {
			return url
		}

		// Otherwise, the url is a URL, so load it from the network
		const response = await fetch(url, {
			headers: {
				Accept: 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			},
		})

		if (!response.ok) {
			throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`)
		}

		return response.json() as Promise<T>
	}

	// sendFramedMessage sends an MLS FramedMessage to the specified recipients
	sendFramedMessage = (recipients: string[], message: MlsFramedMessage) => {
		this.#sendMlsMessage("mls:PrivateMessage", recipients, message)
	}

	// sendGroupInfo sends an MLS GroupInfo message to the specified recipients
	sendGroupInfo = (recipients: string[], message: MlsGroupInfo) => {
		this.#sendMlsMessage("mls:GroupInfo", recipients, message)
	}

	// sendPrivateMessage sends an MLS PrivateMessage to the specified recipients
	sendPrivateMessage = (recipients: string[], message: MlsFramedMessage) => {
		this.#sendMlsMessage("mls:PrivateMessage", recipients, message)
	}

	// sendWelcome sends an MLS Welcome message to the specified recipients
	sendWelcome = (recipients: string[], message: MlsWelcomeMessage) => {
		this.#sendMlsMessage("mls:Welcome", recipients, message)
	}

	// #sendMlsMessage is a private method that sends an MLS message via the user's ActivityPub outbox
	#sendMlsMessage = async (type: string, recipients: string[], message: MlsMessage) => {
		//
		// Filter out "me" from the recipients list (we don't need to send the message to ourselves)
		recipients = recipients.filter((recipient) => recipient !== this.#actorId)

		// If there are no recipients to send to, just return early
		if (recipients.length === 0) {
			return
		}

		// Encode the private message as bytes, then to base64
		const contentBytes = encode(mlsMessageEncoder, message)
		const contentBase64 = bytesToBase64(contentBytes)

		// Create an ActivityPub activity for the private message
		const activity = new Activity({
			"@context": [vocab.ContextActivityStreams, { mls: vocab.ContextMLS }],
			type: vocab.ActivityTypeCreate,
			actor: this.#actorId,
			to: recipients,
			object: {
				type: type,
				attributedTo: this.#actorId,
				to: recipients,
				content: contentBase64,
				mediaType: "message/mls",
				"mls:encoding": "base64",
			},
		})

		console.log("Sending activity:", activity.toJSON())

		// Send the Activity to the server
		const response = await fetch(this.#outboxUrl, {
			method: "POST",
			body: activity.toJSON(),
			credentials: "include",
		})

		if (!response.ok) {
			throw new Error(`Failed to POST ${this.#outboxUrl}: ${response.status} ${response.statusText}`)
		}
	}

	// sendActivity sends an activity to the Actor's outbox
	sendActivity = async (activity: Activity) => {

		// If necessary, encrypt the activity using MLS before sending
		// Send the Activity to the server
		console.log("Sending activity:", activity.toJSON())
		const response = await fetch(this.#outboxUrl, {
			method: "POST",
			body: activity.toJSON(),
			credentials: "include",
		})

		if (!response.ok) {
			throw new Error(`Failed to POST ${this.#outboxUrl}: ${response.status} ${response.statusText}`)
		}
	}
}
