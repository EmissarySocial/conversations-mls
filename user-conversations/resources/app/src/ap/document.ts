import * as property from "./properties"

type apObject = {[key: string]: any}

// Document is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Document {
	#value: apObject

	constructor(value?: apObject) {
		this.#value = {}
		if (value != undefined) {
			this.#value = value
		}
	}

	///////////////////////////////////
	// Conversion methods

	// fromURL retrieves a JSON document from the specified URL and parses it into the Document struct
	async fromURL(url: string, options: RequestInit = {}): Promise<Document> {
		//

		// Require Accept: header for ActivityPub
		options["headers"] = {
			Accept: "application/activity+json",
		}

		const response = await fetch(url, options)

		// Report errors
		if (!response.ok) {
			throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`)
		}

		// Parse the JSON response into a Document
		this.fromJSON(await response.text())
		return this
	}

	// fromJSON parses a JSON string into the Document struct
	fromJSON(json: string): Document {
		this.#value = JSON.parse(json)
		return this
	}

	toObject(): {[key: string]: any} {
		return this.#value
	}

	///////////////////////////////////
	// Property accessors

	actor(): string {
		return this.asString(this.#value, "actor", "ap:actor", "https://www.w3.org/ns/activitystreams#actor")
	}

	content(): string {
		return this.asString(this.#value, "content", "ap:content", "https://www.w3.org/ns/activitystreams#content")
	}

	eventStream(): string {
		return this.asString(
			this.#value,
			"eventStream",
			"sse:eventStream",
			"https://purl.archive.org/socialweb/sse#eventStream",
		)
	}

	icon(): string {
		return this.asString(this.#value, "icon", "ap:icon", "https://www.w3.org/ns/activitystreams#icon")
	}

	id(): string {
		return this.asString(this.#value, "id", "ap:id", "https://www.w3.org/ns/activitystreams#id")
	}

	name(): string {
		return this.asString(this.#value, "name", "ap:name", "https://www.w3.org/ns/activitystreams#name")
	}

	async object(): Promise<Document> {
		return await this.asObject(this.#value, "object", "ap:object", "https://www.w3.org/ns/activitystreams#object")
	}

	outbox(): string {
		return this.asString(this.#value, "outbox", "ap:outbox", "https://www.w3.org/ns/activitystreams#outbox")
	}

	preferredUsername(): string {
		return this.asString(
			this.#value,
			"preferredUsername",
			"as:preferredUsername",
			"https://www.w3.org/ns/activitypub#preferredUsername",
		)
	}

	summary(): string {
		return this.asString(this.#value, "summary", "ap:summary", "https://www.w3.org/ns/activitystreams#summary")
	}

	type(): string {
		return this.asString(this.#value, "type", "ap:type", "https://www.w3.org/ns/activitystreams#type")
	}

	///////////////////////////////////
	// MLS-specific properties

	mlsMessages(): string {
		return this.asString(this.#value, "messages", "mls:messages", "https://purl.archive.org/socialweb/mls#messages")
	}

	mlsKeyPackages(): string {
		return this.asString(
			this.#value,
			"keyPackages",
			"mls:keyPackages",
			"https://purl.archive.org/socialweb/mls#keyPackages",
		)
	}

	///////////////////////////////////
	// Emissary-specific properties

	emissaryMessages(): string {
		return this.asString(this.#value, "emissary:messages")
	}

	///////////////////////////////////
	// Property conversion methods

	asString(value: apObject, ...names: string[]): string {
		//
		// Try each provided name until one exists
		for (const name of names) {
			if (value[name] != undefined) {
				const result = value[name]

				switch (typeof result) {
					case "string":
						return result

					case "object":
						if (typeof result.id === "string") {
							return result.id
						}
						if (typeof result.href === "string") {
							return result.href
						}
						break
				}
			}
		}

		return ""
	}

	async asObject(value: apObject, ...names: string[]): Promise<Document> {
		//
		// Try each provided name until one exists
		for (const name of names) {
			if (value[name] != undefined) {
				const result = value[name]

				switch (typeof result) {
					case "object":
						return new Document(result)

					case "string":
						return await new Document().fromURL(result)
				}
			}
		}

		return new Document()
	}
}
