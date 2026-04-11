import { Actor } from '../as/actor'
import { type Contact, ContactFromActor, NewContact } from '../model/contact'
import Stream from "mithril/stream"

export class Contacts {

	#contacts: Map<string, Contact> // Map of contact ID to Contact object
	#maxAge: number // Maximum age (in ms) for a contact to be considered "fresh"

	constructor() {
		this.#contacts = new Map()
		this.#maxAge = 24 * 60 * 60 * 1000 // Refresh contacts after 24 hours
	}

	// stop clears the in-memory contacts map
	stop = () => {
		this.#contacts.clear()
	}

	// loadContact retrieves a contact by ID from the in-memory map
	loadContact = (id: string): Stream<Contact> => {

		// Create an empty contact
		var result = Stream(NewContact(id))

		// If the contact exists and is fresh, return it as a stream
		const cachedValue = this.#contacts.get(id)

		// If the cached value exists then use it as an initial value
		if (cachedValue != undefined) {
			result(cachedValue)

			// If the cached value is stil fresh, then we're done.
			if (Date.now() - cachedValue.updated < this.#maxAge) {
				return result
			}
		}

		// Fall through means the cached value is missing or stale.
		// Load it from the network and update the stream when it arrives.
		new Actor().fromURL(id).then(response => {
			result(ContactFromActor(response))
		})

		return result
	}

	// saveContact adds or updates a contact in the in-memory map
	saveContact = (contact: Contact) => {
		this.#contacts.set(contact.id, contact)
	}

}