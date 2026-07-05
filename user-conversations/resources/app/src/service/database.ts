// IDB Objects
import { type DBSchema, type IDBPDatabase, openDB } from "idb"

// Model Types
import { type Config, ConfigID, NewConfig } from "../model/config"
import { type Filter } from "../model/filter"
import { type EncryptedGroup, type Group, type GroupState, filterAndSortGroups } from "../model/group"
import { Message, NewMessage, legacyAttachmentToAttachment, type MessageData } from "../model/message"
import { type DBKeyPackage } from "../model/db-keypackage"

// Model Objects
import { diffArrays, newId } from "./utils"
import { type IDatabase, type IHost } from "./interfaces"

// Schema defines the layout of records stored in IndexedDB
interface Schema extends DBSchema {
	config: {
		key: string
		value: Config
		indexes: {
			id: string
		}
	}

	filter: {
		key: string
		value: Filter
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
	return await openDB<Schema>(actorId, 3, {
		// idb's openDB awaits an async upgrade callback within the upgrade
		// transaction, so returning a Promise here is correct and required
		// (migrateAttachments below must be awaited). no-misused-promises
		// cannot see idb's contract, hence the scoped disable.
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		async upgrade(db, oldVersion, _newVersion, transaction) {

			if (oldVersion < 1) {

				// Create object stores for each record
				db.createObjectStore("config", { keyPath: "id" })
				db.createObjectStore("group", { keyPath: "id" })
				db.createObjectStore("keyPackage", { keyPath: "id" })
				db.createObjectStore("message", { keyPath: "id" })

				// Create indexes for efficient queries
				transaction.objectStore("message").createIndex("groupId", "groupId", { unique: false })
			}

			if (oldVersion < 2) {
				db.createObjectStore("filter", { keyPath: "id" })
			}

			// Migrate attachments from the legacy string[] form to structured Attachment[]
			if (oldVersion >= 1 && oldVersion < 3) {
				await migrateAttachments(transaction.objectStore("message"))
			}
		},
	})
}

// migrateAttachments rewrites every stored message's "attachments" field from the
// legacy string[] form (bare URLs or "data:" URIs) into the structured
// Attachment[] form. It is a no-op for messages already in the new shape.
async function migrateAttachments(store: any): Promise<void> {

	let cursor = await store.openCursor()

	while (cursor != null) {

		const message = cursor.value
		const attachments = message.attachments

		// Only legacy records have an array of strings; skip anything already migrated
		if (Array.isArray(attachments) && attachments.some((item: unknown) => typeof item == "string")) {
			message.attachments = attachments.map((item: unknown) =>
				typeof item == "string" ? legacyAttachmentToAttachment(item) : item
			)
			await cursor.update(message)
		}

		cursor = await cursor.continue()
	}
}

export class Database implements IDatabase {
	readonly #db: IDBPDatabase<Schema>
	readonly #host: IHost
	#onchange: callbackFunction

	constructor(host: IHost, db: IDBPDatabase<Schema>) {
		this.#host = host
		this.#db = db
		this.#onchange = () => { }
	}

	stop() {
		this.#db.close()
	}

