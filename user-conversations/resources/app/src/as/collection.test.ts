import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Collection, loadCollection, rangeActivities } from "./collection"
import { loadActivity } from "./activity"
import { loadDocument } from "./document"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("./activity", () => ({
	loadActivity: vi.fn(async (item: any) => ({ _type: "Activity", raw: item })),
}))

vi.mock("./document", () => ({
	loadDocument: vi.fn(async (item: any) => ({ _type: "Document", raw: item })),
}))

// Helper: build a Response-like object for global fetch mock
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
// Namespace "sse" resolves via: "eventStream" → "sse:eventStream" → full URI
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

	it("returns 0 (or falsy) when not present", () => {
		const c = new Collection({})
		// convert.toInteger(undefined) — exact value depends on your convert module,
		// but it must be falsy / 0-like
		expect(c.totalItems()).toBeFalsy()
	})
})

// ---------------------------------------------------------------------------
// Collection — items() — type dispatch
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

	it("returns empty array when items key is present but type is wrong", () => {
		const c = new Collection({ type: "Person", items: fixtures })
		expect(c.items()).toEqual([])
	})

	it("returns empty array when the matched items key is missing", () => {
		// type says OrderedCollection but only 'items' key exists (wrong key)
		const c = new Collection({ type: "OrderedCollection", items: fixtures })
		// orderedItems is not present, so getArray returns []
		expect(c.items()).toEqual([])
	})

	it("wraps a single object in an array (via convert.toArray)", () => {
		// If the items property is a single object rather than an array,
		// convert.toArray should normalise it
		const single = { id: "only-item" }
		const c = new Collection({ type: "Collection", items: single })
		const result = c.items()
		expect(Array.isArray(result)).toBe(true)
		expect(result.length).toBeGreaterThan(0)
	})
})

// ---------------------------------------------------------------------------
// Collection — fromURL (via Object base class)
// ---------------------------------------------------------------------------

describe("Collection — fromURL()", () => {
	it("parses a fetched JSON-LD body into the collection", async () => {
		const data = { type: "OrderedCollection", totalItems: 3, orderedItems: [1, 2, 3] }
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(data)))

		const c = await new Collection().fromURL("https://example.com/outbox")
		expect(c.type()).toBe("OrderedCollection")
		expect(c.totalItems()).toBe(3)
		expect(c.items()).toEqual([1, 2, 3])

		vi.unstubAllGlobals()
	})

	it("sets Accept: application/activity+json header", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse({ type: "Collection" }))
		vi.stubGlobal("fetch", fetchMock)

		await new Collection().fromURL("https://example.com/col")
		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/col",
			expect.objectContaining({
				headers: expect.objectContaining({ Accept: "application/activity+json" }),
			})
		)

		vi.unstubAllGlobals()
	})

	it("throws when response is not ok", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockErrorResponse(404, "Not Found")))

		await expect(new Collection().fromURL("https://example.com/missing")).rejects.toThrow(
			/404/
		)

		vi.unstubAllGlobals()
	})

	it("throws when fetch itself rejects", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

		await expect(new Collection().fromURL("https://example.com/col")).rejects.toThrow(
			"network down"
		)

		vi.unstubAllGlobals()
	})
})

// ---------------------------------------------------------------------------
// Collection — rangeDocuments()
// ---------------------------------------------------------------------------

describe("Collection — rangeDocuments()", () => {
	it("yields loadDocument results for embedded items", async () => {
		const items = [{ id: "doc1" }, { id: "doc2" }]
		const c = new Collection({ type: "Collection", items })

		const results: any[] = []
		for await (const doc of c.rangeDocuments()) {
			results.push(doc)
		}

		expect(loadDocument).toHaveBeenCalledTimes(2)
		expect(results).toHaveLength(2)
		expect(results[0]).toEqual({ _type: "Document", raw: { id: "doc1" } })
		expect(results[1]).toEqual({ _type: "Document", raw: { id: "doc2" } })
	})

	it("yields nothing when items are empty and no pagination links", async () => {
		const c = new Collection({ type: "Collection" })

		const results: any[] = []
		for await (const doc of c.rangeDocuments()) {
			results.push(doc)
		}

		expect(results).toHaveLength(0)
		expect(loadDocument).not.toHaveBeenCalled()
	})

	it("follows 'first' pagination when items are empty", async () => {
		const root = new Collection({ type: "Collection", first: "https://example.com/col?page=1" })

		const pageData = {
			type: "CollectionPage",
			items: [{ id: "doc-a" }],
		}
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(pageData)))

		const results: any[] = []
		for await (const doc of root.rangeDocuments()) {
			results.push(doc)
		}

		expect(results).toHaveLength(1)
		expect(loadDocument).toHaveBeenCalledTimes(1)

		vi.unstubAllGlobals()
	})
})

