// MLS Types
import { type KeyPackage } from "ts-mls"
import { type PrivateKeyPackage } from "ts-mls"

// IDB Objects
import { type DBSchema } from "idb"
import { type IDBPDatabase } from "idb"
import { openDB } from "idb"

// Model Types
import { type Config } from "../model/config"
import { type EncryptedGroup } from "../model/group"
import { type Group } from "../model/group"
import { Message, NewMessage, type MessageData } from "../model/message"
import { type DBKeyPackage } from "../model/db-keypackage"

// Model Objects
import { ConfigID } from "../model/config"
import { NewConfig } from "../model/config"
import { diffArrays, newId } from "./utils"
import type { IHost } from "./interfaces"

// Schema defines the layout of records stored in IndexedDB
interface Schema extends DBSchema {
	config: {
		key: string
		value: Config
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
	#host: IHost

	constructor(host: IHost, db: IDBPDatabase<Schema>) {
		this.#host = host
		this.#db = db
		this.#onchange = () => { }
	}

	stop = () => {
		this.#db.close()
	}

	erase = () => {
		console.log("Erasing database: ", this.#db.name)

		this.#db.close()
		var req = window.indexedDB.deleteDatabase(this.#db.name)

		req.onsuccess = (event) => {
			console.log("Database erased successfully: ", event)
			this.#host.reload()
		}

		req.onerror = (event) => {
			console.error("Unable to erase database: ", event)
		}

		req.onblocked = () => {
			alert("Unable to erase database. Please close the other tabs that are using this application and try again.")
		}
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

		console.log("saveGroup", group)

		// Load the previous group members for comparison later
		const previousGroup = await this.loadGroup(group.id)
		const previousMembers = previousGroup?.members || []
		console.log(previousGroup, previousMembers)
		const { added, removed } = diffArrays(previousMembers, group.members)

		console.log(added, removed)

		// Add a status message to the conversation for
		// each new member that was added.
		added.forEach(member => {

			const statusMessage = NewMessage({
				id: newId(),
				groupId: group.id,
				type: "ADD-ACTOR",
				sender: member,
			})

			this.saveMessage(statusMessage)
		})

		// Add a status message to the conversation for 
		// each member that was removed.
		removed.forEach(member => {

			const statusMessage = NewMessage({
				id: newId(),
				groupId: group.id,
				type: "REMOVE-ACTOR",
				sender: member,
			})

			this.saveMessage(statusMessage)
		})

		// RULE: Truncate lastMessage to 100 characters for display purposes
		group.lastMessage = group.lastMessage.slice(0, 100)


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
	// KeyPackages
	/////////////////////////////////////////////

	// loadKeyPackage retrieves the KeyPackage for the current user
	loadKeyPackage = async () => {
		return await this.#db.get("keyPackage", "self")
	}

	// saveKeyPackage saves the ID, public, and private portions of the KeyPackage to the database
	saveKeyPackage = async (keyPackageId: string, publicPackage: KeyPackage, privatePackage: PrivateKeyPackage) => {

		// Create a DBKeyPackage record
		const dbKeyPackage = {
			id: "self",
			keyPackageURL: keyPackageId,
			publicKeyPackage: publicPackage,
			privateKeyPackage: privatePackage,
			createDate: Date.now(),
		}

		// Save it to the database
		await this.#db.put("keyPackage", dbKeyPackage)

		// Return to caller
		return dbKeyPackage
	}

	/////////////////////////////////////////////
	// Messages
	/////////////////////////////////////////////

	// allMessages returns all messages in the specified group, sorted by createDate ascending
	// TODO: This will need to be limited or pagincated for long discussions.
	allMessages = async (groupId: string) => {

		// Retrieve the messages from the database
		var messageData = await this.#db.getAllFromIndex("message", "groupId", groupId)

		// Sort by createDate ascending
		messageData.sort((a, b) => a.createDate - b.createDate)

		// Convert to Message objects and return
		return messageData.map(data => NewMessage(data))
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
