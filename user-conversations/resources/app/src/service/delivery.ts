import { Activity } from "../as/activity"
import type { Actor } from "../as/actor"
import { HttpError } from "../as/object"

// Delivery service sends messages via ActivityPub
export class Delivery {

	// The URL of the current user's outbox
	#outboxUrl = ""

	#onSignout: () => void = () => { }

	// stop clears this service and prevents it from sending any more messages.
	stop() {
		this.#outboxUrl = ""
	}

	// setActor is used to configure the Delivery service
	// after the Actor has been loaded by the Controller.
	setActor(actor: Actor) {
		this.#outboxUrl = actor.outbox()
	}

	setSignout(onSignout: () => void) {
		this.#onSignout = onSignout
	}

	// sendActivity sends an activity to the Actor's outbox
	async sendActivity(activity: Activity): Promise<string> {

		// Guarantee that we have a valid outbox URL
		if (this.#outboxUrl == "") {
			throw new Error("Outbox URL not set. Cannot send activity.")
		}

		// Send the Activity to the server
		const response = await fetch(this.#outboxUrl, {
			method: "POST",
			headers: { "Content-Type": "application/activity+json" },
			credentials: "include",
			body: activity.toJSON(),
		})

		if (!response.ok) {
			if (response.status === 401) {
				this.#onSignout()
			}
			throw new HttpError(response.status, `Unable to POST ${this.#outboxUrl}: ${response.status} ${response.statusText}`)
		}

		return response.headers.get("Location") || ""
	}
}
