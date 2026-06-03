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
		return new Activity().withProxy(this.#proxyUrl).fromUrl(url)
	}

	Actor(url: string): Promise<Actor> {
		return new Actor().withProxy(this.#proxyUrl).fromUrl(url)
	}

	Document(url: string): Promise<Document> {
		return new Document().withProxy(this.#proxyUrl).fromUrl(url)
	}

	Collection(url: string): Promise<Collection> {
		return new Collection().withProxy(this.#proxyUrl).fromUrl(url)
	}

}