import { expect, test } from 'vitest'
import { isSafeAttachmentURL } from './document'

// isSafeAttachmentURL gates inbound (attacker-controlled) attachment URLs before they
// are bound into <a href> / <img|video|audio src>, none of which pass through HTML
// sanitization. Only an allowlist of safe schemes may survive.

test('https URLs are allowed', () => {
	expect(isSafeAttachmentURL('https://example.com/cat.png')).toBe(true)
})

test('http URLs are allowed', () => {
	expect(isSafeAttachmentURL('http://example.com/cat.png')).toBe(true)
})

test('data URLs are allowed (any media type)', () => {
	expect(isSafeAttachmentURL('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
	expect(isSafeAttachmentURL('data:text/html,<h1>hi</h1>')).toBe(true)
})

test('blob URLs are allowed', () => {
	expect(isSafeAttachmentURL('blob:https://example.com/550e8400-e29b')).toBe(true)
})

test('javascript: URLs are rejected', () => {
	expect(isSafeAttachmentURL('javascript:alert(document.cookie)')).toBe(false)
})

test('vbscript: URLs are rejected', () => {
	expect(isSafeAttachmentURL('vbscript:msgbox(1)')).toBe(false)
})

test('case-insensitive scheme: JavaScript: is still rejected', () => {
	// The URL parser normalizes the scheme to lower-case, so mixed-case bypass attempts fail.
	expect(isSafeAttachmentURL('JavaScript:alert(1)')).toBe(false)
	expect(isSafeAttachmentURL('  javascript:alert(1)'.trim())).toBe(false)
})

test('empty string is rejected', () => {
	expect(isSafeAttachmentURL('')).toBe(false)
})

test('scheme-less text resolves as a relative path on our own origin (harmless, allowed)', () => {
	// With no scheme, "not a url at all" resolves to https://localhost/... — an http(s)
	// URL on our own origin. That cannot execute script in an href/src, so it is allowed.
	// The dangerous case is an *explicit* unsafe scheme, which is covered above.
	expect(isSafeAttachmentURL('not a url at all')).toBe(true)
})

test('a value that fails URL parsing entirely is rejected', () => {
	// Even with a base, some inputs cannot be parsed at all (e.g. a lone scheme separator).
	expect(isSafeAttachmentURL('http://')).toBe(false)
})

test('protocol-relative URL resolves against origin and is allowed', () => {
	// "//example.com/x" resolves to https://example.com/x under an https origin.
	expect(isSafeAttachmentURL('//example.com/cat.png')).toBe(true)
})
