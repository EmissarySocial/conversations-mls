import type { Actor } from "../as/actor"

// Contact represents an ActivityPub actor that the user has interacted with.
export type Contact = {
	id: string // Activity Vocabulary property: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-id
	name: string // Activity Vocabulary property: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-name
	icon: string // Activity Vocabulary property: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-icon
	username: string // "Fediverse handle" computed from preferredUsername and domain of the ID URL
	known: boolean // If TRUE, this contact has been marked "known" by the user.
	updated: number // Unix epoch (in ms) when this contact was last retrieved
}

export function NewContact(id: string) {
	return {
		id: id,
		name: "",
		icon: "",
		username: "",
		known: false,
		updated: 0,
	}
}

export function ContactFromActor(actor: Actor): Contact {
	return {
		id: actor.id(),
		name: actor.name(),
		icon: actor.icon(),
		username: actor.computedUsername(),
		known: false,
		updated: Date.now(),
	}
}
