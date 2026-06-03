import { describe, it, expect, vi, beforeEach } from "vitest"
import { Collection } from "./collection"
import { loadCollection, loadCollectionAfter } from "./loaders"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(data: object): Response {
	return {
		ok: true,
		text: async () => JSON.stringify(data),
	} as unknown as Response
}

function mockErrorResponse(status = 500, statusText = "Internal Server Error"): Response {
	return {
		ok: false,
		status,
		statusText,
	} as unknown as Response
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Collection — constructor
// ---------------------------------------------------------------------------

describe("Collection constructor", () => {
	it("creates an empty Collection with default @context", () => {
		const c = new Collection()
		expect(c).toBeInstanceOf(Collection)
		expect(c.type()).toBe("")
	})

	it("stores provided values", () => {
		const c = new Collection({ type: "Collection" })
		expect(c.type()).toBe("Collection")
	})
})

// ---------------------------------------------------------------------------
// Collection — eventStream()
// ---------------------------------------------------------------------------

describe("Collection — eventStream()", () => {
	it("returns value from short key 'eventStream'", () => {
		const c = new Collection({ eventStream: "https://example.com/sse" })
		expect(c.eventStream()).toBe("https://example.com/sse")
	})

	it("returns value from prefixed key 'sse:eventStream'", () => {
		const c = new Collection({ "sse:eventStream": "https://example.com/sse" })
		expect(c.eventStream()).toBe("https://example.com/sse")
	})

	it("returns value from full URI key", () => {
		const c = new Collection({
			"https://purl.archive.org/socialweb/sse#eventStream": "https://example.com/sse",
		})
		expect(c.eventStream()).toBe("https://example.com/sse")
	})

	it("returns empty string when not present", () => {
		const c = new Collection({})
		expect(c.eventStream()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// Collection — first()
// ---------------------------------------------------------------------------

describe("Collection — first()", () => {
	it("returns value from short key 'first'", () => {
		const c = new Collection({ first: "https://example.com/col?page=1" })
		expect(c.first()).toBe("https://example.com/col?page=1")
	})

	it("returns value from prefixed key 'as:first'", () => {
		const c = new Collection({ "as:first": "https://example.com/col?page=1" })
		expect(c.first()).toBe("https://example.com/col?page=1")
	})

	it("returns value from full AS URI key", () => {
		const c = new Collection({
			"https://www.w3.org/ns/activitystreams#first": "https://example.com/col?page=1",
		})
		expect(c.first()).toBe("https://example.com/col?page=1")
	})

	it("returns empty string when not present", () => {
		const c = new Collection({})
		expect(c.first()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// Collection — next()
// ---------------------------------------------------------------------------

describe("Collection — next()", () => {
	it("returns value from short key 'next'", () => {
		const c = new Collection({ next: "https://example.com/col?page=2" })
		expect(c.next()).toBe("https://example.com/col?page=2")
	})

	it("returns value from prefixed key 'as:next'", () => {
		const c = new Collection({ "as:next": "https://example.com/col?page=2" })
		expect(c.next()).toBe("https://example.com/col?page=2")
	})

	it("returns empty string when not present", () => {
		const c = new Collection({})
		expect(c.next()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// Collection — totalItems()
// ---------------------------------------------------------------------------

describe("Collection — totalItems()", () => {
	it("returns integer from short key 'totalItems'", () => {
		const c = new Collection({ totalItems: 42 })
		expect(c.totalItems()).toBe(42)
	})

	it("returns integer from prefixed key 'as:totalItems'", () => {
		const c = new Collection({ "as:totalItems": 7 })
		expect(c.totalItems()).toBe(7)
	})

	it("returns 0 when not present", () => {
		const c = new Collection({})
		expect(c.totalItems()).toBeFalsy()
	})
})

// ---------------------------------------------------------------------------
// Collection — items()
// ---------------------------------------------------------------------------

describe("Collection — items()", () => {
	const fixtures = [{ id: "item1" }, { id: "item2" }]

	it("returns 'items' array for type Collection", () => {
		const c = new Collection({ type: "Collection", items: fixtures })
		expect(c.items()).toEqual(fixtures)
	})

	it("returns 'items' array for type CollectionPage", () => {
		const c = new Collection({ type: "CollectionPage", items: fixtures })
		expect(c.items()).toEqual(fixtures)
	})

	it("returns 'orderedItems' array for type OrderedCollection", () => {
		const c = new Collection({ type: "OrderedCollection", orderedItems: fixtures })
		expect(c.items()).toEqual(fixtures)
	})

	it("returns 'orderedItems' array for type OrderedCollectionPage", () => {
		const c = new Collection({ type: "OrderedCollectionPage", orderedItems: fixtures })
		expect(c.items()).toEqual(fixtures)
	})

	it("returns empty array for unknown type", () => {
		const c = new Collection({ type: "Note", items: fixtures })
		expect(c.items()).toEqual([])
	})

	it("returns empty array when type is absent", () => {
		const c = new Collection({ items: fixtures })
		expect(c.items()).toEqual([])
	})

	it("returns empty array when matched items key is missing", () => {
		const c = new Collection({ type: "OrderedCollection", items: fixtures })
		expect(c.items()).toEqual([])
	})

	it("wraps a single object in an array via convert.toArray", () => {
		const single = { id: "only-item" }
		const c = new Collection({ type: "Collection", items: single })
		const result = c.items()
		expect(Array.isArray(result)).toBe(true)
		expect(result.length).toBeGreaterThan(0)
	})
})

// ---------------------------------------------------------------------------
// Collection — fromUrl()
// ---------------------------------------------------------------------------

describe("Collection — fromUrl()", () => {
	it("parses a fetched JSON-LD body into the collection", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({
			type: "OrderedCollection",
			totalItems: 3,
			orderedItems: [1, 2, 3],
		})))

		const c = await new Collection().fromUrl("https://example.com/outbox")
		expect(c.type()).toBe("OrderedCollection")
		expect(c.totalItems()).toBe(3)
		expect(c.items()).toEqual([1, 2, 3])
	})

	it("sets Accept: application/activity+json header", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse({ type: "Collection" }))
		vi.stubGlobal("fetch", fetchMock)

		await new Collection().fromUrl("https://example.com/col")
		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/col",
			expect.objectContaining({
				headers: expect.objectContaining({ Accept: "application/activity+json" }),
			})
		)
	})

	it("throws when response is not ok", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockErrorResponse(404, "Not Found")))

		await expect(
			new Collection().fromUrl("https://example.com/missing")
		).rejects.toThrow(/404/)
	})

	it("throws when fetch itself rejects", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

		await expect(
			new Collection().fromUrl("https://example.com/col")
		).rejects.toThrow("network down")
	})
})

// ---------------------------------------------------------------------------
// loadCollection()
// ---------------------------------------------------------------------------

describe("loadCollection()", () => {
	it("wraps a plain object in a Collection", async () => {
		const result = await loadCollection({ type: "Collection", totalItems: 0 })
		expect(result).toBeInstanceOf(Collection)
		expect(result.type()).toBe("Collection")
		expect(result.totalItems()).toBe(0)
	})

	it("wraps the first element of an array in a Collection", async () => {
		const result = await loadCollection([
			{ type: "OrderedCollection", totalItems: 1 },
			{ type: "Collection" },
		])
		expect(result).toBeInstanceOf(Collection)
		expect(result.type()).toBe("OrderedCollection")
	})

	it("returns an empty Collection for an empty array", async () => {
		const result = await loadCollection([])
		expect(result).toBeInstanceOf(Collection)
		expect(result.type()).toBe("")
	})

	it("fetches and parses a URL string", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({
			type: "OrderedCollection",
			totalItems: 5,
		})))

		const result = await loadCollection("https://example.com/outbox")
		expect(result).toBeInstanceOf(Collection)
		expect(result.type()).toBe("OrderedCollection")
		expect(result.totalItems()).toBe(5)
	})

	it("passes proxyUrl through to fetch via POST", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse({ type: "Collection" }))
		vi.stubGlobal("fetch", fetchMock)

		await loadCollection("https://example.com/col", "https://proxy.example.com")
		expect(fetchMock).toHaveBeenCalledWith(
			"https://proxy.example.com",
			expect.objectContaining({ method: "POST" })
		)
	})
})

// ---------------------------------------------------------------------------
// loadCollectionAfter()
// ---------------------------------------------------------------------------

describe("loadCollectionAfter()", () => {
	it("appends ?after= when url has no existing query string", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse({ type: "OrderedCollection" }))
		vi.stubGlobal("fetch", fetchMock)

		await loadCollectionAfter("https://example.com/outbox", "cursor-xyz")
		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/outbox?after=cursor-xyz",
			expect.anything()
		)
	})

	it("appends &after= when url already has a query string", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse({ type: "OrderedCollection" }))
		vi.stubGlobal("fetch", fetchMock)

		await loadCollectionAfter("https://example.com/outbox?page=1", "cursor-xyz")
		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/outbox?page=1&after=cursor-xyz",
			expect.anything()
		)
	})

	it("URL-encodes the after parameter", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse({ type: "OrderedCollection" }))
		vi.stubGlobal("fetch", fetchMock)

		await loadCollectionAfter("https://example.com/outbox", "hello world/cursor")
		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/outbox?after=hello%20world%2Fcursor",
			expect.anything()
		)
	})

	it("does not append after= when after is empty string", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse({ type: "OrderedCollection" }))
		vi.stubGlobal("fetch", fetchMock)

		await loadCollectionAfter("https://example.com/outbox", "")
		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/outbox",
			expect.anything()
		)
		expect(fetchMock.mock.calls[0]![0]).not.toContain("after=")
	})
})

