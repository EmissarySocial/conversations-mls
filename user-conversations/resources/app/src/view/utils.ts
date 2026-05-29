
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

export function isEmoji(char: string): boolean {
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

export function formatHTML(html: string): string {

	// strip all HTML tags
	html = html.replace(/<\/?[^>]+(>|$)/g, "");

	// convert newlines to <br> tags
	html = html.replaceAll('\n', "<br>");

	return html
}