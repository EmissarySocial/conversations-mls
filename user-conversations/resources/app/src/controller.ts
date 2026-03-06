// old imports
import m from "mithril"
import stream from "mithril/stream"
import {type ClientConfig, type KeyPackage, type Welcome} from "ts-mls"
import {MLS} from "./service/mls"
import {Document} from "./ap/document"
import {type Config, NewConfig} from "./model/config"
import {type APActor} from "./model/ap-actor"
import {type Contact, NewContact} from "./model/contact"
import {type Message} from "./model/message"
import {type Group} from "./model/group"

import {MLSFactory} from "./service/mls-factory"
import type {Delivery} from "./service/delivery"
import type {Directory} from "./service/directory"
import type {Database} from "./service/database"
import type {Receiver} from "./service/receiver"

export class Controller {
	#actor: Document
	#database: Database
	#delivery: Delivery
	#directory: Directory
	#receiver: Receiver
	#mls?: MLS
	#allowPlaintextMessages: boolean

	config: Config
	clientConfig: ClientConfig
	selectedGroupId: string
	groups: stream<Group[]>
	group: stream<Group>
	messages: stream<Message[]>
	contacts: stream<Map<string, Contact>>
	pageView: string
	modalView: string

	// constructor initializes the Controller with its dependencies
	constructor(
		actor: Document,
		database: Database,
		delivery: Delivery,
		directory: Directory,
		receiver: Receiver,
		allowPlaintextMessages: boolean,
		clientConfig: ClientConfig,
	) {
		this.#actor = actor
		this.#database = database
		this.#delivery = delivery
		this.#directory = directory
		this.#receiver = receiver
		this.#allowPlaintextMessages = allowPlaintextMessages

		this.clientConfig = clientConfig
		this.selectedGroupId = ""
		this.groups = stream([] as Group[])
		this.group = stream({} as Group)
		this.messages = stream([] as Message[])
		this.contacts = stream(new Map<string, Contact>())

		this.pageView = ""
		this.modalView = ""

		// Application Configuration
		this.config = NewConfig() // Empty placeholder until loaded
		this.loadConfig()
		this.loadGroups()
	}

	//////////////////////////////////////////
	// Startup
	//////////////////////////////////////////

	// loadConfig retrieves the configuration from the
	// database and starts the MLS service (if encryption keys are present)
	async loadConfig() {
		this.config = await this.#database.loadConfig()

		if (this.config.hasEncryptionKeys) {
			this.startMLS()
		}
		m.redraw()
	}

	// startMLS initializes the MLS service IF the configuration includes encryption keys
	private async startMLS() {
		//
		// Guarantee dependency
		if (this.config.hasEncryptionKeys == false) {
			throw new Error("Cannot start MLS without encryption keys")
		}

		// Create the MLS instance
		this.#mls = await MLSFactory(
			this.#database,
			this.#delivery,
			this.#directory,
			this.#receiver,
			this.#actor,
			this.config.clientName,
		)

