import {Activity} from "../ap/activity"
import {Collection, rangeActivities} from "../ap/collection"

// IActivityHandler is a function that takes an MlsPrivateMessage and returns void.
// The Receiver service will call the registered ActivityHandler when a new message
// is received.
type IActivityHandler = (activity: Activity) => Promise<void>

// Receiver service receives messages from an ActivityPub actor and forwards them
// to the MLS client
export class Receiver {
	//

	#actorId: string // ID of the user receiving messages
	#messagesUrl: string // endpoint for the actor's mls:messages collection
	#eventSource?: EventSource // EventSource for listening to server-sent events (SSE)
	#handler: IActivityHandler // list of registered message handlers

	#polling: boolean // Pseudo-lock to prevent simultaneous polls
	#pollAgain: boolean // Indicates that one or more messages were received during a poll, so poll again after the current poll finishes

	// constructor initializes the Receiver with the actor's ID and messages URL
	constructor(actorId: string, messagesUrl: string) {
		this.#actorId = actorId
		this.#messagesUrl = messagesUrl
		this.#handler = async function (activity: Activity) {}
		this.#polling = false
		this.#pollAgain = false
	}

	// registerHandler adds a new MessageHandler to the list of handlers that will be called
	registerHandler = (handler: IActivityHandler) => {
		this.#handler = handler
	}

	// start begins polling for new messages and processing them with the registered handlers
	start = async () => {
		// Poll the server on start
		this.poll()

		// If possible, listen for server-sent-events (SSE) from the server
		const collection = await new Collection().fromURL(this.#messagesUrl)
		const sseEndpoint = collection.eventStream()

		if (sseEndpoint != "") {
			this.#eventSource = new EventSource(sseEndpoint, {withCredentials: true})
			this.#eventSource.onmessage = (event) => {
				this.poll()
			}
		}
	}

	// poll retrieves new messages from the mls:messages collection and calls the
	// onMessage callback for each new message
	poll = async () => {
		//
		// If already polling, set #pollAgain flag and exit.
		if (this.#polling) {
			this.#pollAgain = true
			return
		}

		// Set the "lock" to prevent simultaneous polls
		this.#polling = true

		// Fetch NEW messages from the server
		const lastUrl = localStorage.getItem("lastUrl") || ""
		const activities = rangeActivities(this.#messagesUrl, lastUrl, {credentials: "include"})

		// Process each activity sequentially
		for await (const activity of activities) {
			console.log("Received activity:", activity.toJSON())
			localStorage.setItem("lastUrl", activity.id())
			await this.#handler(activity)
		}

		// Release the "lock"
		this.#polling = false

		// Re-run poll if we received any messages while we were polling
		if (this.#pollAgain) {
			this.#pollAgain = false
			this.poll()
		}
	}
}
