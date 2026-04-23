import * as vocab from "./vocab"
import { Object } from "./object"

// Actor is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Actor extends Object {
	//

	///////////////////////////////////
	// Property accessors

	// icon returns the value of the "icon" property
	icon = () => {
		return this.getString("as", vocab.PropertyIcon)
	}

	// id returns the value of the "id" property
	id = () => {
		return this.getString("as", vocab.PropertyId)
	}

	// name returns the value of the "name" property
	name = () => {
		return this.getString("as", vocab.PropertyName)
	}

	outbox = () => {
		return this.getString("as", vocab.PropertyOutbox)
	}

	preferredUsername = () => {
		return this.getString("as", vocab.PropertyPreferredUsername)
	}

	summary = () => {
		return this.getString("as", vocab.PropertySummary)
	}

	type = () => {
		return this.getString("as", vocab.PropertyType)
	}

	usernameOrId = () => {
		return this.preferredUsername() || this.id()
	}

	///////////////////////////////////
	// MLS-specific properties

	mlsMessages = () => {
		return this.getString("mls", vocab.PropertyMlsMessages)
	}

	mlsKeyPackages = () => {
		return this.getString("mls", vocab.PropertyMlsKeyPackages)
	}

	///////////////////////////////////
	// Emissary-specific properties

	// emissaryMessages returns the URL for the Emissary-specific messages collection
	// that returns BOTH encrypted and unencrypted messages. This is preferred over mls:messages because it allows the client to receive direct messages that are not encrypted with MLS.
	emissaryMessages = () => {
		return this.getString("emissary", "messages")
	}

	// messages returns the URL for the preferred messages collection,
	// which may be either the Emissary-specific collection (if supported) or
	// the standard mls:messages collection (if Emissary-specific collection is not supported).
	// The boolean return value indicates whether the returned URL is for the
	// Emissary-specific collection (true) or the standard mls:messages collection (false).
	messages = () => {

		// Default to "no support". If nothing else is found, then this server doesn't support this messages API.
		var result = { url: "", plaintext: false, ciphertext: false }

		// First, check to see if an MLS-only endpoint is available. If so, 
		// then this account can send/receive encrypted messages
		const mlsMessages = this.mlsMessages()

		if (mlsMessages != "") {
			result.url = mlsMessages
			result.ciphertext = true
		}

		// If the Emissary-specific endpoint is available, then we can also send/receive
		// unencrypted messages.  Update the URL to use the dual-use endpoint.
		const emissaryMessages = this.emissaryMessages()

		if (emissaryMessages != "") {
			result.url = emissaryMessages
			result.plaintext = true
		}

		// You get what you get.
		return result
	}

	///////////////////////////////////
	// Computed Properties
	computedUsername = () => {

		// Get JUST the username (and not potential "@" or domain)
		var username = this.preferredUsername()
		if (username.charAt(0) == "@") {
			username = username.substring(1)
		}
		username = username.split("@")[0]!

		// Get the domain from the actor's ID URL
		const url = new URL(this.id())

		// Combine as a nice looking Fediverse handle
		return `@${username}@${url.hostname}`
	}
}

export async function loadActor(value: any) {
	switch (typeof value) {
		case "string":
			return await new Actor().fromURL(value)

		case "object":
			if (Array.isArray(value)) {
				if (value.length > 0) {
					return loadActor(value[0])
				}
				return new Actor()
			}

			return new Actor(value)
	}

	return new Actor()
}
