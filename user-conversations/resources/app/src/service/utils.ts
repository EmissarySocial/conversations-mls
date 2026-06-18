
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

// Maximum number of (post-scheme) characters shown for a hyperlink before it is
// truncated with an ellipsis, matching Mastodon's display behavior.
const LINK_DISPLAY_MAX = 30

// Matches http(s) URLs. Trailing punctuation is excluded so it isn't swallowed.
const URL_PATTERN = /https?:\/\/[^\s<]+[^\s<.,!?;:)'"]/g

// Matches a fully-qualified fediverse handle: @user@domain (domain has a dot).
const MENTION_PATTERN = /(^|[^\w@/])@([a-zA-Z0-9_.-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g

// linkifyURL renders one already-HTML-escaped URL as a Mastodon-style anchor: the
// scheme is hidden, the visible portion is capped, and any overflow is hidden in a
// trailing ellipsis span. The full URL is preserved in the href.
function linkifyURL(escapedUrl: string): string {

	// Strip the scheme for display (it lives in a hidden span)
	const schemeMatch = /^(https?:\/\/)(.*)$/.exec(escapedUrl)
	if (schemeMatch == null) {
		return `<a href="${escapedUrl}">${escapedUrl}</a>`
	}

	const scheme = schemeMatch[1]!
	const rest = schemeMatch[2]!

	const visible = rest.slice(0, LINK_DISPLAY_MAX)
	const overflow = rest.slice(LINK_DISPLAY_MAX)

	const hiddenScheme = `<span class="invisible">${scheme}</span>`
	const tail = (overflow == "") ? "" : `<span class="invisible">${overflow}</span>`

	return `<a href="${escapedUrl}">${hiddenScheme}${visible}${tail}</a>`
}

// MentionResolver resolves a "@user@domain" handle to the actor's profile URL.
// Returning "" means "not resolved" (the formatter falls back to a derived URL).
export type MentionResolver = (handle: string) => Promise<string>

// linkifyMentions converts fediverse @user@domain handles into Mastodon-style
// mention links: the @domain portion is hidden from view (kept in the href), so
// only "@user" is displayed. When a resolver is supplied, the href is the actor's
// real profile URL (via WebFinger); otherwise it falls back to https://domain/@user.
async function linkifyMentions(text: string, resolveMention?: MentionResolver): Promise<string> {

	// Collect every match first so we can resolve hrefs asynchronously, then rebuild.
	const matches = [...text.matchAll(MENTION_PATTERN)]
	if (matches.length == 0) {
		return text
	}

	// Resolve each handle's href (in parallel). An empty href means "do not
	// linkify" — when a resolver is supplied but the WebFinger lookup fails, the
	// mention is left as plain text. With no resolver, fall back to the derived URL.
	const hrefs = await Promise.all(matches.map(async (match) => {
		const user = match[2]!
		const domain = match[3]!

		if (resolveMention == undefined) {
			return `https://${domain}/@${user}`
		}

		// Empty result -> leave the mention unlinked
		return await resolveMention(`@${user}@${domain}`)
	}))

	// Rebuild the string, replacing each match with its anchor (or, when the href
	// could not be resolved, leaving the original mention text in place).
	let result = ""
	let lastIndex = 0
	matches.forEach((match, index) => {
		const prefix = match[1]!
		const user = match[2]!
		const href = hrefs[index]!
		const start = match.index!

		result += text.slice(lastIndex, start)

		if (href == "") {
			// Lookup failed: keep the mention as plain text
			result += match[0]
		} else {
			result += `${prefix}<a href="${href}" class="u-url mention">@<span>${user}</span></a>`
		}

		lastIndex = start + match[0].length
	})
	result += text.slice(lastIndex)

	return result
}

// linkify applies URL and mention linking to already-HTML-escaped text. URLs are
// linked first; mentions are then linked only in the text segments that fall
// outside the generated anchors (so an "@" inside a URL is not re-processed).
async function linkify(escaped: string, resolveMention?: MentionResolver): Promise<string> {

	// Replace URLs with anchor tags
	const withUrls = escaped.replaceAll(URL_PATTERN, (url) => linkifyURL(url))

	// Split on the anchor tags we just created and only linkify mentions in the
	// segments between them (the odd-indexed pieces are the <a>...</a> tags).
	const pieces = withUrls.split(/(<a\b[^>]*>.*?<\/a>)/g)
	const linkedPieces = await Promise.all(
		pieces.map((piece, index) => (index % 2 === 0) ? linkifyMentions(piece, resolveMention) : Promise.resolve(piece))
	)
	return linkedPieces.join("")
}

// formatMessageContent converts plain text typed by the local user into the
// sanitized HTML we store and render. It escapes the text, links @mentions and
// http(s) URLs, turns newlines into <br> tags, and runs the result through
// sanitizeHTML. When a mention resolver is supplied, @user@host handles link to
// the actor's real profile URL (resolved via WebFinger).
export async function formatMessageContent(text: string, resolveMention?: MentionResolver): Promise<string> {

	// Escape HTML special characters so typed markup becomes literal text
	const escaped = text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")

	// Turn @mentions and URLs into links
	const linked = await linkify(escaped, resolveMention)

	// Convert newlines to <br> tags
	const withBreaks = linked.replaceAll("\n", "<br>")

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