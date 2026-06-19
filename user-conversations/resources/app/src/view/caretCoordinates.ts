// caretCoordinates.ts — measure the on-screen position of the caret inside a
// <textarea> or <input>. The browser exposes no direct API for this, so we use
// the well-known "mirror div" technique: render an off-screen <div> that copies
// the field's text and every layout-affecting style, place a marker span where
// the caret is, and read the marker's geometry.
//
// Framework-agnostic and reusable by any caret-anchored overlay (e.g. an
// @mention autocomplete popup).

// CaretCoordinates is the caret position, in viewport coordinates (like
// getBoundingClientRect), plus the line height at the caret so callers can
// offset a popup to sit just below the current line.
export interface CaretCoordinates {
	left: number
	top: number
	lineHeight: number
}

// Style properties that affect text layout and therefore wrapping/caret position.
// Copied verbatim from the field onto the mirror so the mirror wraps identically.
const MIRRORED_STYLES = [
	"boxSizing", "width", "borderLeftWidth", "borderRightWidth", "borderTopWidth", "borderBottomWidth",
	"paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
	"fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontSizeAdjust", "lineHeight", "fontFamily",
	"textAlign", "textTransform", "textIndent", "textDecoration",
	"letterSpacing", "wordSpacing", "tabSize", "whiteSpace", "wordWrap", "wordBreak", "overflowWrap",
] as const

// caretCoordinates returns the viewport position of the caret at `caretIndex`
// within `field`. The popup should be positioned at the returned point, typically
// offset downward by `lineHeight` so it appears just below the current line.
export function caretCoordinates(field: HTMLTextAreaElement | HTMLInputElement, caretIndex: number): CaretCoordinates {

	const doc = field.ownerDocument
	const computed = getComputedStyle(field)

	// Build the mirror div, copying layout-relevant styles from the field.
	const mirror = doc.createElement("div")
	for (const style of MIRRORED_STYLES) {
		mirror.style[style] = computed[style]
	}

	// Position the mirror off-screen, and let it grow to the text's height so the
	// marker's vertical position is meaningful.
	mirror.style.position = "absolute"
	mirror.style.visibility = "hidden"
	mirror.style.top = "0"
	mirror.style.left = "-9999px"
	mirror.style.height = "auto"
	mirror.style.overflow = "hidden"

	// A <textarea> wraps; a single-line <input> does not.
	const isTextarea = (field.tagName === "TEXTAREA")
	mirror.style.whiteSpace = isTextarea ? "pre-wrap" : "pre"
	if (isTextarea) {
		mirror.style.wordWrap = "break-word"
	}

	// Text up to the caret fills the mirror; a marker span stands in for the caret.
	mirror.textContent = field.value.slice(0, caretIndex)
	const marker = doc.createElement("span")
	// A zero-width-ish placeholder gives the span a measurable box at the caret.
	marker.textContent = field.value.slice(caretIndex) || "."
	mirror.appendChild(marker)

	doc.body.appendChild(mirror)

	// The marker's offset within the mirror, plus the field's viewport position
	// (minus any scroll within the field), yields the caret's viewport position.
	const fieldRect = field.getBoundingClientRect()
	const lineHeight = parseInt(computed.lineHeight, 10) || (parseInt(computed.fontSize, 10) * 1.2)

	const coordinates: CaretCoordinates = {
		left: fieldRect.left + marker.offsetLeft - field.scrollLeft,
		top: fieldRect.top + marker.offsetTop - field.scrollTop,
		lineHeight,
	}

	doc.body.removeChild(mirror)
	return coordinates
}
