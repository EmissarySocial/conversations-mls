import { Object } from "./object"

// Actor is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Actor extends Object {
	//

	///////////////////////////////////
	// Property accessors

	// icon returns the value of the "icon" property
	icon = () => {
		return this.getString("as", "icon")
	}

	// id returns the value of the "id" property
	id = () => {
		return this.getString("as", "id")
	}

	// name returns the value of the "name" property
	name = () => {
		return this.getString("as", "name")
	}

	outbox = () => {
		return this.getString("as", "outbox")
	}

	preferredUsername = () => {
		return this.getString("as", "preferredUsername")
	}

	summary = () => {
		return this.getString("as", "summary")
	}

	type = () => {
		return this.getString("as", "type")
	}

	///////////////////////////////////
	// MLS-specific properties

	mlsMessages = () => {
		return this.getString("mls", "messages")
	}

	mlsKeyPackages = () => {
		return this.getString("mls", "keyPackages")
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
		//
		// First, try using the custom emissary:messages property
		// because it will also give us unencrypted direct messages
		const emissaryMessages = this.emissaryMessages()

		if (emissaryMessages != "") {
			return { url: emissaryMessages, plaintext: true }
		}

		// Otherwise, fall back to the standard mls:messages property,
		// but this only supports encrypted group messages
		const mlsMessages = this.mlsMessages()

		if (mlsMessages != "") {
			return { url: mlsMessages, plaintext: false }
		}

		// Fail by returning "" for the collection URL
		return { url: "", plaintext: false }
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
