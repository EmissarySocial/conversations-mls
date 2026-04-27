import { Object } from "./object"
import { loadActivity } from "./activity"
import { loadDocument } from "./document"

export class Collection extends Object {
	//

	// eventStream returns the value of the "eventStream" property
	eventStream = () => {
		return this.getString("sse", "eventStream")
	}

	// first returns the value of the "first" property, which is used for pagination in ActivityPub collections
	first = () => {
		return this.getString("as", "first")
	}

	// items returns the value of the "items" or "orderedItems" property, depending on the type of object (Collection or OrderedCollection)
	items = () => {
		var result = []

		switch (this.type()) {
			case "Collection":
			case "CollectionPage":
				return this.getArray("as", "items")

			case "OrderedCollection":
			case "OrderedCollectionPage":
				return this.getArray("as", "orderedItems")
		}

		return []
	}

	// next returns the value of the "next" property, which is used for pagination in ActivityPub collections
	next = () => {
		return this.getString("as", "next")
	}

	totalItems = () => {
		return this.getInteger("as", "totalItems")
	}
}

export async function loadCollection(value: any) {
	switch (typeof value) {
		case "string":
			return await new Collection().fromURL(value)

		case "object":
			if (Array.isArray(value)) {
				if (value.length > 0) {
					return new Collection(value[0])
				}
			} else {
				return new Collection(value)
			}
	}

	return new Collection()
}

// rangeActivities returns all of the items in a collection, typed as Activities
export async function* rangeActivities(url: string, after: string = "", options: RequestInit = {}) {
	const items = range(url, after, options)

	for await (const item of items) {
		yield await loadActivity(item)
	}
}

// rangeDocuments returns all of the items in a collection, typed as Documents
export async function* rangeDocuments(url: string, after: string = "", options: RequestInit = {}) {
	const items = range(url, after, options)

	for await (const item of items) {
		yield await loadDocument(item)
	}
}

// Async generator that fetches an ActivityPub collection and yields each item one by one.
// Automatically handles pagination by following 'first' and 'next' links...
async function* range(url: string, after: string = "", options: RequestInit = {}): AsyncGenerator<any> {
	//
	// RULE: URL must not be empty
	if (url == "") {
		return
	}

	// RULE: Append "after" argument if not empty
	if (after != "") {
		if (url.includes("?")) {
			url = url + "&after=" + encodeURIComponent(after)
		} else {
			url = url + "?after=" + encodeURIComponent(after)
		}
	}

	// Fetch the collection
	var collection: Collection
	try {
		collection = await new Collection().fromURL(url, options)
	} catch (error) {
		console.error("Error fetching collection:", url, error)
		return
	}

	// If items are embedded directly in the page, then just return those
	const items = collection.items()
	if (items.length > 0) {
		for await (const item of items) {
			yield item
		}
		return
	}

	// Iterate on CollectionPages, starting with the "first" page
	var pageUrl = collection.first() || collection.next()

	while (pageUrl) {
		var page: Collection

		try {
			page = await new Collection().fromURL(pageUrl, options)
		} catch (error) {
			console.error("Unable to fetch collection page:", pageUrl, error)
			return
		}

		for await (const item of page.items()) {
			yield item
		}

		pageUrl = page.next()
	}
}
