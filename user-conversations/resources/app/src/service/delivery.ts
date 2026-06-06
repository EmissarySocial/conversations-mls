import { Activity } from "../as/activity"
import type { Actor } from "../as/actor"

// Delivery service sends messages via ActivityPub
export class Delivery {

	// The URL of the current user's outbox
	#outboxUrl = ""

	// The cookie string present when this instance was created
	// used to detect changes to cookies/authentication state
	#originalCookie = document.cookie


	// stop clears this service and prevents it from sending any more messages.
	stop() {
		this.#outboxUrl = ""
		this.#originalCookie = ""
	}

	// setActor is used to configure the Delivery service
	// after the Actor has been loaded by the Controller.
	setActor(actor: Actor) {
		this.#outboxUrl = actor.outbox()
	}

	// sendActivity sends an activity to the Actor's outbox
	async sendActivity(activity: Activity): Promise<string> {

		// Guarantee that we have a valid outbox URL
		if (this.#outboxUrl == "") {
			throw new Error("Outbox URL not set. Cannot send activity.")
		}

		// Confirm that authentication has not changed since the last request.
		this.#checkCookies()

		// Send the Activity to the server
		const response = await fetch(this.#outboxUrl, {
			method: "POST",
			headers: { "Content-Type": "application/activity+json" },
			credentials: "include",
			body: activity.toJSON(),
		})

		if (!response.ok) {
			throw new Error(`Unable to POST ${this.#outboxUrl}: ${response.status} ${response.statusText}`)
		}

		return response.headers.get("Location") || ""
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
