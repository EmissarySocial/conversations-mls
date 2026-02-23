import type {MlsPrivateMessage} from "ts-mls"
import {rangeCollection} from "./network"
import type {APMLSMessage} from "../model/ap-mlsmessage"
import * as ap from "../ap/properties"
import {Document} from "../ap/document"
import type {Config} from "../model/config"

// MessageHandler is a function that takes an MlsPrivateMessage and returns void.
// The Receiver service will call all registered MessageHandlers when a new message
// is received.
type MessageHandler = (message: string) => Promise<void>

// Receiver service receives messages from an ActivityPub actor and forwards them
// to the MLS client
export class Receiver {
	//

	#actorId: string // ID of the user receiving messages
	#messagesUrl: string // endpoint for the actor's mls:messages collection
	#lastUrl: string // URL of the last message received (used for polling)
	#eventSource?: EventSource // EventSource for listening to server-sent events (SSE)
	#handler: MessageHandler // list of registered message handlers

	#polling: boolean // Pseudo-lock to prevent simultaneous polls
	#pollAgain: boolean // Indicates that one or more messages were received during a poll, so poll again after the current poll finishes

	// constructor initializes the Receiver with the actor's ID and messages URL
	constructor(actorId: string, messagesUrl: string) {
		this.#actorId = actorId
		this.#messagesUrl = messagesUrl
		this.#lastUrl = "" // TODO: This should persist to the database so we don't lose our place if the app restarts
		this.#handler = async function (message: string) {}
		this.#polling = false
		this.#pollAgain = false
	}

	// registerHandler adds a new MessageHandler to the list of handlers that will be called
	registerHandler(handler: MessageHandler) {
		this.#handler = handler
	}

	// start begins polling for new messages and processing them with the registered handlers
	async start() {
		// Poll the server on start
		this.poll()

		// If possible, listen for server-sent-events (SSE) from the server
		const document = await new Document().fromURL(this.#messagesUrl)
		const sseEndpoint = document.eventStream()

		if (sseEndpoint != "") {
			this.#eventSource = new EventSource(sseEndpoint, {withCredentials: true})
			this.#eventSource.onmessage = (event) => {
				this.poll()
			}
		}
	}

	// poll retrieves new messages from the mls:messages collection and calls the
	// onMessage callback for each new message
	async poll() {
		//
		// If already polling, set #pollAgain flag and exit.
		if (this.#polling) {
			this.#pollAgain = true
			return
		}

		// Set the "lock" to prevent simultaneous polls
		this.#polling = true

		const lastUrl = localStorage.getItem("lastUrl") || ""

		// Fetch NEW messages from the server
		const generator = rangeCollection<APMLSMessage>(this.#messagesUrl, lastUrl, {credentials: "include"})

		// Process each message sequentially
		for await (const message of generator) {
			try {
				const document = new Document(message)
				localStorage.setItem("lastUrl", document.id())
				await this.#handler(document.content())
			} catch (error) {
				console.error("Receiver.poll: Error processing message:", error)
			}
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
