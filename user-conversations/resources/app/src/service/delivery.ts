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
import type { Actor } from "../as/actor"

// Delivery service sends messages via ActivityPub
export class Delivery {

	// The URL of the current user's outbox
	#outboxUrl: string

	// The cookie string present when this instance was created
	// used to detect changes to cookies/authentication state
	#originalCookie: string

	constructor() {
		this.#originalCookie = document.cookie
		this.#outboxUrl = ""
	}

	// stop clears this service and prevents it from sending any more messages.
	stop = () => {
		this.#outboxUrl = ""
		this.#originalCookie = ""
	}

	// setActor is used to configure the Delivery service
	// after the Actor has been loaded by the Controller.
	setActor(actor: Actor) {
		this.#outboxUrl = actor.outbox()
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

		// Confirm that authentication has not changed since the last request.
		this.#checkCookies()

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

	// sendActivity sends an activity to the Actor's outbox
	sendActivity = async (activity: Activity | { [key: string]: any }): Promise<Activity> => {

		var result: Activity

		// Guarantee that we have a valid outbox URL
		if (this.#outboxUrl == "") {
			throw new Error("Outbox URL not set. Cannot send activity.")
		}

		// Confirm that authentication has not changed since the last request.
		this.#checkCookies()

		// Guarantee that we have an `Activity` object to work with
		if (activity instanceof Activity) {
			result = activity
		} else {
			result = new Activity(activity)
		}

		console.log("Delivery.sendActivity", activity.toObject())

		// If necessary, encrypt the activity using MLS before sending
		// Send the Activity to the server
		const response = await fetch(this.#outboxUrl, {
			method: "POST",
			headers: { "Content-Type": "application/activity+json" },
			credentials: "include",
			body: result.toJSON(),
		})

		if (!response.ok) {
			throw new Error(`Unable to POST ${this.#outboxUrl}: ${response.status} ${response.statusText}`)
		}

		return result
	}

	// #checkCookies guarantees that we're still signed in as the 
	// original user.  It throws an error if the cookies have changed since 
	// this component was created, halting whatever operation was in progress..
	#checkCookies() {
		if (document.cookie !== this.#originalCookie) {
			throw new Error("Cookies have changed since the last request.")
		}
	}
}
