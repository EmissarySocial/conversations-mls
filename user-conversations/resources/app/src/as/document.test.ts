import { test, expect, describe } from 'vitest'

import { Temporal } from "@js-temporal/polyfill"
;(globalThis as any).Temporal ??= Temporal

import { Document } from "./document"

describe("Document scalar accessors", () => {

	test("reads simple string properties", () => {
		const doc = new Document({
			type: "Note",
			content: "<p>hi</p>",
			context: "https://x.test/group",
			name: "A Note",
			summary: "summary text",
			attachment: "https://x.test/file.png",
			generator: "https://x.test/app",
			icon: "https://x.test/icon.png",
		})

		expect(doc.content()).toBe("<p>hi</p>")
		expect(doc.context()).toBe("https://x.test/group")
		expect(doc.name()).toBe("A Note")
		expect(doc.summary()).toBe("summary text")
		expect(doc.attachment()).toBe("https://x.test/file.png")
		expect(doc.generator()).toBe("https://x.test/app")
		expect(doc.icon()).toBe("https://x.test/icon.png")
	})

	test("returns empty string for missing properties", () => {
		const doc = new Document({ type: "Note" })
		expect(doc.content()).toBe("")
		expect(doc.summary()).toBe("")
		expect(doc.attachment()).toBe("")
	})

	test("resolves the namespaced ActivityStreams key as a fallback", () => {
		const doc = new Document({ "https://www.w3.org/ns/activitystreams#content": "fallback" })
		expect(doc.content()).toBe("fallback")
	})

	test("attributedToId extracts the id from an embedded object", () => {
		const doc = new Document({ attributedTo: { id: "https://alice.test/users/alice", type: "Person" } })
		expect(doc.attributedToId()).toBe("https://alice.test/users/alice")
	})

	test("attributedToId reads a plain string value", () => {
		const doc = new Document({ attributedTo: "https://bob.test/users/bob" })
		expect(doc.attributedToId()).toBe("https://bob.test/users/bob")
	})

	test("inReplyToId reads the inReplyTo id", () => {
		const doc = new Document({ inReplyTo: "https://x.test/messages/1" })
		expect(doc.inReplyToId()).toBe("https://x.test/messages/1")
	})
})

describe("Document.attributedTo (loads an Actor)", () => {

	// Use an embedded actor object so loadActor wraps it (a bare string id would be
	// treated as a URL and trigger a network fetch).
	test("returns an Actor whose id matches the attributedTo", async () => {
		const doc = new Document({ attributedTo: { id: "https://alice.test/users/alice", type: "Person" } })
		const actor = await doc.attributedTo()
		expect(actor.id()).toBe("https://alice.test/users/alice")
	})
})

describe("Document.to (loads actors)", () => {

	test("returns one actor per recipient", async () => {
		const doc = new Document({
			to: [
				{ id: "https://a.test/u/a", type: "Person" },
				{ id: "https://b.test/u/b", type: "Person" },
			],
		})
		const actors = await doc.to()
		expect(actors.map(a => a.id())).toEqual(["https://a.test/u/a", "https://b.test/u/b"])
	})

	test("returns [] when there are no recipients", async () => {
		const doc = new Document({ type: "Note" })
		expect(await doc.to()).toEqual([])
	})
})

describe("Document.published", () => {

	test("parses a valid ISO timestamp", () => {
		const doc = new Document({ published: "2024-01-02T03:04:05Z" })
		const instant = doc.published()
		expect(instant.toString()).toContain("2024-01-02")
	})

	test("falls back to the epoch for an unparseable value", () => {
		const doc = new Document({ published: "not-a-date" })
		const instant = doc.published()
		expect(Temporal.Instant.compare(instant, Temporal.Instant.from("1970-01-01T00:00:00Z"))).toBe(0)
	})
})

describe("Document MLS accessors", () => {

	test("reads mediaType, encoding, and ciphersuite", () => {
		const doc = new Document({
			mediaType: "message/mls",
			encoding: "base64",
			ciphersuite: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
		})
		expect(doc.mediaType()).toBe("message/mls")
		expect(doc.encoding()).toBe("base64")
		expect(doc.ciphersuite()).toBe("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519")
	})
})

// mlsDoc builds an MLS-message document with valid defaults, overridable per test.
function mlsDoc(overrides: Record<string, any> = {}): Document {
	return new Document({
		mediaType: "message/mls",
		encoding: "base64",
		content: "AAAA",
		...overrides,
	})
}

describe("Document.isMLSMessage", () => {

	test("returns true for a well-formed MLS message", () => {
		expect(mlsDoc().isMLSMessage()).toBe(true)
	})

	test("returns false when the mediaType is wrong", () => {
		expect(mlsDoc({ mediaType: "text/plain" }).isMLSMessage()).toBe(false)
	})

	test("returns false when the encoding is wrong", () => {
		expect(mlsDoc({ encoding: "hex" }).isMLSMessage()).toBe(false)
	})

	test("returns false when the content is empty", () => {
		expect(mlsDoc({ content: "" }).isMLSMessage()).toBe(false)
	})
})

describe("Document type accessors (inherited)", () => {

	test("type returns the single type string", () => {
		expect(new Document({ type: "Note" }).type()).toBe("Note")
	})

	test("types returns an array even for a single type", () => {
		expect(new Document({ type: "Note" }).types()).toEqual(["Note"])
	})

	test("types returns all values for an array of types", () => {
		expect(new Document({ type: ["Note", "Public"] }).types()).toEqual(["Note", "Public"])
	})
})
