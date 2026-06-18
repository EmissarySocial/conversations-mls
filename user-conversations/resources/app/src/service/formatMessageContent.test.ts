// @vitest-environment jsdom
import { test, expect, describe } from 'vitest'
import { formatMessageContent } from "./utils"

describe("formatMessageContent — plain text", () => {

	test("escapes HTML special characters", async () => {
		const result = await formatMessageContent("a < b & c > d")
		expect(result).toContain("&lt;")
		expect(result).toContain("&amp;")
		expect(result).toContain("&gt;")
	})

	test("converts newlines to <br>", async () => {
		expect(await formatMessageContent("one\ntwo")).toContain("one<br>two")
	})

	test("neutralizes typed markup", async () => {
		const result = await formatMessageContent("<script>alert(1)</script>")
		expect(result).not.toContain("<script>")
		expect(result).toContain("&lt;script&gt;")
	})
})

describe("formatMessageContent — URLs", () => {

	test("links a short http(s) URL", async () => {
		const result = await formatMessageContent("see https://x.test/page")
		expect(result).toContain('href="https://x.test/page"')
		// scheme is hidden in an .invisible span
		expect(result).toContain('<span class="invisible">https://</span>')
		expect(result).toContain("x.test/page")
	})

	test("truncates a long URL, hiding the overflow", async () => {
		const longUrl = "https://example.test/" + "a".repeat(60)
		const result = await formatMessageContent(longUrl)

		// The full URL is preserved in the href
		expect(result).toContain(`href="${longUrl}"`)
		// The overflow beyond the visible cap is wrapped in an invisible span
		const invisibleSpans = result.match(/<span class="invisible">/g) ?? []
		// One for the scheme, one for the overflow tail
		expect(invisibleSpans.length).toBe(2)
	})

	test("does not swallow trailing punctuation", async () => {
		const result = await formatMessageContent("go to https://x.test/page.")
		expect(result).toContain('href="https://x.test/page"')
		// the trailing period stays outside the link
		expect(result).toContain("</a>.")
	})

	test("leaves text with no URL unlinked", async () => {
		const result = await formatMessageContent("just some words")
		expect(result).not.toContain("<a ")
	})
})

describe("formatMessageContent — mentions", () => {

	test("links a fully-qualified @user@domain handle and hides the domain", async () => {
		const result = await formatMessageContent("hi @alice@example.social !")

		// href carries the full handle; display shows only the username
		expect(result).toContain('href="https://example.social/@alice"')
		expect(result).toContain('class="u-url mention"')
		expect(result).toContain("@<span>alice</span>")
		// the @domain portion must not appear as visible text
		expect(result).not.toContain("@example.social<")
	})

	test("does not link a bare @username with no domain", async () => {
		const result = await formatMessageContent("hey @bob how are you")
		expect(result).not.toContain("<a ")
		expect(result).toContain("@bob")
	})

	test("links a mention at the very start of the message", async () => {
		const result = await formatMessageContent("@carol@x.test hello")
		expect(result).toContain('href="https://x.test/@carol"')
	})

	test("does not treat an email-like address as a mention", async () => {
		// preceded by a word character, so the mention pattern should not match
		const result = await formatMessageContent("email me at bob@example.com please")
		expect(result).not.toContain("<a ")
	})
})

describe("formatMessageContent — URLs and mentions together", () => {

	test("links both a URL and a mention in the same message", async () => {
		const result = await formatMessageContent("@alice@example.social check https://x.test/p")
		expect(result).toContain('href="https://example.social/@alice"')
		expect(result).toContain('href="https://x.test/p"')
	})

	test("does not turn an @ inside a URL path into a mention", async () => {
		const result = await formatMessageContent("profile https://example.social/@alice")
		// Exactly one anchor (the URL), and no mention link was generated
		const anchors = result.match(/<a /g) ?? []
		expect(anchors.length).toBe(1)
		expect(result).not.toContain('class="u-url mention"')
	})
})

describe("formatMessageContent — mention resolver (WebFinger)", () => {

	test("uses the resolved profile URL for the mention href", async () => {
		const resolve = async (handle: string) =>
			(handle == "@alice@example.social") ? "https://example.social/users/alice-real" : ""

		const result = await formatMessageContent("hi @alice@example.social", resolve)

		expect(result).toContain('href="https://example.social/users/alice-real"')
		// the derived fallback URL must NOT be used
		expect(result).not.toContain('href="https://example.social/@alice"')
		// display still shows only the username
		expect(result).toContain("@<span>alice</span>")
	})

	test("leaves the mention as plain text when the resolver returns empty", async () => {
		const resolve = async () => ""
		const result = await formatMessageContent("hi @bob@x.test", resolve)
		// No link is generated, and the original handle is preserved verbatim
		expect(result).not.toContain("<a ")
		expect(result).toContain("@bob@x.test")
	})

	test("passes the full handle to the resolver", async () => {
		const seen: string[] = []
		const resolve = async (handle: string) => { seen.push(handle); return "" }

		await formatMessageContent("ping @carol@y.test", resolve)
		expect(seen).toEqual(["@carol@y.test"])
	})

	test("resolves multiple mentions independently", async () => {
		const resolve = async (handle: string) => `https://resolved.test/${handle.replaceAll("@", "_")}`
		const result = await formatMessageContent("@a@one.test and @b@two.test", resolve)

		expect(result).toContain('href="https://resolved.test/_a_one.test"')
		expect(result).toContain('href="https://resolved.test/_b_two.test"')
	})

	test("links the resolvable mention but leaves the failing one as text", async () => {
		// Only @a@one.test resolves; @b@two.test fails (returns "")
		const resolve = async (handle: string) =>
			(handle == "@a@one.test") ? "https://one.test/users/a" : ""

		const result = await formatMessageContent("@a@one.test and @b@two.test", resolve)

		expect(result).toContain('href="https://one.test/users/a"')
		expect(result).toContain("@b@two.test")
		expect(result).not.toContain("two.test/@b")
		// exactly one anchor was generated
		expect((result.match(/<a /g) ?? []).length).toBe(1)
	})
})
