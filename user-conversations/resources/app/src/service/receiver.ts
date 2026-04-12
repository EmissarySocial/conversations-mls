import { type Actor } from "../as/actor"
import { Activity } from "../as/activity"
import { Collection } from "../as/collection"
import { rangeActivities } from "../as/collection"
import { type IActivityHandler, type ILastMessageGetterSetter } from "./interfaces"

// Receiver service receives messages from an ActivityPub actor and forwards them
// to the MLS client
export class Receiver {

	#messagesUrl: string // endpoint for the actor's mls:messages collection
	#eventSource?: EventSource // EventSource for listening to server-sent events (SSE)
	#activityHandler: IActivityHandler // list of registered message handlers
	#lastMessage: ILastMessageGetterSetter // handler function for getting/setting the last message ID
	#generatorId: string // ID of this MLS client, used for the generator field of outgoing messages
	#polling: boolean // Pseudo-lock to prevent simultaneous polls
	#pollAgain: boolean // Indicates that one or more messages were received during a poll, so poll again after the current poll finishes

	// constructor initializes the Receiver with the actor's ID and messages URL
	constructor() {
		this.#messagesUrl = ""
		this.#activityHandler = async (activity: Activity) => { }
		this.#lastMessage = async (messageId?: string) => { return "" }
		this.#polling = false
		this.#pollAgain = false
		this.#generatorId = ""
	}

	// setActor configures the Receiver with the given Actor's information,
	// once it has been loaded from the network.
	setActor(actor: Actor) {
		const { url, plaintext } = actor.messages()
		this.#messagesUrl = url
	}

	// start begins polling for new messages and processing them with the registered handlers
	start = async (generatorId: string, activityHandler: IActivityHandler, lastMessage: ILastMessageGetterSetter) => {

		// Set the handler function to be called with each new message
		this.#activityHandler = activityHandler
		this.#lastMessage = lastMessage
		this.#generatorId = generatorId

		// Poll the server on start
		this.poll()

		// If possible, listen for server-sent-events (SSE) from the server
		const collection = await new Collection().fromURL(this.#messagesUrl)
		const sseEndpoint = collection.eventStream()

		if (sseEndpoint != "") {
			this.#eventSource = new EventSource(sseEndpoint, { withCredentials: true })
			this.#eventSource.onmessage = () => {
				this.poll()
			}
		}
	}

	stop = () => {
		if (this.#eventSource) {
			this.#eventSource.close()
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
		var lastMessageId = await this.#lastMessage()
		const activities = rangeActivities(this.#messagesUrl, lastMessageId, { credentials: "include" })

		// Process each activity sequentially
		for await (const activity of activities) {
			lastMessageId = activity.id()
			if (activity.generator() !== this.#generatorId) {
				await this.#activityHandler(activity)
			}
		}

		// Update the last message ID after processing all messages
		await this.#lastMessage(lastMessageId)

		// Release the "lock"
		this.#polling = false

		// Re-run poll if we received any messages while we were polling
		if (this.#pollAgain) {
			this.#pollAgain = false
			this.poll()
		}
	}
}
