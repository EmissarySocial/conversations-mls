import type { Actor } from "../ap/actor"

// Contact represents an ActivityPub actor that the user has interacted with.
export type Contact = {
	id: string // Activity Vocabulary property: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-id
	name: string // Activity Vocabulary property: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-name
	icon: string // Activity Vocabulary property: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-icon
	preferredUsername: string // Activity Vocabulary property: https://www.w3.org/TR/activitypub/#preferredUsername
	known: boolean // If TRUE, this contact has been marked "known" by the user.
	updated: number // Unix epoch (in seconds) when this contact was last retrieved
}

export function NewContact() {
	return {
		id: "",
		name: "",
		icon: "",
		preferredUsername: "",
		known: false,
		updated: 0,
	}
}

export function ContactFromActor(actor: Actor): Contact {
	return {
		id: actor.id(),
		name: actor.name(),
		icon: actor.icon(),
		preferredUsername: actor.preferredUsername(),
		known: false,
		updated: Math.floor(Date.now() / 1000),
	}
}
