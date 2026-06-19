
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

// graphemeCount returns the number of user-perceived characters in `str`.
function graphemeCount(str: string): number {
	let count = 0
	for (const _ of graphemeSegmenter.segment(str)) {
		count++
	}
	return count
}

export function isEmoji(char: string): boolean {

	// Only expand emoji messages if it is a single (user-perceived) character. Using
	// grapheme count, not .length: most emoji span multiple UTF-16 code units, so
	// .length would reject them (e.g. "😀".length === 2).
	if (graphemeCount(char) != 1) {
		return false
	}

	return /\p{Extended_Pictographic}/u.test(char);
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) {
		return "0 Bytes"
	}
	const units = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${Math.round(bytes / Math.pow(1024, i))} ${units[i]}`;
}