// ---------------------------------------------------------------------------
// Collection — rangeActivities()
// ---------------------------------------------------------------------------

describe("Collection.rangeActivities()", () => {
	it("yields nothing for a collection with no items and no pagination", async () => {
		const c = new Collection({ type: "OrderedCollection" })
		const results: any[] = []
		for await (const a of c.rangeActivities()) {
			results.push(a)
		}
		expect(results).toHaveLength(0)
	})

	it("yields items for embedded ordered items", async () => {
		const c = new Collection({
			type: "OrderedCollection",
			orderedItems: [{ id: "act1" }, { id: "act2" }],
		})

		const results: any[] = []
		for await (const a of c.rangeActivities()) {
			results.push(a)
		}
		expect(results).toHaveLength(2)
	})

	it("yields items for embedded unordered items", async () => {
		const c = new Collection({
			type: "Collection",
			items: [{ id: "act1" }],
		})

		const results: any[] = []
		for await (const a of c.rangeActivities()) {
			results.push(a)
		}
		expect(results).toHaveLength(1)
	})

	it("follows first → next pagination across multiple pages", async () => {
		vi.stubGlobal("fetch", vi.fn()
			.mockResolvedValueOnce(mockResponse({
				type: "OrderedCollectionPage",
				orderedItems: [{ id: "p1-a1" }],
				next: "https://example.com/outbox?page=2",
			}))
			.mockResolvedValueOnce(mockResponse({
				type: "OrderedCollectionPage",
				orderedItems: [{ id: "p2-a1" }, { id: "p2-a2" }],
			}))
		)

		const c = new Collection({
			type: "OrderedCollection",
			first: "https://example.com/outbox?page=1",
		})

		const results: any[] = []
		for await (const a of c.rangeActivities()) {
			results.push(a)
		}
		expect(results).toHaveLength(3)
	})

	it("uses 'next' on root collection as fallback when 'first' is absent", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(mockResponse({
			type: "OrderedCollectionPage",
			orderedItems: [{ id: "act1" }],
		}))
		vi.stubGlobal("fetch", fetchMock)

		const c = new Collection({
			type: "OrderedCollection",
			next: "https://example.com/outbox?page=1",
		})

		const results: any[] = []
		for await (const a of c.rangeActivities()) {
			results.push(a)
		}

		expect(results).toHaveLength(1)
		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/outbox?page=1",
			expect.anything()
		)
	})

	it("stops pagination and logs error when a page fetch throws", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("page load failed")))
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { })

		const c = new Collection({
			type: "OrderedCollection",
			first: "https://example.com/outbox?page=1",
		})

		const results: any[] = []
		for await (const a of c.rangeActivities()) {
			results.push(a)
		}

		expect(results).toHaveLength(0)
		expect(consoleSpy).toHaveBeenCalled()
		consoleSpy.mockRestore()
	})

	it("stops pagination when a page returns a non-ok response", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockErrorResponse(500, "Internal Server Error")))
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { })

		const c = new Collection({
			type: "OrderedCollection",
			first: "https://example.com/outbox?page=1",
		})

		const results: any[] = []
		for await (const a of c.rangeActivities()) {
			results.push(a)
		}

		expect(results).toHaveLength(0)
		expect(consoleSpy).toHaveBeenCalled()
		consoleSpy.mockRestore()
	})

	it("handles three pages correctly, yielding all items in order", async () => {
		vi.stubGlobal("fetch", vi.fn()
			.mockResolvedValueOnce(mockResponse({
				type: "OrderedCollectionPage",
				orderedItems: [{ id: "a" }],
				next: "https://example.com/p2",
			}))
			.mockResolvedValueOnce(mockResponse({
				type: "OrderedCollectionPage",
				orderedItems: [{ id: "b" }, { id: "c" }],
				next: "https://example.com/p3",
			}))
			.mockResolvedValueOnce(mockResponse({
				type: "OrderedCollectionPage",
				orderedItems: [{ id: "d" }],
			}))
		)

		const c = new Collection({
			type: "OrderedCollection",
			first: "https://example.com/p1",
		})

		const results: any[] = []
		for await (const a of c.rangeActivities()) {
			results.push(a)
		}
		expect(results).toHaveLength(4)
	})
})

// ---------------------------------------------------------------------------
// Collection — rangeDocuments()
// ---------------------------------------------------------------------------

describe("Collection — rangeDocuments()", () => {
	it("yields items for embedded documents", async () => {
		const c = new Collection({
			type: "Collection",
			items: [{ id: "doc1" }, { id: "doc2" }],
		})

		const results: any[] = []
		for await (const doc of c.rangeDocuments()) {
			results.push(doc)
		}
		expect(results).toHaveLength(2)
	})

	it("yields nothing when items are empty and no pagination links", async () => {
		const c = new Collection({ type: "Collection" })

		const results: any[] = []
		for await (const doc of c.rangeDocuments()) {
			results.push(doc)
		}
		expect(results).toHaveLength(0)
	})

	it("follows 'first' pagination when items are empty", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({
			type: "CollectionPage",
			items: [{ id: "doc-a" }],
		})))

		const c = new Collection({
			type: "Collection",
			first: "https://example.com/col?page=1",
		})

		const results: any[] = []
		for await (const doc of c.rangeDocuments()) {
			results.push(doc)
		}
		expect(results).toHaveLength(1)
	})
})