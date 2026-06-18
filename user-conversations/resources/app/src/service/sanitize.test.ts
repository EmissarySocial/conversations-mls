// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { sanitizeHTML, formatMessageContent } from "./utils"

test('sanitizeHTML strips <script> tags', () => {
	const result = sanitizeHTML('Hello <script>alert(1)</script> world')
	expect(result).not.toContain("<script>")
	expect(result).not.toContain("alert(1)")
	expect(result).toContain("Hello")
	expect(result).toContain("world")
})

test('sanitizeHTML strips event-handler attributes', () => {
	const result = sanitizeHTML('<img src="x" onerror="alert(1)">')
	expect(result).not.toContain("onerror")
	expect(result).not.toContain("alert(1)")
})

test('sanitizeHTML strips javascript: links', () => {
	const result = sanitizeHTML('<a href="javascript:alert(1)">click</a>')
	expect(result).not.toContain("javascript:")
})

test('sanitizeHTML keeps allowed formatting tags', () => {
	const result = sanitizeHTML('<p>Hello <strong>bold</strong> and <em>italic</em></p>')
	expect(result).toBe('<p>Hello <strong>bold</strong> and <em>italic</em></p>')
})

test('sanitizeHTML keeps Mastodon semantic classes', () => {
	const result = sanitizeHTML('<a href="https://example.social/@bob" class="mention">@bob</a>')
	expect(result).toContain('class="mention"')
})

test('sanitizeHTML keeps the invisible class (used to hide URL portions)', () => {
	const result = sanitizeHTML('<span class="invisible">https://</span>example.com')
	expect(result).toContain('class="invisible"')
})

test('sanitizeHTML keeps microformat-prefixed classes', () => {
	const result = sanitizeHTML('<span class="h-card">card</span>')
	expect(result).toContain('class="h-card"')
})

test('sanitizeHTML strips disallowed classes', () => {
	const result = sanitizeHTML('<span class="evil-class mention">hi</span>')
	expect(result).not.toContain("evil-class")
	expect(result).toContain("mention")
})

test('sanitizeHTML forces safe rel/target on links', () => {
	const result = sanitizeHTML('<a href="https://example.com">link</a>')
	expect(result).toContain('rel="noopener noreferrer nofollow"')
	expect(result).toContain('target="_blank"')
})

test('formatMessageContent escapes typed markup as literal text', async () => {
	const result = await formatMessageContent('<script>alert(1)</script>')
	expect(result).not.toContain("<script>")
	expect(result).toContain("&lt;script&gt;")
})

test('formatMessageContent converts newlines to <br>', async () => {
	const result = await formatMessageContent("line one\nline two")
	expect(result).toContain("line one<br>line two")
})
