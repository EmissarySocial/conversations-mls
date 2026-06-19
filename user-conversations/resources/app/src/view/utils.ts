
// haltEvent prevents the default behavior of an event and stops its propagation
export function haltEvent(event: Event) {
	event.preventDefault()
	event.stopPropagation()
}

// synthClick is an event handler that turns "Enter" and "Space" keypresses into click events for accessibility
export function synthClick(evt: KeyboardEvent) {
	if (evt.key === "Enter" || evt.key === " ") {
		evt.preventDefault()
		evt.stopPropagation()
		evt.target?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
	}
}

export function keyCode(evt: KeyboardEvent): string {
	let result = ""

	if (globalThis.navigator.userAgent.includes("Macintosh")) {
		if (evt.metaKey) {
			result += "Ctrl+"
		}
	} else if (evt.ctrlKey) {
		result += "Ctrl+"
	}

	if (evt.shiftKey) {
		result += "Shift+"
	}

	result += evt.key
	return result
}

export function getFocusElements(node: Element): [HTMLInputElement | undefined, HTMLInputElement | undefined] {
	const focusElements = node.querySelectorAll("[tabIndex]") as NodeListOf<HTMLInputElement>

	if (focusElements.length == 0) {
		return [undefined, undefined]
	}

	const firstElement = focusElements[0]
	const lastElement = focusElements[focusElements.length - 1]

	return [firstElement, lastElement]
}

// graphemeSegmenter splits a string into user-perceived characters (grapheme
// clusters), so a single emoji counts as one even when it is built from several
// code points (e.g. ❤️ = heart + variation selector, or a ZWJ / skin-tone sequence).
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

// Maximum number of emoji a message can contain and still get the enlarged
// "jumbo emoji" display.
const MAX_JUMBO_EMOJI = 6

// isEmoji reports whether `text` is a short, emoji-only message (1 to
// MAX_JUMBO_EMOJI emoji, ignoring surrounding/interspersed whitespace) — the
// condition for rendering it as enlarged "jumbo" emoji.
//
// It counts user-perceived characters (grapheme clusters), not .length: most emoji
// span multiple UTF-16 code units or code points (e.g. "😀".length === 2, "❤️" is
// two code points, ZWJ sequences are many), all of which .length would miscount.
export function isEmoji(text: string): boolean {

	// Treat each grapheme as one unit, skipping whitespace, and require at least one
	// emoji and no non-emoji, non-whitespace graphemes.
	let emojiCount = 0

	for (const { segment } of graphemeSegmenter.segment(text)) {

		if (/^\s+$/.test(segment)) {
			continue
		}

		if (!/\p{Extended_Pictographic}/u.test(segment)) {
			return false
		}

		emojiCount++

		if (emojiCount > MAX_JUMBO_EMOJI) {
			return false
		}
	}

	return emojiCount > 0
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) {
		return "0 Bytes"
	}
	const units = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${Math.round(bytes / Math.pow(1024, i))} ${units[i]}`;
}

