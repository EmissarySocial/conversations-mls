import { isArray, isObject, isString, toString } from "./utils"
import * as convert from "./convert"
import * as vocab from "./vocab"

type map = { [key: string]: any }

// JSONLD is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class ASObject {

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

	// withProxy sets a proxyUrl for fetching remote objects.
	withProxy(proxyUrl: string) {
		this.#proxyUrl = proxyUrl
		return this
	}

	// #fromProxy retrieves a JSON document from the specified URL via the proxy server and parses it into the JSONLD struct
	async #fromProxy(url: string): Promise<this> {

		console.log("fromProxy:", url)

		// Send a request to the proxy server
		const response = await fetch(this.#proxyUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				"id": url
			})
		})

		if (!response.ok) {
			throw new Error(`Unable to fetch url:'${url}' via proxy:'${this.#proxyUrl}': ${response.status} ${response.statusText}`)
		}

		// Parse the response and return
		const body = await response.text()
		this.fromJSON(body)
		return this
	}

	// fromUrl retrieves a JSON document from the specified URL and parses it into the JSONLD struct
	async fromUrl(url: string): Promise<this> {

		console.log("fromUrl:", url)

		// If we have a proxy URL, then use it to fetch the document
		if (this.#proxyUrl != "") {
			return this.#fromProxy(url)
		}

		// Require Accept: header for ActivityPub
		const options = {
			"headers": {
				Accept: "application/activity+json",
			}
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

	fromMap(value: map): this {
		this.#value = value
		return this
	}

	async fromValue(value: any): Promise<this> {

		if (isString(value)) {
			return this.fromUrl(value)
		}

		if (isObject(value)) {
			return this.fromMap(value)
		}

		if (isArray(value)) {
			if (value.length > 0) {
				return await this.fromValue(value[0])
			}
			return this
		}

		console.warn("Unable to convert value to Object:", value)
		return this
	}

	// fromJSON parses a JSON string into the JSONLD struct
	fromJSON(json: string): this {
		this.#value = JSON.parse(json)
		return this
	}

	// toObject returns the raw JSON object represented by this JSONLD struct
	toObject(): map {
		return this.#value
	}

	// toJSON returns a JSON string representation of the JSONLD struct
	toJSON(): string {
		return JSON.stringify(this.#value)
	}

	///////////////////////////////////
	// Setters

	// set sets a property on the JSONLD struct with the given name and value
	set(name: string, value: any) {
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

	getString(namespace: string, property: string): string {
		return toString(this.get(namespace, property))
	}

	getInteger(namespace: string, property: string): number {
		const result = this.get(namespace, property)
		return convert.toInteger(result)
	}

	getBoolean(namespace: string, property: string): boolean {
		const result = this.get(namespace, property)
		return convert.toBoolean(result)
	}

	getArray(namespace: string, property: string): any[] {
		const result = this.get(namespace, property)
		return convert.toArray(result)
	}

	getArrayOfString(namespace: string, property: string): string[] {
		const result = this.get(namespace, property)
		return convert.toArrayOfString(result)
	}

	getMap(namespace: string, property: string): { [key: string]: any } {
		const result = this.get(namespace, property)
		return convert.toMap(result)
	}

	///////////////////////////////////
	// Properties

	type(): string {
		return this.getString("as", "type")
	}

	types(): string[] {
		return this.getArrayOfString("as", "type")
	}

	id(): string {
		return this.getString("as", "id")
	}

	/*
	///////////////////////////////////
	// Additional ActivityStreams objects

	async newActor(value: any): Promise<Actor> {
		return new Actor().withProxy(this.#proxyUrl).fromValue(value)
	}

	async newActivity(value: any): Promise<Activity> {
		return new Activity().withProxy(this.#proxyUrl).fromValue(value)
	}

	async newCollection(value: any): Promise<Collection> {
		return new Collection().withProxy(this.#proxyUrl).fromValue(value)
	}

	async newDocument(value: any): Promise<Document> {
		return new Document().withProxy(this.#proxyUrl).fromValue(value)
	}
	*/

}
