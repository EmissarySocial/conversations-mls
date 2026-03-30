import { type APActor } from "../model/ap-actor"
import type { Group } from "../model/group"

// haltEvent prevents the default behavior of an event and stops its propagation
export function haltEvent(event: Event) {
	event.preventDefault()
	event.stopPropagation()
}

export function keyCode(evt: KeyboardEvent): string {
	var result = ""

	if (window.navigator.userAgent.indexOf("Macintosh") >= 0) {
		if (evt.metaKey) {
			result += "Ctrl+"
		}
	} else {
		if (evt.ctrlKey) {
			result += "Ctrl+"
		}
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


export function actorHasKeyPackages(actor: APActor): boolean {
	return (actor["mls:keyPackages"] != "")
}

export function allActorsHaveKeyPackages(actors: APActor[]): boolean {
	for (const actor of actors) {
		if (!actorHasKeyPackages(actor)) {
			return false
		}
	}

	return true
}
