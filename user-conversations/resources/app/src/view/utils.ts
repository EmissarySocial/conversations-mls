import type { Actor } from "../as/actor"
import { Collection } from "../as/collection"
import { type APActor } from "../model/ap-actor"
import type { Contact } from "../model/contact"
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

// actorHasKeyPackages checks if an Actor has any MLS KeyPackages
export function actorHasKeyPackages(actor: Actor): boolean {
	const keyPackagesUrl = actor.mlsKeyPackages()
	return keyPackagesUrl != ""
}

// allActorsHaveKeyPackages checks if all Actors in a list have MLS KeyPackages
export function allActorsHaveKeyPackages(actors: Actor[]): boolean {
	for (const actor of actors) {
		if (!actorHasKeyPackages(actor)) {
			return false
		}
	}

	return true
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
	html = html.replace(/\n/g, "<br>");

	return html
}