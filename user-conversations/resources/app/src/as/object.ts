import { toString } from "./utils"
import * as convert from "./convert"
import * as vocab from "./vocab"
type map = { [key: string]: any }

// JSONLD is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Object {

	#proxyUrl: string = ""
	#value: map

	constructor(value?: map) {

		if (value == undefined) {
			this.#value = {}
		} else {
			this.#value = value
		}

		// Default @context to ActivityStreams if not provided
		if (this.#value["@context"] == undefined) {
			this.#value["@context"] = vocab.ContextActivityStreams
		}
	}

	///////////////////////////////////
	// Conversion methods

	// setProxy sets a proxyUrl for fetching remote objects.
	setProxy(proxyUrl: string) {
		this.#proxyUrl = proxyUrl
		return this
	}

	// fromProxy retrieves a JSON document from the specified URL via the proxy server and parses it into the JSONLD struct
	fromProxy = async (proxyUrl: string, url: string): Promise<this> => {

		// If a proxy URL is not available, just fetch the document directly
		if (proxyUrl == "") {
			return this.fromURL(url, {})
		}

		// Save the proxyUrl for subsequent requests
		this.#proxyUrl = proxyUrl

		// Send a request to the proxy server
		const response = await fetch(this.#proxyUrl, {
			method: "POST",
			body: JSON.stringify({ id: url })
		})

		if (!response.ok) {
			throw new Error(`Unable to fetch url:'${url}' via proxy:'${this.#proxyUrl}': ${response.status} ${response.statusText}`)
		}

		// Parse the response and return
		const body = await response.text()
		this.fromJSON(body)
		return this
	}

	// fromURL retrieves a JSON document from the specified URL and parses it into the JSONLD struct
	fromURL = async (url: string, options: RequestInit = {}): Promise<this> => {

		if (this.#proxyUrl != "") {
			return this.fromProxy(this.#proxyUrl, url)
		}

		// Otherwise, fetch the document directly from the URL
		console.warn("Fetching remote URL directly from the server: " + url)

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
		let result = this.#value[property]
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

	getWithNamespace(namespace: string, property: string): any {
		return this.#value[namespace + ":" + property]
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

	getArrayOfString = (namespace: string, property: string) => {
		const result = this.get(namespace, property)
		return convert.toArrayOfString(result)
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

	types = () => {
		return this.getArrayOfString("as", "type")
	}

	id = () => {
		return this.getString("as", "id")
	}
}
