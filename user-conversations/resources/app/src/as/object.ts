import { toString } from "./utils"
import * as convert from "./convert"
import * as vocab from "./vocab"

type map = { [key: string]: any }

// JSONLD is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Object {

	#value: map

	constructor(value?: map) {
		if (value != undefined) {
			this.#value = value
		} else {
			this.#value = {}
		}

		// Default @context to ActivityStreams if not provided
		if (this.#value["@context"] == undefined) {
			this.#value["@context"] = vocab.ContextActivityStreams
		}
	}

	///////////////////////////////////
	// Conversion methods

	// fromURL retrieves a JSON document from the specified URL and parses it into the JSONLD struct
	fromURL = async (url: string, options: RequestInit = {}) => {
		//

		// Require Accept: header for ActivityPub
		options["headers"] = {
			Accept: "application/activity+json",
		}

		const response = await fetch(url, options)

		// Report errors
		if (!response.ok) {
			throw new Error(`Unable to fetch url:'${url}': ${response.status} ${response.statusText}`)
		}

		// Parse the JSON response into a JSONLD
		const body = await response.text()
		this.fromJSON(body)
		return this
	}

	// fromJSON parses a JSON string into the JSONLD struct
	fromJSON = (json: string) => {
		this.#value = JSON.parse(json)
		return this
	}

	// toObject returns the raw JSON object represented by this JSONLD struct
	toObject = () => {
		return this.#value
	}

	// toJSON returns a JSON string representation of the JSONLD struct
	toJSON = () => {
		return JSON.stringify(this.#value)
	}

	///////////////////////////////////
	// Setters

	// set sets a property on the JSONLD struct with the given name and value
	set = (name: string, value: any) => {
		this.#value[name] = value
	}

	///////////////////////////////////
	// Property conversion methods

	get(namespace: string, property: string): any {
		var result = this.#value[property]
		if (result != undefined) {
			return result
		}

		result = this.#value[namespace + ":" + property]
		if (result != undefined) {
			return result
		}

		switch (namespace) {
			case "as":
				return this.#value["https://www.w3.org/ns/activitystreams#" + property]

			case "emissary":
				return this.#value["https://emissary.dev/ns#" + property]

			case "mls":
				return this.#value["https://purl.archive.org/socialweb/mls#" + property]

			case "sse":
				return this.#value["https://purl.archive.org/socialweb/sse#" + property]
		}

		return undefined
	}

	getString = (namespace: string, property: string) => {
		return toString(this.get(namespace, property))
	}

	getInteger = (namespace: string, property: string) => {
		const result = this.get(namespace, property)
		return convert.toInteger(result)
	}

	getBoolean = (namespace: string, property: string) => {
		const result = this.get(namespace, property)
		return convert.toBoolean(result)
	}

	getArray = (namespace: string, property: string) => {
		const result = this.get(namespace, property)
		return convert.toArray(result)
	}

	getMap = (namespace: string, property: string): { [key: string]: any } => {
		const result = this.get(namespace, property)
		return convert.toMap(result)
	}

	///////////////////////////////////
	// Properties

	type = () => {
		return this.getString("as", "type")
	}

	id = () => {
		return this.getString("as", "id")
	}
}
