import type {DBSchema, IDBPDatabase} from "idb/build/entry.js"
import {openDB} from "idb"
import {ConfigID, NewConfig, type Config} from "../model/config"
import {type Group} from "../model/group"
import {type Contact} from "../model/contact"
import {type Message} from "../model/message"
import type {DBKeyPackage} from "../model/db-keypackage"
import {type ClientConfig} from "ts-mls/clientConfig.js"

// Schema defines the layout of records stored in IndexedDB
interface Schema extends DBSchema {
	config: {
		key: string
		value: Config
		indexes: {
			id: string
		}
	}

	contact: {
		key: string
		value: Contact
		indexes: {
			id: string
		}
	}

	group: {
		key: string
		value: Group
		indexes: {
			id: string
		}
	}

	keyPackage: {
		key: string
		value: DBKeyPackage
		indexes: {
			id: string
		}
	}

	message: {
		key: string
		value: Message
		indexes: {
			id: string
			group: string
		}
	}
}

type callbackFunction = () => void

export async function NewIndexedDB(actorId: string): Promise<IDBPDatabase<Schema>> {
	return await openDB<Schema>("mls-" + actorId, 2, {
		upgrade(db, oldVersion, newVersion) {
			//
			// Version 1
			if (oldVersion < 1) {
				db.createObjectStore("config", {keyPath: "id"})
				db.createObjectStore("group", {keyPath: "id"})
				db.createObjectStore("keyPackage", {keyPath: "id"})

				const messages = db.createObjectStore("message", {keyPath: "id"})
				messages.createIndex("group", "group", {unique: false})
			}

			// Version 2 - Add "contact" store
			if (oldVersion < 2) {
				db.createObjectStore("contact", {keyPath: "id"})
			}
		},
	})
}

export class Database {
	#db: IDBPDatabase<Schema>
	#clientConfig: ClientConfig
	#onchange: callbackFunction

	constructor(db: IDBPDatabase<Schema>, clientConfig: ClientConfig) {
		this.#db = db
		this.#clientConfig = clientConfig
		this.#onchange = () => {}
	}

	// setChange allows the caller to provide a redraw function that will be called after database operations
	onchange = (callback: callbackFunction) => {
		this.#onchange = callback
	}

	/////////////////////////////////////////////
	// Config
	/////////////////////////////////////////////

	// loadConfig retrieves the config record from the database
	loadConfig = async () => {
		var result = await this.#db.get("config", ConfigID)
		if (result == undefined) {
			result = NewConfig()
		}

		// Mark this configuration as "loaded from the db"
		result.ready = true
		return result
	}

	// saveConfig saves the config record to the database
	saveConfig = async (config: Config) => {
		config.id = ConfigID
		config.ready = true
		await this.#db.put("config", config)
	}

	/////////////////////////////////////////////
	// Contacts
	/////////////////////////////////////////////

	// allContacts returns all contacts from the database
	allContacts = async () => {
		return await this.#db.getAll("contact")
	}

	// getContact retrieves a single contact from the database by ID
	getContact = async (id: string) => {
		return this.#db.get("contact", id)
	}

	// saveContact saves a single contact to the database
	saveContact = async (contact: Contact) => {
		await this.#db.put("contact", contact)
	}

	/////////////////////////////////////////////
	// Groups
	/////////////////////////////////////////////

	// allGroups returns all groups from the database, sorted by updateDate descending
	async allGroups(): Promise<Group[]> {
		//
		// List all groups, sorted by updateDate descending
		var groups = await this.#db.getAll("group")
		groups.sort((a, b) => b.updateDate - a.updateDate)
		return groups
	}

	// saveGroup saves a group to the database
	saveGroup = async (group: Group) => {
		await this.#db.put("group", group)
		this.#onchange()
	}

	// loadGroup retrieves a group from the database
	loadGroup = async (groupID: string) => {
		//

		// Load the group record
		const group = await this.#db.get("group", groupID)
		if (group == undefined) {
			throw new Error("Group not found: " + groupID)
		}

		// Success?
		return group
	}

	// deleteGroup removes a group from the database
	deleteGroup = async (group: string) => {
		//
		// List all messages in the group
		const messages = await this.#db.getAllKeysFromIndex("message", "group", group)

		// Delete messages in the group
		for (const message of messages) {
			await this.#db.delete("message", message)
		}

		// Delete the group itself
		await this.#db.delete("group", group)
		this.#onchange()
	}

	/////////////////////////////////////////////
	// Private KeyPackage
	/////////////////////////////////////////////

	loadKeyPackage = async () => {
		const keyPackage = await this.#db.get("keyPackage", "self")
		return keyPackage
	}

	saveKeyPackage = async (keyPackage: DBKeyPackage) => {
		await this.#db.put("keyPackage", keyPackage)
	}

	/////////////////////////////////////////////
	// Messages
	/////////////////////////////////////////////

	// allMessages returns all messages in the specified group, sorted by createDate ascending
	// TODO: This will need to be limited or pagincated for long discussions.
	allMessages = async (group: string) => {
		var messages = await this.#db.getAllFromIndex("message", "group", group)
		messages.sort((a, b) => a.createDate - b.createDate)
		return messages
	}

	// loadMessage retrieves a message from the database
	loadMessage = async (messageID: string) => {
		const message = await this.#db.get("message", messageID)
		if (message == undefined) {
			throw new Error("Message not found: " + messageID)
		}
		return message
	}

	// saveMessage saves a message to the database
	saveMessage = async (message: Message) => {
		await this.#db.put("message", message)
		this.#onchange()
	}

	// deleteMessage removes a message from the database
	deleteMessage = async (messageId: string) => {
		await this.#db.delete("message", messageId)
		this.#onchange()
	}
}
