import { Activity } from "../as/activity"
import { Actor } from "../as/actor"
import { Collection } from "../as/collection"
import { Document } from "../as/document"

export class Proxy {

	#proxyUrl: string

	constructor(proxyUrl: string = "/.proxy") {
		this.#proxyUrl = proxyUrl
	}

	setProxyUrl(proxyUrl: string) {
		this.#proxyUrl = proxyUrl
	}

	Activity(url: string): Promise<Activity> {
		return new Activity().fromProxy(this.#proxyUrl, url)
	}

	Actor(url: string): Promise<Actor> {
		return new Actor().fromProxy(this.#proxyUrl, url)
	}

	Document(url: string): Promise<Document> {
		return new Document().fromProxy(this.#proxyUrl, url)
	}

	Collection(url: string): Promise<Collection> {
		return new Collection().fromProxy(this.#proxyUrl, url)
	}

}