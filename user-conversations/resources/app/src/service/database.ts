// MLS Types
import { type ClientConfig } from "ts-mls"

// IDB Objects
import { type DBSchema } from "idb"
import { type IDBPDatabase } from "idb"
import { openDB } from "idb"

// Model Types
import { type Config } from "../model/config"
import { type EncryptedGroup } from "../model/group"
import { type Group } from "../model/group"
import { type Contact } from "../model/contact"
import { Message, NewMessage, type MessageData } from "../model/message"
import { type DBKeyPackage } from "../model/db-keypackage"

// Model Objects
import { ConfigID } from "../model/config"
import { NewConfig } from "../model/config"

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
		value: Group | EncryptedGroup
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
		value: MessageData
		indexes: {
			id: string
			groupId: string
		}
	}
}

type callbackFunction = () => void

export async function NewIndexedDB(actorId: string): Promise<IDBPDatabase<Schema>> {
	return await openDB<Schema>(actorId, 1, {
		upgrade(db, oldVersion, newVersion, transaction) {

			if (oldVersion < 1) {

				// Create object stores for each record
				db.createObjectStore("config", { keyPath: "id" })
				db.createObjectStore("contact", { keyPath: "id" })
				db.createObjectStore("group", { keyPath: "id" })
				db.createObjectStore("keyPackage", { keyPath: "id" })
				db.createObjectStore("message", { keyPath: "id" })

				// Create indexes for efficient queries
				transaction.objectStore("message").createIndex("groupId", "groupId", { unique: false })
			}
		},
	})
}

export class Database {
	#db: IDBPDatabase<Schema>
	#onchange: callbackFunction

	constructor(db: IDBPDatabase<Schema>) {
		this.#db = db
		this.#onchange = () => { }
	}

	stop = () => {
		this.#db.close()
	}

	erase = () => {
		this.#db.close()
		window.indexedDB.deleteDatabase(this.#db.name)
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
		if (result != undefined) {
			return result
		}
		return NewConfig()
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

	// loadContact retrieves a single contact from the database by ID
	loadContact = async (id: string) => {
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

		// List all groups, sorted by updateDate descending
		var groups = await this.#db.getAll("group")
		groups.sort((a, b) => b.updateDate - a.updateDate)
		return groups
	}

	// loadGroup retrieves a group from the database
	loadGroup = async (groupID: string): Promise<Group | EncryptedGroup | undefined> => {

		// Load the group record
		const group = await this.#db.get("group", groupID)
		if (group == undefined) {
			return undefined
		}

		// Success?
		return group
	}

	// saveGroup saves a group to the database
	saveGroup = async (group: Group) => {
		await this.#db.put("group", group)
		this.#onchange()
	}

	// deleteGroup removes a group from the database
	deleteGroup = async (groupId: string) => {

		// List all messages in the group
		const messages = await this.#db.getAllKeysFromIndex("message", "groupId", groupId)

		// Delete messages in the group
		for (const message of messages) {
			await this.#db.delete("message", message)
		}

		// Delete the group itself
		await this.#db.delete("group", groupId)
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
	allMessages = async (groupId: string) => {
		var messages = await this.#db.getAllFromIndex("message", "groupId", groupId)
		messages.sort((a, b) => a.createDate - b.createDate)
		return messages
	}

	// loadMessage retrieves a message from the database
	loadMessage = async (messageID: string) => {
		const data = await this.#db.get("message", messageID)
		if (data == undefined) {
			throw new Error("Message not found: " + messageID)
		}
		return NewMessage(data)
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

	// deleteMessagesByGroup removes all messages that belong to a group
	deleteMessagesByGroup = async (groupId: string) => {

		// List all messages in the group
		const messages = await this.#db.getAllKeysFromIndex("message", "groupId", groupId)

		// Delete messages in the group
		for (const message of messages) {
			await this.#db.delete("message", message)
		}

		this.#onchange()
	}

	// likeMessage adds a "like" from the specified actor to the specified message
	likeMessage = async (actorId: string, messageId: string, content: string) => {

		// Retrieve the message from the database
		var message = await this.loadMessage(messageId)

		// RULE: If the message doesn't exist, then exit
		if (message == undefined) {
			console.error("Cannot find message: " + messageId)
			return
		}

		// Apply the reaction content and save the record
		message.setReaction(actorId, content)
		await this.saveMessage(message)

		// Success
		return message
	}

	undoLikeMessage = async (actorId: string, messageId: string) => {

		// Retrieve the message from the database
		var message = await this.loadMessage(messageId)

		// RULE: If the message doesn't exist, then exit
		if (message == undefined) {
			console.error("Cannot find 'like' message to undo: " + messageId)
			return undefined
		}

		// Remove the reaction and save the record
		if (message.removeReaction(actorId)) {
			await this.saveMessage(message)
		}

		// Success
		return message
	}
}
