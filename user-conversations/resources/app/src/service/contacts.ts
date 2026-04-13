import m from "mithril"
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

	// loadContact retrieves a contact by ID, using the in-memory cache if possible.
	loadContact = async (id: string): Promise<Contact> => {

		// If the contact exists in the cache, then return it
		if (this.#contacts.has(id)) {
			return this.#contacts.get(id)!
		}

		try {

			// Load the Actor from the provided ID
			const actor = await new Actor().fromURL(id)
			return ContactFromActor(actor)

		} catch (error) {

			// Log error and return undefined
			console.error("Failed to load contact from URL:", id, error)
			return NewContact(id)
		}
	}

	// getContactStream retrieves a contact by ID from the in-memory map
	getContactStream = (id: string): Stream<Contact> => {

		// Create an empty contact
		var result = Stream(NewContact(id))

		// If the contact exists and is fresh, return it as a stream
		const cachedValue = this.#contacts.get(id)

		// If the cached value exists then use it as an initial value
		if (cachedValue != undefined) {
			result(cachedValue)

			// If the cached value is stil fresh, then we're done.
			if (cachedValue.updated + this.#maxAge > Date.now()) {
				return result
			}
		}

		// Fall through means the cached value is missing or stale.
		// Load it from the network, add it to the cache, then update the stream
		new Actor().fromURL(id).then(response => {
			const contact = ContactFromActor(response)
			this.#contacts.set(id, contact)
			result(contact)
			m.redraw()
		})

		return result
	}

	// saveContact adds or updates a contact in the in-memory map
	saveContact = (contact: Contact) => {
		this.#contacts.set(contact.id, contact)
	}
}