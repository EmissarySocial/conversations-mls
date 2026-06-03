// Loaders NEED to be in a separate file to avoid circular dependencies between ASObject and ASActivity

import { Actor } from "./actor"
import { Activity } from "./activity"
import { Collection } from "./collection"
import { Document } from "./document"

export async function loadActivity(value: any, proxyUrl: string = ""): Promise<Activity> {
	return new Activity().withProxy(proxyUrl).fromValue(value)
}

export async function loadActor(value: any, proxyUrl: string = ""): Promise<Actor> {
	return new Actor().withProxy(proxyUrl).fromValue(value)
}

export async function loadDocument(value: any, proxyUrl: string = ""): Promise<Document> {
	return new Document().withProxy(proxyUrl).fromValue(value)
}

export async function loadCollection(value: any, proxyUrl: string = ""): Promise<Collection> {
	return new Collection().withProxy(proxyUrl).fromValue(value)
}

export async function loadCollectionAfter(url: string, after: string, proxyUrl: string = ""): Promise<Collection> {

	if (after != "") {
		if (url.includes("?")) {
			url = url + "&after=" + encodeURIComponent(after)
		} else {
			url = url + "?after=" + encodeURIComponent(after)
		}
	}

	return loadCollection(url, proxyUrl)
}