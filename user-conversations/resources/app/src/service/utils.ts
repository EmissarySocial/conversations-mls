
import DOMPurify from "dompurify"

// htmlToText converts an HTML string into plain text using the browser's own
// HTML parser. Used to derive a text-only summary (e.g. group.lastMessage) from
// message content that arrives as HTML.
export function htmlToText(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html")
	return (doc.body.textContent || "").trim()
}

// Mastodon-compatible allowlist for sanitizing message HTML.
const SANITIZE_ALLOWED_TAGS = ["p", "span", "br", "a", "del", "pre", "code", "em", "strong", "b", "i", "u", "ul", "ol", "li", "blockquote"]
const SANITIZE_ALLOWED_ATTR = ["href", "rel", "class"]

// Semantic CSS classes Mastodon uses in status content (mentions, hashtags, and
// the markup that shows/hides portions of links and handles).
const SANITIZE_ALLOWED_CLASSES = new Set(["mention", "hashtag", "invisible", "ellipsis"])

// Microformat class prefixes Mastodon preserves (h-card, u-url, p-name, etc.)
const SANITIZE_CLASS_PREFIXES = ["h-", "p-", "u-", "dt-", "e-"]

// classIsAllowed reports whether a single CSS class name is allowed to survive
// sanitization (a Mastodon semantic class or a microformats-prefixed class).
function classIsAllowed(name: string): boolean {
	return SANITIZE_ALLOWED_CLASSES.has(name) || SANITIZE_CLASS_PREFIXES.some(prefix => name.startsWith(prefix))
}

let sanitizeHooksInstalled = false

// installSanitizeHooks registers DOMPurify hooks (once) that (a) filter class
// attributes down to the Mastodon allowlist and (b) force safe link attributes.
function installSanitizeHooks() {

	if (sanitizeHooksInstalled) {
		return
	}
	sanitizeHooksInstalled = true

	// Filter class names down to the Mastodon allowlist; drop the attribute entirely
	// if nothing survives. (DOMPurify allows the "class" attribute but does not
	// inspect its values, so we do that here.)
	DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
		if (data.attrName !== "class") {
			return
		}

		const kept = data.attrValue.split(/\s+/).filter(name => name != "" && classIsAllowed(name))

		if (kept.length === 0) {
			data.keepAttr = false
			return
		}

		data.attrValue = kept.join(" ")
	})

	// Force safe link attributes on every anchor that survives sanitization.
	DOMPurify.addHook("afterSanitizeAttributes", (node) => {
		if (node.tagName === "A") {
			node.setAttribute("rel", "noopener noreferrer nofollow")
			node.setAttribute("target", "_blank")
		}
	})
}

// sanitizeHTML removes any unsafe markup from an HTML string, keeping only the
// Mastodon-compatible tags, attributes, and classes. Used at every boundary where
// untrusted HTML (e.g. an inbound ActivityPub "content" field) enters the app.
export function sanitizeHTML(html: string): string {
	installSanitizeHooks()
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: SANITIZE_ALLOWED_TAGS,
		ALLOWED_ATTR: SANITIZE_ALLOWED_ATTR,
	})
}

// formatMessageContent converts plain text typed by the local user into the
// sanitized HTML we store and render. It escapes the text, turns newlines into
// <br> tags, and runs the result through sanitizeHTML. Additional replacements
// (mentions, links, emoji, etc.) will be added here later.
export function formatMessageContent(text: string): string {

	// Escape HTML special characters so typed markup becomes literal text
	const escaped = text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")

	// Convert newlines to <br> tags
	const withBreaks = escaped.replaceAll("\n", "<br>")

	return sanitizeHTML(withBreaks)
}

// rangeToArray consumes all values from a generator and returns them as an array
export function rangeToArray<T>(generator: Generator<T>): T[] {
	let result = []
	for (let value of generator) {
		result.push(value)
	}
	return result
}

// rangeFirst returns the first value from a generator
// or throws an error if the generator is empty
export function rangeFirst<T>(generator: Generator<T>): T {
	for (const value of generator) { // NOSONAR: typescript:S1751 - Yes, I want to just get the first value from the generator
		return value
	}
	throw new Error("Generator is empty.")
}

// Helper to strip trailing null nodes per RFC 9420
export function stripTrailingNulls(tree: any[]): any[] {
	let lastNonNull = tree.length - 1
	while (lastNonNull >= 0 && tree[lastNonNull] === null) {
		lastNonNull--
	}
	return tree.slice(0, lastNonNull + 1)
}

// base64ToUint8Array converts a base64-encoded string to a Uint8Array.
// Normalizes URL-safe base64 (- and _) to standard base64 (+ and /),
// strips whitespace, and adds padding if missing — all common in interop scenarios.
export function base64ToUint8Array(base64: string): Uint8Array {

	// Normalize URL-safe base64 to standard base64 and remove whitespace
	const normalized = base64
		.replaceAll('-', '+')
		.replaceAll('_', '/')
		.replaceAll(/\s+/g, '')

	// Add base64 padding (if missing)
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')

	// Convert base64 string to binary string
	const binaryString = globalThis.atob(padded)

	// Convert binary string to Uint8Array
	return Uint8Array.from(binaryString, c => c.codePointAt(0)!)
}

// uint8ArrayToBase64 converts a Uint8Array to a standard base64-encoded string.
export function uint8ArrayToBase64(bytes: Uint8Array): string {
	const binaryString = Array.from(bytes, b => String.fromCodePoint(b)).join('')
	return globalThis.btoa(binaryString)
}

// newId generates a new unique identifier in the form of a URI with a UUID
export function newId(): string {
	return "uri:uuid:" + crypto.randomUUID()
}

// uint8ArrayEqual returns TRUE if two Uint8Arrays contain the same values.
export function uint8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {

	if (a.length != b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i] != b[i]) {
			return false
		}
	}

	return true
}

// uint8ArraysContain returns TRUE if the target Uint8Array is found within the array of Uint8Arrays.
export function uint8ArraysContain(arrays: Uint8Array[], target: Uint8Array): boolean {

	for (const array of arrays) {
		if (uint8ArrayEqual(array, target)) {
			return true
		}
	}

	return false
}

// diffArrays compares two arrays and returns the added and removed items
export function diffArrays<T>(before: T[], after: T[]) {
	const beforeSet = new Set(before);
	const afterSet = new Set(after);

	return {
		added: after.filter(item => !beforeSet.has(item)),
		removed: before.filter(item => !afterSet.has(item)),
	};
}