// ---------------------------------------------------------------------------
// loadCollection()
// ---------------------------------------------------------------------------

describe("loadCollection()", () => {
	it("returns a Collection wrapping a plain object", async () => {
		const result = await loadCollection({ type: "Collection", totalItems: 0 })
		expect(result).toBeInstanceOf(Collection)
		expect(result.type()).toBe("Collection")
	})

	it("returns a Collection from the first element of an array", async () => {
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

	it("returns an empty Collection for null", async () => {
		const result = await loadCollection(null)
		expect(result).toBeInstanceOf(Collection)
		expect(result.type()).toBe("")
	})

	it("returns an empty Collection for a number", async () => {
		const result = await loadCollection(123)
		expect(result).toBeInstanceOf(Collection)
	})

	it("returns an empty Collection for a boolean", async () => {
		const result = await loadCollection(true)
		expect(result).toBeInstanceOf(Collection)
	})

	it("fetches and parses a URL string", async () => {
		const data = { type: "OrderedCollection", totalItems: 5 }
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(data)))

		const result = await loadCollection("https://example.com/outbox")
		expect(result).toBeInstanceOf(Collection)
		expect(result.type()).toBe("OrderedCollection")
		expect(result.totalItems()).toBe(5)

		vi.unstubAllGlobals()
	})
})

// ---------------------------------------------------------------------------
// rangeActivities()
// ---------------------------------------------------------------------------

