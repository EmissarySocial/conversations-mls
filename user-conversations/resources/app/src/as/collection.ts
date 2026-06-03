import { loadActivity, loadActor, loadCollection, loadDocument } from "./loaders"
import { ASObject } from "./object"

export class Collection extends ASObject {

	// eventStream returns the value of the "eventStream" property
	eventStream() {
		return this.getString("sse", "eventStream")
	}

	// first returns the value of the "first" property, which is used for pagination in ActivityPub collections
	first() {
		return this.getString("as", "first")
	}

	// items returns the value of the "items" or "orderedItems" property, depending on the type of object (Collection or OrderedCollection)
	items() {
		let result = []

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
	next() {
		return this.getString("as", "next")
	}

	totalItems() {
		return this.getInteger("as", "totalItems")
	}

	// rangeActivities returns all of the items in a collection, typed as Activities
	async *rangeActivities() {
		const items = this.#range()

		for await (const item of items) {
			yield loadActivity(item, this.getProxyUrl())
		}
	}

	// rangeActors returns all of the items in a collection, typed as Actors
	async *rangeActors() {
		const items = this.#range()

		for await (const item of items) {
			yield loadActor(item, this.getProxyUrl())
		}
	}

	// rangeDocuments returns all of the items in a collection, typed as Documents
	async *rangeDocuments() {
		const items = this.#range()

		for await (const item of items) {
			yield loadDocument(item, this.getProxyUrl())
		}
	}

	// Async generator that fetches an ActivityPub collection and yields each item one by one.
	// Automatically handles pagination by following 'first' and 'next' links...
	async* #range(afteroptions: RequestInit = {}): AsyncGenerator<any> {

		// If items are embedded directly in the page, then just return those
		const items = this.items()
		if (items.length > 0) {
			for (const item of items) {
				yield item
			}
			return
		}

		// Iterate on CollectionPages, starting with the "first" page
		let pageUrl = this.first() || this.next()

		while (pageUrl) {

			try {
				let page = await loadCollection(pageUrl, this.getProxyUrl())

				for (const item of page.items()) {
					yield item
				}

				pageUrl = page.next()

			} catch (error) {
				console.error("Unable to fetch collection page:", pageUrl, error)
				return
			}
		}
	}
}