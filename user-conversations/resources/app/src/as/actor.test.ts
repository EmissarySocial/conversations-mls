import { describe, it, expect, vi, beforeEach } from "vitest"
import { Actor } from "./actor"
import { Collection } from "./collection"
import { Document } from "./document"
import * as vocab from "./vocab"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActor(overrides: Record<string, any> = {}): Actor {
	return new Actor({
		"@context": vocab.ContextActivityStreams,
		type: "Person",
		...overrides,
	})
}

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
// Constructor
// ---------------------------------------------------------------------------

describe("Actor constructor", () => {
	it("creates an empty Actor with default @context", () => {
		const a = new Actor()
		expect(a).toBeInstanceOf(Actor)
		expect(a.type()).toBe("")
	})

	it("stores provided values", () => {
		const a = makeActor({ type: "Person" })
		expect(a.type()).toBe("Person")
	})
})

// ---------------------------------------------------------------------------
// icon()
// ---------------------------------------------------------------------------

describe("Actor — icon()", () => {
	it("returns value from short key", () => {
		const a = makeActor({ icon: "https://example.com/icon.png" })
		expect(a.icon()).toBe("https://example.com/icon.png")
	})

	it("returns value from prefixed key 'as:icon'", () => {
		const a = makeActor({ "as:icon": "https://example.com/icon.png" })
		expect(a.icon()).toBe("https://example.com/icon.png")
	})

	it("returns empty string when not present", () => {
		const a = makeActor()
		expect(a.icon()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// id()
// ---------------------------------------------------------------------------

describe("Actor — id()", () => {
	it("returns value from short key", () => {
		const a = makeActor({ id: "https://example.com/users/alice" })
		expect(a.id()).toBe("https://example.com/users/alice")
	})

	it("returns value from prefixed key 'as:id'", () => {
		const a = makeActor({ "as:id": "https://example.com/users/alice" })
		expect(a.id()).toBe("https://example.com/users/alice")
	})

	it("returns empty string when not present", () => {
		const a = makeActor()
		expect(a.id()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// name()
// ---------------------------------------------------------------------------

describe("Actor — name()", () => {
	it("returns value from short key", () => {
		const a = makeActor({ name: "Alice" })
		expect(a.name()).toBe("Alice")
	})

	it("returns empty string when not present", () => {
		const a = makeActor()
		expect(a.name()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// outbox()
// ---------------------------------------------------------------------------

describe("Actor — outbox()", () => {
	it("returns value from short key", () => {
		const a = makeActor({ outbox: "https://example.com/users/alice/outbox" })
		expect(a.outbox()).toBe("https://example.com/users/alice/outbox")
	})

	it("returns empty string when not present", () => {
		const a = makeActor()
		expect(a.outbox()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// preferredUsername()
// ---------------------------------------------------------------------------

describe("Actor — preferredUsername()", () => {
	it("returns value from short key", () => {
		const a = makeActor({ preferredUsername: "alice" })
		expect(a.preferredUsername()).toBe("alice")
	})

	it("returns empty string when not present", () => {
		const a = makeActor()
		expect(a.preferredUsername()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// summary()
// ---------------------------------------------------------------------------

describe("Actor — summary()", () => {
	it("returns value from short key", () => {
		const a = makeActor({ summary: "Hello, I am Alice" })
		expect(a.summary()).toBe("Hello, I am Alice")
	})

	it("returns empty string when not present", () => {
		const a = makeActor()
		expect(a.summary()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// type()
// ---------------------------------------------------------------------------

describe("Actor — type()", () => {
	it("returns Person", () => {
		const a = makeActor({ type: "Person" })
		expect(a.type()).toBe("Person")
	})

	it("returns Service", () => {
		const a = makeActor({ type: "Service" })
		expect(a.type()).toBe("Service")
	})

	it("returns empty string when not present", () => {
		const a = new Actor()
		expect(a.type()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// proxyUrl()
// ---------------------------------------------------------------------------

describe("Actor — proxyUrl()", () => {
	it("returns proxyUrl from endpoints map", () => {
		const a = makeActor({
			endpoints: {
				proxyUrl: "https://example.com/proxy",
			},
		})
		expect(a.proxyUrl()).toBe("https://example.com/proxy")
	})

	it("returns empty string when endpoints is absent", () => {
		const a = makeActor()
		expect(a.proxyUrl()).toBe("")
	})

	it("returns empty string when endpoints exists but proxyUrl is absent", () => {
		const a = makeActor({ endpoints: {} })
		expect(a.proxyUrl()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// usernameOrId()
// ---------------------------------------------------------------------------

describe("Actor — usernameOrId()", () => {
	it("returns preferredUsername when present", () => {
		const a = makeActor({
			preferredUsername: "alice",
			id: "https://example.com/users/alice",
		})
		expect(a.usernameOrId()).toBe("alice")
	})

	it("falls back to id when preferredUsername is absent", () => {
		const a = makeActor({ id: "https://example.com/users/alice" })
		expect(a.usernameOrId()).toBe("https://example.com/users/alice")
	})

	it("returns empty string when both are absent", () => {
		const a = makeActor()
		expect(a.usernameOrId()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// mlsMessages()
// ---------------------------------------------------------------------------

describe("Actor — mlsMessages()", () => {
	it("returns value from short key 'messages'", () => {
		const a = makeActor({ messages: "https://example.com/users/alice/messages" })
		expect(a.mlsMessages()).toBe("https://example.com/users/alice/messages")
	})

	it("returns value from prefixed key 'mls:messages'", () => {
		const a = makeActor({ "mls:messages": "https://example.com/users/alice/messages" })
		expect(a.mlsMessages()).toBe("https://example.com/users/alice/messages")
	})

	it("returns empty string when not present", () => {
		const a = makeActor()
		expect(a.mlsMessages()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// mlsKeyPackages()
// ---------------------------------------------------------------------------

describe("Actor — mlsKeyPackages()", () => {
	it("returns a Collection wrapping a plain object value", async () => {
		const a = makeActor({
			"mls:keyPackages": { type: "Collection", totalItems: 3 },
		})
		const result = await a.mlsKeyPackages()
		expect(result).toBeInstanceOf(Collection)
		expect(result.totalItems()).toBe(3)
	})

	it("fetches a Collection from a URL value", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({
			type: "Collection",
			totalItems: 5,
		})))

		const a = makeActor({
			"mls:keyPackages": "https://example.com/users/alice/keyPackages",
		})
		const result = await a.mlsKeyPackages()
		expect(result).toBeInstanceOf(Collection)
		expect(result.totalItems()).toBe(5)
	})

	it("returns an empty Collection when not present", async () => {
		const a = makeActor()
		const result = await a.mlsKeyPackages()
		expect(result).toBeInstanceOf(Collection)
		expect(result.type()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// emissaryMessages()
// — uses getWithNamespace, so ONLY matches "emissary:messages" prefixed key
// — bare "messages" key does NOT match
// ---------------------------------------------------------------------------

describe("Actor — emissaryMessages()", () => {
	it("returns value from prefixed key 'emissary:messages'", () => {
		const a = makeActor({ "emissary:messages": "https://example.com/users/alice/emissary-messages" })
		expect(a.emissaryMessages()).toBe("https://example.com/users/alice/emissary-messages")
	})

	it("does NOT return value from bare 'messages' key", () => {
		const a = makeActor({ messages: "https://example.com/users/alice/messages" })
		expect(a.emissaryMessages()).toBe("")
	})

	it("returns empty string when not present", () => {
		const a = makeActor()
		expect(a.emissaryMessages()).toBe("")
	})
})

// ---------------------------------------------------------------------------
// messages()
// ---------------------------------------------------------------------------

describe("Actor — messages()", () => {
	it("returns default result when no message endpoints are present", () => {
		const a = makeActor()
		expect(a.messages()).toEqual({ url: "", plaintext: false, ciphertext: false })
	})

	it("returns ciphertext=true when only mlsMessages is present", () => {
		const a = makeActor({ messages: "https://example.com/mls-messages" })
		expect(a.messages()).toEqual({
			url: "https://example.com/mls-messages",
			plaintext: false,
			ciphertext: true,
		})
	})

	it("returns plaintext=true and ciphertext=false when only emissaryMessages is present", () => {
		const a = makeActor({ "emissary:messages": "https://example.com/emissary-messages" })
		expect(a.messages()).toEqual({
			url: "https://example.com/emissary-messages",
			plaintext: true,
			ciphertext: false,
		})
	})

	it("returns both flags true when both endpoints are present", () => {
		const a = makeActor({
			messages: "https://example.com/mls-messages",
			"emissary:messages": "https://example.com/emissary-messages",
		})
		expect(a.messages()).toEqual({
			url: "https://example.com/emissary-messages",
			plaintext: true,
			ciphertext: true,
		})
	})

	it("emissary URL takes precedence over mls URL", () => {
		const a = makeActor({
			messages: "https://example.com/mls-messages",
			"emissary:messages": "https://example.com/emissary-messages",
		})
		expect(a.messages().url).toBe("https://example.com/emissary-messages")
	})
})

// ---------------------------------------------------------------------------
// computedUsername()
// ---------------------------------------------------------------------------

describe("Actor — computedUsername()", () => {
	it("returns @username@domain format", () => {
		const a = makeActor({
			preferredUsername: "alice",
			id: "https://example.com/users/alice",
		})
		expect(a.computedUsername()).toBe("@alice@example.com")
	})

	it("strips leading @ from preferredUsername", () => {
		const a = makeActor({
			preferredUsername: "@alice",
			id: "https://example.com/users/alice",
		})
		expect(a.computedUsername()).toBe("@alice@example.com")
	})

	it("strips domain from preferredUsername if present", () => {
		const a = makeActor({
			preferredUsername: "alice@other.com",
			id: "https://example.com/users/alice",
		})
		expect(a.computedUsername()).toBe("@alice@example.com")
	})

	it("strips both leading @ and domain from preferredUsername", () => {
		const a = makeActor({
			preferredUsername: "@alice@other.com",
			id: "https://example.com/users/alice",
		})
		expect(a.computedUsername()).toBe("@alice@example.com")
	})

	it("uses hostname from id URL for domain", () => {
		const a = makeActor({
			preferredUsername: "bob",
			id: "https://social.example.org/users/bob",
		})
		expect(a.computedUsername()).toBe("@bob@social.example.org")
	})

	it("throws when id is not a valid URL", () => {
		const a = makeActor({
			preferredUsername: "alice",
			id: "not-a-url",
		})
		expect(() => a.computedUsername()).toThrow()
	})

	it("throws when id is absent", () => {
		const a = makeActor({ preferredUsername: "alice" })
		expect(() => a.computedUsername()).toThrow()
	})
})

// ---------------------------------------------------------------------------
// fromUrl() — inherited from ASObject
// ---------------------------------------------------------------------------

describe("Actor — fromUrl()", () => {
	it("fetches and populates actor from URL", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({
			type: "Person",
			id: "https://example.com/users/alice",
			preferredUsername: "alice",
		})))

		const a = await new Actor().fromUrl("https://example.com/users/alice")
		expect(a).toBeInstanceOf(Actor)
		expect(a.type()).toBe("Person")
		expect(a.preferredUsername()).toBe("alice")
	})

	it("throws when response is not ok", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockErrorResponse(404, "Not Found")))

		await expect(
			new Actor().fromUrl("https://example.com/users/missing")
		).rejects.toThrow(/404/)
	})
})

// ---------------------------------------------------------------------------
// Real-world JSON-LD fixtures
// ---------------------------------------------------------------------------

const emissaryActorJSON = {
	"@context": [
		"https://www.w3.org/ns/activitystreams",
		"https://w3id.org/security/v1",
		{
			"PropertyValue": "schema:PropertyValue",
			"discoverable": "toot:discoverable",
			"featured": { "@id": "http://joinmastodon.org/ns#featured", "@type": "@id" },
			"indexable": "toot:indexable",
			"schema": "https://schema.org/",
			"toot": "https://joinmastodon.org/ns#",
			"value": "schema:value",
		},
		"https://purl.archive.org/socialweb/mls",
	],
	"id": "https://emissary.example/@69669d34560853bbe5e1e7de",
	"type": "Person",
	"name": "Ben Pate",
	"preferredUsername": "benpate",
	"summary": "<p>This is not the greatest profile in the world.  This is just a tribute.</p>\n",
	"outbox": "https://emissary.example/@69669d34560853bbe5e1e7de/pub/outbox",
	"icon": {
		"mediaType": "image/webp",
		"type": "Image",
		"url": "https://emissary.example/@69669d34560853bbe5e1e7de/attachments/69f04be9fa56386be88a3548",
	},
	"endpoints": {
		"proxyUrl": "https://emissary.example/.proxy",
	},
	"keyPackages": "https://emissary.example/@69669d34560853bbe5e1e7de/pub/keyPackages",
	"messages": "https://emissary.example/@69669d34560853bbe5e1e7de/pub/inbox/direct-messages/mls",
	"emissary:messages": "https://emissary.example/@69669d34560853bbe5e1e7de/pub/inbox/direct-messages",
}

const emissaryKeyPackagesJSON = {
	"@context": "https://www.w3.org/ns/activitystreams",
	"id": "https://emissary.example/@69669d34560853bbe5e1e7de/pub/keyPackages",
	"type": "Collection",
	"totalItems": 1,
	"items": [
		"https://emissary.example/@69669d34560853bbe5e1e7de/pub/keyPackages/6a1e5addcc68d97897c7d88f",
	],
}

// ---------------------------------------------------------------------------
// Real-world JSON-LD — scalar properties
// ---------------------------------------------------------------------------

describe("Actor — real-world JSON-LD scalar properties", () => {
	let a: Actor

	beforeEach(() => {
		a = new Actor(emissaryActorJSON)
	})

	it("parses id", () => {
		expect(a.id()).toBe("https://emissary.example/@69669d34560853bbe5e1e7de")
	})

	it("parses type", () => {
		expect(a.type()).toBe("Person")
	})

	it("parses name", () => {
		expect(a.name()).toBe("Ben Pate")
	})

	it("parses preferredUsername", () => {
		expect(a.preferredUsername()).toBe("benpate")
	})

	it("parses summary", () => {
		expect(a.summary()).toBe("<p>This is not the greatest profile in the world.  This is just a tribute.</p>\n")
	})

	it("parses outbox", () => {
		expect(a.outbox()).toBe("https://emissary.example/@69669d34560853bbe5e1e7de/pub/outbox")
	})

	it("resolves icon URL from Image object", () => {
		// icon is an Image object; toString extracts its .url field
		expect(a.icon()).toBe("https://emissary.example/@69669d34560853bbe5e1e7de/attachments/69f04be9fa56386be88a3548")
	})

	it("parses proxyUrl from endpoints map", () => {
		expect(a.proxyUrl()).toBe("https://emissary.example/.proxy")
	})

	it("parses mlsMessages from bare 'messages' key", () => {
		expect(a.mlsMessages()).toBe("https://emissary.example/@69669d34560853bbe5e1e7de/pub/inbox/direct-messages/mls")
	})

	it("parses emissaryMessages from 'emissary:messages' key", () => {
		expect(a.emissaryMessages()).toBe("https://emissary.example/@69669d34560853bbe5e1e7de/pub/inbox/direct-messages")
	})

	it("messages() returns both flags true with emissary URL taking precedence", () => {
		expect(a.messages()).toEqual({
			url: "https://emissary.example/@69669d34560853bbe5e1e7de/pub/inbox/direct-messages",
			plaintext: true,
			ciphertext: true,
		})
	})

	it("computedUsername() formats @user@domain from real actor data", () => {
		expect(a.computedUsername()).toBe("@benpate@emissary.example")
	})
})

// ---------------------------------------------------------------------------
// Real-world JSON-LD — mlsKeyPackages() URL fetch
// ---------------------------------------------------------------------------

describe("Actor — emissary JSON-LD mlsKeyPackages()", () => {
	it("resolves keyPackages URL and returns a Collection", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(emissaryKeyPackagesJSON)))

		const a = new Actor(emissaryActorJSON)
		const collection = await a.mlsKeyPackages()

		expect(collection).toBeInstanceOf(Collection)
		expect(collection.type()).toBe("Collection")
		expect(collection.totalItems()).toBe(1)
	})

	it("collection items() contains the key package URL", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(emissaryKeyPackagesJSON)))

		const a = new Actor(emissaryActorJSON)
		const collection = await a.mlsKeyPackages()
		const items = collection.items()

		expect(items).toHaveLength(1)
		expect(items[0]).toBe("https://emissary.example/@69669d34560853bbe5e1e7de/pub/keyPackages/6a1e5addcc68d97897c7d88f")
	})

	it("fetch is called with the keyPackages URL", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse(emissaryKeyPackagesJSON))
		vi.stubGlobal("fetch", fetchMock)

		const a = new Actor(emissaryActorJSON)
		await a.mlsKeyPackages()

		expect(fetchMock).toHaveBeenCalledWith(
			"https://emissary.example/@69669d34560853bbe5e1e7de/pub/keyPackages",
			expect.anything(),
		)
	})
})

// ---------------------------------------------------------------------------
// Real-world JSON-LD — inline keyPackages (Bonfire-style actor)
// ---------------------------------------------------------------------------

const bonfireActorJSON = {
	"@context": [
		"https://www.w3.org/ns/activitystreams",
		"https://w3id.org/security/v1",
		{
			"@language": "en",
			"alsoKnownAs": { "@id": "as:alsoKnownAs", "@type": "@id" },
			"implements": { "@container": "@set", "@id": "https://w3id.org/fep/844e#implements", "@type": "@id" },
			"manuallyApprovesFollowers": "as:manuallyApprovesFollowers",
			"movedTo": "as:movedTo",
			"sensitive": "as:sensitive",
		},
	],
	"id": "https://bonfire.example/pub/actors/Alice",
	"type": "Person",
	"name": "Alice",
	"preferredUsername": "Alice",
	"outbox": "https://bonfire.example/pub/actors/Alice/outbox",
	"icon": {
		"type": "Image",
		"url": "https://bonfire.example/files/redir/local/data/uploads/01KJA8E2VK2MV2PXN8C6K2VTH1/icons/01KJGMQK0VFVTGHT7E5SKBDN0P.webp",
	},
	"endpoints": {
		"proxyUrl": "https://bonfire.example/pub/proxy_remote_object",
	},
	"keyPackages": {
		"type": "Collection",
		"totalItems": 3,
		"items": [
			"https://bonfire.example/pub/objects/01KS5F73VXYJ9BKXWCTZ4JND94",
			"https://bonfire.example/pub/objects/01KS5F7ERBBPNFBXDVANZ400PV",
			"https://bonfire.example/pub/objects/01KS5F8BBGA2WYAERACWX1BP35",
		],
	},
}

describe("Actor — inline keyPackages (Bonfire-style) scalar properties", () => {
	let a: Actor

	beforeEach(() => {
		a = new Actor(bonfireActorJSON)
	})

	it("parses id", () => {
		expect(a.id()).toBe("https://bonfire.example/pub/actors/Alice")
	})

	it("parses type", () => {
		expect(a.type()).toBe("Person")
	})

	it("parses name", () => {
		expect(a.name()).toBe("Alice")
	})

	it("parses preferredUsername", () => {
		expect(a.preferredUsername()).toBe("Alice")
	})

	it("parses outbox", () => {
		expect(a.outbox()).toBe("https://bonfire.example/pub/actors/Alice/outbox")
	})

	it("resolves icon URL from Image object", () => {
		expect(a.icon()).toBe(
			"https://bonfire.example/files/redir/local/data/uploads/01KJA8E2VK2MV2PXN8C6K2VTH1/icons/01KJGMQK0VFVTGHT7E5SKBDN0P.webp",
		)
	})

	it("parses proxyUrl from endpoints map", () => {
		expect(a.proxyUrl()).toBe("https://bonfire.example/pub/proxy_remote_object")
	})

	it("computedUsername() formats @user@domain", () => {
		expect(a.computedUsername()).toBe("@Alice@bonfire.example")
	})

	it("messages() returns empty result when no message endpoints are present", () => {
		expect(a.messages()).toEqual({ url: "", plaintext: false, ciphertext: false })
	})
})

describe("Actor — inline keyPackages (Bonfire-style) mlsKeyPackages()", () => {
	it("returns a Collection without making a fetch call", async () => {
		const fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)

		const a = new Actor(bonfireActorJSON)
		const collection = await a.mlsKeyPackages()

		expect(collection).toBeInstanceOf(Collection)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("collection has correct type and totalItems", async () => {
		const a = new Actor(bonfireActorJSON)
		const collection = await a.mlsKeyPackages()

		expect(collection.type()).toBe("Collection")
		expect(collection.totalItems()).toBe(3)
	})

	it("collection items() contains all three key package URLs", async () => {
		const a = new Actor(bonfireActorJSON)
		const collection = await a.mlsKeyPackages()
		const items = collection.items()

		expect(items).toHaveLength(3)
		expect(items[0]).toBe("https://bonfire.example/pub/objects/01KS5F73VXYJ9BKXWCTZ4JND94")
		expect(items[1]).toBe("https://bonfire.example/pub/objects/01KS5F7ERBBPNFBXDVANZ400PV")
		expect(items[2]).toBe("https://bonfire.example/pub/objects/01KS5F8BBGA2WYAERACWX1BP35")
	})
})

// ---------------------------------------------------------------------------
// rangeDocuments() — Emissary actor (keyPackages behind a URL)
// ---------------------------------------------------------------------------

// Fetch is called twice for the Emissary case:
//   1. mlsKeyPackages() fetches the collection URL
//   2. rangeDocuments() fetches each item URL
function emissaryFetchMock(url: string): Promise<Response> {
	if (url === "https://emissary.example/@69669d34560853bbe5e1e7de/pub/keyPackages") {
		return Promise.resolve(mockResponse(emissaryKeyPackagesJSON))
	}
	return Promise.resolve(mockResponse({
		"@context": "https://www.w3.org/ns/activitystreams",
		"id": url,
		"type": "KeyPackage",
	}))
}

describe("Actor — emissary rangeDocuments()", () => {
	it("yields one Document per key package", async () => {
		vi.stubGlobal("fetch", vi.fn().mockImplementation(emissaryFetchMock))

		const a = new Actor(emissaryActorJSON)
		const collection = await a.mlsKeyPackages()

		const docs: Document[] = []
		for await (const doc of collection.rangeDocuments()) {
			docs.push(doc)
		}

		expect(docs).toHaveLength(1)
		expect(docs[0]).toBeInstanceOf(Document)
	})

	it("each Document has the expected id and type", async () => {
		vi.stubGlobal("fetch", vi.fn().mockImplementation(emissaryFetchMock))

		const a = new Actor(emissaryActorJSON)
		const collection = await a.mlsKeyPackages()

		const docs: Document[] = []
		for await (const doc of collection.rangeDocuments()) {
			docs.push(doc)
		}

		expect(docs.map(d => d.id())).toEqual(["https://emissary.example/@69669d34560853bbe5e1e7de/pub/keyPackages/6a1e5addcc68d97897c7d88f"])
		expect(docs.map(d => d.type())).toEqual(["KeyPackage"])
	})
})

// ---------------------------------------------------------------------------
// rangeDocuments() — Bonfire actor (keyPackages inline)
// ---------------------------------------------------------------------------

// Fetch is only called for item URLs — the collection itself is inline.
function bonFireFetchMock(url: string): Promise<Response> {
	return Promise.resolve(mockResponse({
		"@context": "https://www.w3.org/ns/activitystreams",
		"id": url,
		"type": "KeyPackage",
	}))
}

describe("Actor — Bonfire rangeDocuments()", () => {
	it("yields one Document per key package", async () => {
		vi.stubGlobal("fetch", vi.fn().mockImplementation(bonFireFetchMock))

		const a = new Actor(bonfireActorJSON)
		const collection = await a.mlsKeyPackages()

		const docs: Document[] = []
		for await (const doc of collection.rangeDocuments()) {
			docs.push(doc)
		}

		expect(docs).toHaveLength(3)
		expect(docs[0]).toBeInstanceOf(Document)
	})

	it("each Document has the expected id and type", async () => {
		vi.stubGlobal("fetch", vi.fn().mockImplementation(bonFireFetchMock))

		const a = new Actor(bonfireActorJSON)
		const collection = await a.mlsKeyPackages()

		const docs: Document[] = []
		for await (const doc of collection.rangeDocuments()) {
			docs.push(doc)
		}

		expect(docs.map(d => d.id())).toEqual([
			"https://bonfire.example/pub/objects/01KS5F73VXYJ9BKXWCTZ4JND94",
			"https://bonfire.example/pub/objects/01KS5F7ERBBPNFBXDVANZ400PV",
			"https://bonfire.example/pub/objects/01KS5F8BBGA2WYAERACWX1BP35",
		])
		expect(docs.map(d => d.type())).toEqual(["KeyPackage", "KeyPackage", "KeyPackage"])
	})

	it("does not fetch the collection itself", async () => {
		const fetchMock = vi.fn().mockImplementation(bonFireFetchMock)
		vi.stubGlobal("fetch", fetchMock)

		const a = new Actor(bonfireActorJSON)
		const collection = await a.mlsKeyPackages()

		for await (const _ of collection.rangeDocuments()) { /* consume */ }

		// Only the 3 item URLs should be fetched — not the collection URL
		expect(fetchMock).toHaveBeenCalledTimes(3)
	})
})

// ---------------------------------------------------------------------------
// Proxy URL — all fetches go through the proxyUrl when present
// ---------------------------------------------------------------------------

const testProxyUrl = "https://example.com/.proxy"
const testKeyPackagesUrl = "https://example.com/users/alice/keyPackages"
const testKeyPackageItemUrl = "https://example.com/users/alice/keyPackages/abc123"

// Routes fetch calls through the proxy mock: inspects the POSTed `id` param
// and returns the matching canned response.
function makeProxyFetchMock(responses: Record<string, object>) {
	return vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
		if (url === testProxyUrl) {
			const body = options?.body as URLSearchParams
			const targetUrl = body?.get("id") ?? ""
			const data = responses[targetUrl]
			if (data !== undefined) return mockResponse(data)
			return mockErrorResponse(404, "Not Found")
		}
		throw new Error(`Unexpected direct fetch (proxy should have been used) to: ${url}`)
	})
}

describe("Actor — mlsKeyPackages() uses proxyUrl when present", () => {
	it("fetches the keyPackages collection via POST to the proxy URL", async () => {
		const fetchMock = makeProxyFetchMock({
			[testKeyPackagesUrl]: { type: "Collection", totalItems: 1, items: [testKeyPackageItemUrl] },
		})
		vi.stubGlobal("fetch", fetchMock)

		const a = makeActor({ "mls:keyPackages": testKeyPackagesUrl }).withProxy(testProxyUrl)

		const collection = await a.mlsKeyPackages()

		expect(collection).toBeInstanceOf(Collection)
		expect(collection.totalItems()).toBe(1)
		expect(fetchMock).toHaveBeenCalledWith(testProxyUrl, expect.objectContaining({ method: "POST" }))
	})

	it("does not fetch the keyPackages URL directly when a proxyUrl is set", async () => {
		const fetchMock = makeProxyFetchMock({
			[testKeyPackagesUrl]: { type: "Collection", totalItems: 0, items: [] },
		})
		vi.stubGlobal("fetch", fetchMock)

		const a = makeActor({ "mls:keyPackages": testKeyPackagesUrl }).withProxy(testProxyUrl)

		await a.mlsKeyPackages()

		for (const [url] of fetchMock.mock.calls) {
			expect(url).toBe(testProxyUrl)
		}
	})

	it("rangeDocuments() also fetches each item URL via the proxy", async () => {
		const fetchMock = makeProxyFetchMock({
			[testKeyPackagesUrl]: { type: "Collection", totalItems: 1, items: [testKeyPackageItemUrl] },
			[testKeyPackageItemUrl]: { type: "KeyPackage", id: testKeyPackageItemUrl },
		})
		vi.stubGlobal("fetch", fetchMock)

		const a = makeActor({ "mls:keyPackages": testKeyPackagesUrl }).withProxy(testProxyUrl)

		const collection = await a.mlsKeyPackages()
		const docs: Document[] = []
		for await (const doc of collection.rangeDocuments()) {
			docs.push(doc)
		}

		expect(docs).toHaveLength(1)
		expect(docs[0]).toBeInstanceOf(Document)
		expect(docs[0]!.type()).toBe("KeyPackage")

		for (const [url] of fetchMock.mock.calls) {
			expect(url).toBe(testProxyUrl)
		}
	})

	it("fetches the keyPackages URL directly when no proxyUrl is set", async () => {
		const fetchMock = vi.fn().mockResolvedValue(mockResponse({
			type: "Collection",
			totalItems: 1,
			items: [testKeyPackageItemUrl],
		}))
		vi.stubGlobal("fetch", fetchMock)

		const a = makeActor({ "mls:keyPackages": testKeyPackagesUrl })

		await a.mlsKeyPackages()

		expect(fetchMock).toHaveBeenCalledWith(testKeyPackagesUrl, expect.anything())
	})
})