describe("rangeActivities()", () => {
	it("yields nothing for an empty URL", async () => {
		const results: any[] = []
		for await (const a of rangeActivities("")) {
			results.push(a)
		}
		expect(results).toHaveLength(0)
		expect(loadActivity).not.toHaveBeenCalled()
	})

	it("yields loadActivity results for embedded ordered items", async () => {
		const data = {
			type: "OrderedCollection",
			orderedItems: [{ id: "act1" }, { id: "act2" }],
		}
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(data)))

		const results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(loadActivity).toHaveBeenCalledTimes(2)
		expect(results[0]).toEqual({ _type: "Activity", raw: { id: "act1" } })
		expect(results[1]).toEqual({ _type: "Activity", raw: { id: "act2" } })

		vi.unstubAllGlobals()
	})

	it("yields loadActivity results for embedded unordered items", async () => {
		const data = {
			type: "Collection",
			items: [{ id: "act1" }],
		}
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(data)))

		let results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(loadActivity).toHaveBeenCalledTimes(1)
		vi.unstubAllGlobals()
	})

	it("appends ?after= when url has no existing query string", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(mockResponse({ type: "OrderedCollection", orderedItems: [] }))
		vi.stubGlobal("fetch", fetchMock)

		for await (const _ of rangeActivities("https://example.com/outbox", "cursor-xyz")) {
			// drain
		}

		const calledUrl = fetchMock.mock.calls[0][0]
		expect(calledUrl).toBe("https://example.com/outbox?after=cursor-xyz")

		vi.unstubAllGlobals()
	})

	it("appends &after= when url already has a query string", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(mockResponse({ type: "OrderedCollection", orderedItems: [] }))
		vi.stubGlobal("fetch", fetchMock)

		for await (const _ of rangeActivities("https://example.com/outbox?page=1", "cursor-xyz")) {
			// drain
		}

		const calledUrl = fetchMock.mock.calls[0][0]
		expect(calledUrl).toBe("https://example.com/outbox?page=1&after=cursor-xyz")

		vi.unstubAllGlobals()
	})

	it("URL-encodes the after parameter", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(mockResponse({ type: "OrderedCollection", orderedItems: [] }))
		vi.stubGlobal("fetch", fetchMock)

		for await (const _ of rangeActivities("https://example.com/outbox", "hello world/cursor")) {
			// drain
		}

		const calledUrl = fetchMock.mock.calls[0][0]
		expect(calledUrl).toBe("https://example.com/outbox?after=hello%20world%2Fcursor")

		vi.unstubAllGlobals()
	})

	it("does not append after= when after is empty string", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(mockResponse({ type: "OrderedCollection", orderedItems: [] }))
		vi.stubGlobal("fetch", fetchMock)

		for await (const _ of rangeActivities("https://example.com/outbox", "")) {
			// drain
		}

		const calledUrl = fetchMock.mock.calls[0][0]
		expect(calledUrl).toBe("https://example.com/outbox")
		expect(calledUrl).not.toContain("after=")

		vi.unstubAllGlobals()
	})

	it("yields nothing and logs error when fetch throws", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")))
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { })

		const results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(results).toHaveLength(0)
		expect(consoleSpy).toHaveBeenCalled()

		vi.unstubAllGlobals()
		consoleSpy.mockRestore()
	})

	it("yields nothing and logs error when response is not ok", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockErrorResponse(403, "Forbidden")))
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { })

		const results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(results).toHaveLength(0)
		expect(consoleSpy).toHaveBeenCalled()

		vi.unstubAllGlobals()
		consoleSpy.mockRestore()
	})

	it("follows first → next pagination across multiple pages", async () => {
		const rootData = { type: "OrderedCollection", first: "https://example.com/outbox?page=1" }
		const page1Data = {
			type: "OrderedCollectionPage",
			orderedItems: [{ id: "p1-a1" }],
			next: "https://example.com/outbox?page=2",
		}
		const page2Data = {
			type: "OrderedCollectionPage",
			orderedItems: [{ id: "p2-a1" }, { id: "p2-a2" }],
			// no next → pagination ends
		}

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse(rootData))
			.mockResolvedValueOnce(mockResponse(page1Data))
			.mockResolvedValueOnce(mockResponse(page2Data))
		vi.stubGlobal("fetch", fetchMock)

		const results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(fetchMock).toHaveBeenCalledTimes(3)
		expect(loadActivity).toHaveBeenCalledTimes(3)
		expect(results).toHaveLength(3)

		vi.unstubAllGlobals()
	})

	it("uses 'next' on root collection as fallback when 'first' is absent", async () => {
		const rootData = { type: "OrderedCollection", next: "https://example.com/outbox?page=1" }
		const pageData = {
			type: "OrderedCollectionPage",
			orderedItems: [{ id: "act1" }],
		}

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse(rootData))
			.mockResolvedValueOnce(mockResponse(pageData))
		vi.stubGlobal("fetch", fetchMock)

		const results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(fetchMock).toHaveBeenCalledTimes(2)
		const secondUrl = fetchMock.mock.calls[1][0]
		expect(secondUrl).toBe("https://example.com/outbox?page=1")
		expect(results).toHaveLength(1)

		vi.unstubAllGlobals()
	})

	it("stops pagination and logs error when a page fetch throws", async () => {
		const rootData = { type: "OrderedCollection", first: "https://example.com/outbox?page=1" }

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse(rootData))
			.mockRejectedValueOnce(new Error("page load failed"))
		vi.stubGlobal("fetch", fetchMock)
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { })

		const results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(results).toHaveLength(0)
		expect(consoleSpy).toHaveBeenCalled()

		vi.unstubAllGlobals()
		consoleSpy.mockRestore()
	})

	it("stops pagination when a page returns a non-ok response", async () => {
		const rootData = { type: "OrderedCollection", first: "https://example.com/outbox?page=1" }

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse(rootData))
			.mockResolvedValueOnce(mockErrorResponse(500, "Internal Server Error"))
		vi.stubGlobal("fetch", fetchMock)
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { })

		const results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(results).toHaveLength(0)
		expect(consoleSpy).toHaveBeenCalled()

		vi.unstubAllGlobals()
		consoleSpy.mockRestore()
	})

	it("handles three pages correctly, yielding all items in order", async () => {
		const pages = [
			{ type: "OrderedCollection", first: "https://example.com/p1" },
			{ type: "OrderedCollectionPage", orderedItems: [{ id: "a" }], next: "https://example.com/p2" },
			{ type: "OrderedCollectionPage", orderedItems: [{ id: "b" }, { id: "c" }], next: "https://example.com/p3" },
			{ type: "OrderedCollectionPage", orderedItems: [{ id: "d" }] },
		]

		const fetchMock = vi.fn()
		for (const page of pages) {
			fetchMock.mockResolvedValueOnce(mockResponse(page))
		}
		vi.stubGlobal("fetch", fetchMock)

		// loadActivity is identity-ish; track raw items
		vi.mocked(loadActivity).mockImplementation(async (item: any) => item)

		const results: any[] = []
		for await (const a of rangeActivities("https://example.com/outbox")) {
			results.push(a)
		}

		expect(results).toHaveLength(4)
		expect(results.map((r) => r.id)).toEqual(["a", "b", "c", "d"])

		vi.unstubAllGlobals()
	})
})