import { test, expect, describe } from 'vitest'
import { activeMentionToken, replaceMentionToken } from "./mentionToken"

describe("activeMentionToken", () => {

	test("detects a mention the caret is typing", () => {
		const text = "hello @al"
		const token = activeMentionToken(text, text.length)
		expect(token).toEqual({ start: 6, end: 9, query: "al" })
	})

	test("detects a mention at the very start of the text", () => {
		const token = activeMentionToken("@bob", 4)
		expect(token).toEqual({ start: 0, end: 4, query: "bob" })
	})

	test("detects an empty query right after the @", () => {
		const text = "hey @"
		const token = activeMentionToken(text, text.length)
		expect(token).toEqual({ start: 4, end: 5, query: "" })
	})

	test("returns null when the caret is not after an @", () => {
		expect(activeMentionToken("hello world", 11)).toBeNull()
	})

	test("does not treat an email address as a mention", () => {
		// "@example" is preceded by "bob" (a word char), so it does not start a token
		const text = "bob@example"
		expect(activeMentionToken(text, text.length)).toBeNull()
	})

	test("keeps the full handle as the query once fully qualified (@user@host)", () => {
		// The domain must reach the server so it can resolve remote handles, so the
		// second "@" and the domain stay in the query rather than ending the token.
		const text = "hi @alice@example.social"
		const token = activeMentionToken(text, text.length)
		expect(token).toEqual({ start: 3, end: text.length, query: "alice@example.social" })
	})

	test("still rejects an email address (the @ does not start a word)", () => {
		// Guards against the fix above accidentally re-matching emails.
		expect(activeMentionToken("write bob@example.com now", "write bob@example.com".length)).toBeNull()
	})

	test("spans the whole word even when the caret is mid-token", () => {
		// Caret sits after "@al", but the token covers the full word "@alice" (up to
		// the space), so the query is the entire handle — not just the part typed so
		// far. This is what lets mid-mention editing search/replace the whole handle.
		const text = "@alice and @bob"
		const token = activeMentionToken(text, 3)
		expect(token).toEqual({ start: 0, end: 6, query: "alice" })
	})

	test("yields the full handle when editing in the middle of it", () => {
		// User typed "@alice@hots.social" then arrowed back to fix "hots" -> caret
		// sits inside the domain. The query is still the whole handle.
		const text = "@alice@hots.social"
		const caret = "@alice@ho".length
		const token = activeMentionToken(text, caret)
		expect(token).toEqual({ start: 0, end: text.length, query: "alice@hots.social" })
	})

	test("detects the second mention when the caret is inside it", () => {
		const text = "@alice and @bo"
		const token = activeMentionToken(text, text.length)
		expect(token).toEqual({ start: 11, end: 14, query: "bo" })
	})

	test("returns null for an out-of-range caret", () => {
		expect(activeMentionToken("hi", 99)).toBeNull()
		expect(activeMentionToken("hi", -1)).toBeNull()
	})

	test("allows dots and hyphens in the query", () => {
		const text = "@foo-bar.baz"
		const token = activeMentionToken(text, text.length)
		expect(token?.query).toBe("foo-bar.baz")
	})

	test("only whitespace ends a mention — other punctuation stays in the query", () => {
		const text = "@alice@host.social/users?x=1"
		const token = activeMentionToken(text, text.length)
		expect(token?.query).toBe("alice@host.social/users?x=1")
	})

	test("a space ends the mention", () => {
		const text = "@alice@host.social done"
		// caret at the end is past the space, so no mention is active
		expect(activeMentionToken(text, text.length)).toBeNull()
		// but the caret right after the handle (before the space) still matches
		const atHandle = activeMentionToken(text, "@alice@host.social".length)
		expect(atHandle?.query).toBe("alice@host.social")
	})
})

describe("replaceMentionToken", () => {

	test("splices the replacement in place of the token", () => {
		const text = "hello @al"
		const token = activeMentionToken(text, text.length)!
		const result = replaceMentionToken(text, token, "@alice@example.social ")
		expect(result.text).toBe("hello @alice@example.social ")
		expect(result.caret).toBe(result.text.length)
	})

	test("preserves text after the token and positions the caret after the replacement", () => {
		const text = "hi @bo there"
		// caret just after "@bo" (index 6)
		const token = activeMentionToken(text, 6)!
		const result = replaceMentionToken(text, token, "@bob@x.test ")
		expect(result.text).toBe("hi @bob@x.test  there")
		expect(result.caret).toBe("hi @bob@x.test ".length)
	})

	test("replaces the whole handle when selecting a result mid-token", () => {
		// Caret is inside a partially-typed handle; selecting a suggestion should
		// swap the entire handle, not just the part left of the caret.
		const text = "ping @ali more"
		const token = activeMentionToken(text, "ping @al".length)!
		const result = replaceMentionToken(text, token, "@alice@x.test ")
		expect(result.text).toBe("ping @alice@x.test  more")
		expect(result.caret).toBe("ping @alice@x.test ".length)
	})
})