		// Wire UX redraws into database updates
		this.#database.onchange(async () => {
			await this.loadGroups()
			await this.loadMessages()
			await this.loadContacts()
		})
	}

	// createEncryptionKeys creates a new set of encryption keys
	// for this user on this device
	async createEncryptionKeys(clientName: string, password: string, passwordHint: string) {
		//
		// Initialize the config
		this.config.ready = true
		this.config.welcome = true
		this.config.hasEncryptionKeys = true
		this.config.clientName = clientName
		this.config.password = password
		this.config.passwordHint = passwordHint

		// Save the config to IndexedDB
		await this.#database.saveConfig(this.config)

		// Start the MLS service
		this.startMLS()

		// Redraw the UX
		m.redraw()
	}

	// skipEncryptionKeys is called when the user just wants to
	// use "direct messages" and does not want to create encryption keys (yet)
	async skipEncryptionKeys() {
		//
		// Initialize the config
		this.config.welcome = true
		await this.#database.saveConfig(this.config)

		// Redraw the UX
		m.redraw()
	}

	//////////////////////////////////////////
	// Getters

	actorId(): string {
		return this.#actor.id()
	}

	//////////////////////////////////////////
	// Conversations (Plaintext)

	// newConversation creates a new plaintext ActivityPub conversation
	// with the specified recipients
	async newConversation(to: string[], message: string) {
		//
		// Create an ActivityPub activity
		const activity = {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Create",
			actor: this.#actor.id(),
			to: to,
			object: {
				type: "Note",
				content: message,
			},
		}

		// POST to the actor's outbox
		const response = await fetch(this.#actor.outbox(), {
			method: "POST",
			headers: {"Content-Type": "application/activity+json"},
			body: JSON.stringify(activity),
		})
	}

	//////////////////////////////////////////
	// Contacts
	//////////////////////////////////////////

	async loadContacts() {
		//

		// Retrieve each contact in the selected group.
		const promises = this.group().members.map(async (id) => this.loadContact(id))
		const contacts = await Promise.all(promises)

		// Return contacs in a Map, not an array
		const result = new Map<string, Contact>()
		for (const contact of contacts) {
			if (contact == undefined) {
				continue
			}
			result.set(contact.id, contact)
		}

		this.contacts = stream(result)
		m.redraw()
	}

	async loadContact(id: string): Promise<Contact | undefined> {
		// Try to get the contact from the database first
		var result = await this.#database.getContact(id)
		if (result !== undefined) {
			return result
		}

		// Otherwise, load from the directory
		return await this.#directory.getContact(id)
	}

	//////////////////////////////////////////
	// Groups (Encrypted)
	//////////////////////////////////////////

	// createGroup creates a new MLS-encrypted
	// group message with the specified recipients
	async createGroup(recipients: string[]): Promise<Group> {
		//
		// Guarantee dependency
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		// Create a new group
		const group = await this.#mls.createGroup()

		// Add initial members to the group
		await this.#mls.addGroupMembers(group.id, recipients)

		// Update the selected group
		this.selectedGroupId = group.id

		// Reload groups and messages to refresh the UX
		await this.loadGroups()

		return group
	}

	// loadGroups retrieves all groups from the database and
	// updates the "groups" and "messages" streams.
	async loadGroups() {
		//
		// load groups from the database
		const groups = await this.#database.allGroups()

		// If there are no groups, then set all values to "empty" state
		if (groups.length == 0) {
			this.groups([])
			this.messages([])
			this.selectedGroupId = ""
			return
		}

		// Fall through means we have 1+ groups
		// Set the groups and messages streams accordingly
		this.groups(groups)

		// If the selected group ID doesn't exist in the new list of groups, then select the first group in the list.
		if (groups.find((group) => group.id == this.selectedGroupId) == undefined) {
			this.selectGroup(groups[0]!.id)
		}
	}

	async loadGroup(groupId: string): Promise<Group> {
		return await this.#database.loadGroup(groupId)
	}

	// selectGroup updates the "selectedGroupId" and reloads messages for that group
	selectGroup(groupId: string) {
		//
		// If this group is already selected, then do nothing
		if (groupId == this.selectedGroupId) {
			this.page_messages()
			return
		}

		// Clear current controller data
		this.group({} as Group)
		this.contacts = stream(new Map<string, Contact>())
		this.messages = stream([] as Message[])

		// Find the group with the specified ID
		const group = this.groups().find((group) => group.id == groupId)

		if (group == undefined) {
			return
		}

		// Update the selected group, and reload related records
		this.selectedGroupId = groupId
		this.group(group)
		this.loadMessages()
		this.loadContacts()
		this.page_messages()
	}

	// saveGroup saves the specified group to the database and reloads groups
	async saveGroup(group: Group) {
		await this.#database.saveGroup(group)
		await this.loadGroups()
	}

	// deleteGroup deletes the specified group from the database
	async deleteGroup(group: string) {
		//
		// Guarantee dependency
		if (this.#database == undefined) {
			throw new Error("Database service is not initialized")
		}

		// Delete the group
		await this.#database.deleteGroup(group)
		await this.loadGroups()
	}

	//////////////////////////////////////////
	// Messages
	//////////////////////////////////////////

	// loadMessages retrieves all messages for the currently selected group and updates the "messages" stream
	async loadMessages() {
		const messages = await this.#database.allMessages(this.selectedGroupId)
		this.messages(messages)
		m.redraw()
	}

	// sendMessage sends a message to the specified group
	async sendMessage(message: string) {
		//
		// Guarantee dependencies
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		if (this.selectedGroupId == "") {
			throw new Error("No group selected")
		}

		// Send the message to the group
		await this.#mls.sendGroupMessage(this.selectedGroupId, message)

		// Reload messages to refresh the UX
		this.loadMessages()
	}

	//////////////////////////////////////////
	// Pages
	//////////////////////////////////////////

	page_groups() {
		this.pageView = "GROUPS"
		m.redraw()
	}

	page_messages() {
		this.pageView = "MESSAGES"
		m.redraw()
	}

	page_settings() {
		this.pageView = "SETTINGS"
		m.redraw()
	}

	//////////////////////////////////////////
	// Modal Dialogs
	//////////////////////////////////////////

	modal_close() {
		this.modalView = ""
	}

	modal_newConversation() {
		this.modalView = "NEW-CONVERSATION"
	}
}