	erase() {

		this.#db.close()
		const req = globalThis.indexedDB.deleteDatabase(this.#db.name)

		req.onsuccess = (_event) => {
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
	onchange(callback: callbackFunction) {
		this.#onchange = callback
	}

	/////////////////////////////////////////////
	// Config
	/////////////////////////////////////////////

	// loadConfig retrieves the config record from the database
	async loadConfig() {
		const result = await this.#db.get("config", ConfigID)
		if (result != undefined) {
			return result
		}
		return NewConfig()
	}

	// saveConfig saves the config record to the database
	async saveConfig(config: Config) {
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
		const groups = await this.#db.getAll("group")
		groups.sort((a, b) => b.updateDate - a.updateDate)
		return groups
	}

	// loadGroup retrieves a group from the database
	async loadGroup(groupID: string): Promise<Group | EncryptedGroup | undefined> {

		// Load the group record
		const group = await this.#db.get("group", groupID)
		if (group == undefined) {
			return undefined
		}

		// Success?
		return group
	}

	// saveGroup saves a group to the database
	async saveGroup(group: Group) {

		// RULE: Group must have an ID
		if (group.id == undefined || group.id == "") {
			throw new Error("Group must have an ID")
		}

		// Load the previous group members for comparison later
		const previousGroup = await this.loadGroup(group.id)
		const previousMembers = previousGroup?.members || []
		const { added, removed } = diffArrays(previousMembers, group.members)

		// Add a status message to the conversation for
		// each new member that was added. Awaited so the writes commit (and errors
		// surface) before the group itself is saved below; a forEach would drop these
		// promises and let saveGroup resolve with the writes still in flight.
		for (const member of added) {

			const statusMessage = NewMessage({
				id: newId(),
				groupId: group.id,
				type: "ADD-ACTOR",
				sender: member,
			})

			await this.saveMessage(statusMessage)
		}

		// Add a status message to the conversation for
		// each member that was removed.
		for (const member of removed) {

			const statusMessage = NewMessage({
				id: newId(),
				groupId: group.id,
				type: "REMOVE-ACTOR",
				sender: member,
			})

			await this.saveMessage(statusMessage)
		}

		// RULE: Truncate lastMessage to 100 characters for display purposes
		group.lastMessage = group.lastMessage.slice(0, 100)


		await this.#db.put("group", group)
		this.#onchange()
	}

	// searchGroups returns the stored groups matching the given tags and stateIds,
	// sorted with IMPORTANT groups first. See filterAndSortGroups for the filtering
	// and sorting rules (including the WELCOME-always-included behavior).
	async searchGroups(tags: string[], stateIds: GroupState[] = []): Promise<Group[]> {
		const groups = await this.#db.getAll("group")
		return filterAndSortGroups(groups, tags, stateIds)
	}

	// deleteGroup removes a group from the database
	async deleteGroup(groupId: string) {

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
	// Filters
	/////////////////////////////////////////////

	// allFilters returns all conversation filters, sorted by their sort field
	// ascending, then by name ascending to break ties
	async allFilters(): Promise<Filter[]> {
		const filters = await this.#db.getAll("filter")
		return filters.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name))
	}

	// loadFilter retrieves a single filter from the database
	async loadFilter(filterId: string): Promise<Filter | undefined> {
		return await this.#db.get("filter", filterId)
	}

	// saveFilter saves a filter to the database
	async saveFilter(filter: Filter) {

		// RULE: Filter must have an ID
		if (filter.id == undefined || filter.id == "") {
			throw new Error("Filter must have an ID")
		}

		await this.#db.put("filter", filter)
		this.#onchange()
	}

	// deleteFilter removes a filter from the database
	async deleteFilter(filterId: string) {

		// RULE: locked (built-in) filters cannot be deleted
		const filter = await this.#db.get("filter", filterId)
		if (filter?.locked) {
			throw new Error("Cannot delete a locked filter")
		}

		await this.#db.delete("filter", filterId)
		this.#onchange()
	}

	/////////////////////////////////////////////
	// KeyPackages
	/////////////////////////////////////////////

	// loadKeyPackage retrieves the KeyPackage for the current user
	async loadKeyPackage() {
		return await this.#db.get("keyPackage", "self")
	}

	// saveKeyPackage saves the KeyPackage to the database, recomputing the signature and emojiKey.
	async saveKeyPackage(record: DBKeyPackage) {

		// Save it to the database
		await this.#db.put("keyPackage", record)

		// Return to caller
		return record
	}

	async deleteKeyPackage() {
		await this.#db.delete("keyPackage", "self")
	}

	/////////////////////////////////////////////
	// Messages
	/////////////////////////////////////////////

	// allMessages returns all messages in the specified group, sorted by createDate ascending
	async allMessages(groupId: string) {

		// Retrieve the messages from the database
		const messageData = await this.#db.getAllFromIndex("message", "groupId", groupId)

		// Sort by createDate ascending
		messageData.sort((a, b) => a.createDate - b.createDate)

		// Convert to Message objects and return
		return messageData.map(data => NewMessage(data))
	}

	// getFirstMessageInGroup returns the earliest received message in a group
	async getFirstMessageInGroup(groupId: string): Promise<Message | undefined> {
		const messageData = await this.#db.getAllFromIndex("message", "groupId", groupId)
		const received = messageData
			.filter(data => data.type === "RECEIVED")
			.sort((a, b) => a.createDate - b.createDate)
		if (received.length === 0) {
			return undefined
		}
		return NewMessage(received[0])
	}

	// loadMessage retrieves a message from the database
	async loadMessage(messageID: string) {
		const data = await this.#db.get("message", messageID)
		if (data == undefined) {
			throw new Error("Message not found: " + messageID)
		}
		return NewMessage(data)
	}

	// saveMessage saves a message to the database (this action is idempotent)
	async saveMessage(message: Message) {
		await this.#db.put("message", message)
		this.#onchange()
	}

	// deleteMessage removes a message from the database
	async deleteMessage(messageId: string) {
		await this.#db.delete("message", messageId)
		this.#onchange()
	}

	// deleteMessagesByGroup removes all messages that belong to a group
	async deleteMessagesByGroup(groupId: string) {

		// List all messages in the group
		const messages = await this.#db.getAllKeysFromIndex("message", "groupId", groupId)

		// Delete messages in the group
		for (const message of messages) {
			await this.#db.delete("message", message)
		}

		this.#onchange()
	}

	// likeMessage adds a "like" from the specified actor to the specified message
	async likeMessage(actorId: string, messageId: string, content: string) {

		// Retrieve the message from the database
		const message = await this.loadMessage(messageId)

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

	async undoLikeMessage(actorId: string, messageId: string) {

		// Retrieve the message from the database
		const message = await this.loadMessage(messageId)

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
