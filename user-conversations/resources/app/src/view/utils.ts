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



// calcGroupName is a mithril.Stream combiner that returns an intelligent name for the group based on its 
// internal state and member list.
function groupName(group: Group, contacts: Contact[]): string {

	// If the group has a name, then just use that.
	const groupName = group.name
	if (groupName != "") {
		return groupName
	}

	const contactNames = contacts.map(contact => contact.name).filter(name => name != "")

	// Fancy default name based on the number of members (excluding "me")
	switch (contactNames.length) {

		// This should never happen, but just in case...
		case 0:
			return "Empty Group"

		// For small sets, display all names
		case 1:
		case 2:
		case 3:
		case 4:
			return contactNames.join(", ")
	}

	// For larger groups, display the first 3 names + the remaining count
	return contactNames
		.slice(0, 3)
		.join(", ") + `, +${contactNames.length - 3} others`
}