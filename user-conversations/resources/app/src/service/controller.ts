// old imports
import m from "mithril"

// ActivityPub objects
import { Actor } from "../as/actor"
import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"

// Model objects
import { type Config } from "../model/config"
import { type Contact } from "../model/contact"
import { type Message } from "../model/message"
import { type Group } from "../model/group"
import { NewConfig } from "../model/config"
import { NewGroup } from "../model/group"
import { NewMessage } from "../model/message"
import { groupIsEncrypted } from "../model/group"

// Services
import { type Delivery } from "./delivery"
import { type Directory } from "./directory"
import { type Database } from "./database"
import { type Receiver } from "./receiver"
import { MLSFactory } from "./mls-factory"
import { MLS } from "./mls"
import { newId } from "./utils"

export class Controller {
	#actor: Actor
	#database: Database
	#delivery: Delivery
	#directory: Directory
	#receiver: Receiver
	#mls?: MLS
	#allowPlaintextMessages: boolean

	config: Config
	groups: Group[]
	group: Group
	messages: Message[]
	contacts: Map<string, Contact>
	pageView: string
	modalView: string

	// constructor initializes the Controller with its dependencies
	constructor(
		actor: Actor,
		database: Database,
		delivery: Delivery,
		directory: Directory,
		receiver: Receiver,
		allowPlaintextMessages: boolean,
	) {
		// Dependencies
		this.#actor = actor
		this.#database = database
		this.#delivery = delivery
		this.#directory = directory
		this.#receiver = receiver
		this.#allowPlaintextMessages = allowPlaintextMessages

		// Application State
		this.groups = []
		this.group = NewGroup()
		this.messages = []
		this.contacts = new Map<string, Contact>()

		// UX state
		this.pageView = ""
		this.modalView = ""

		// Application Configuration
		this.config = NewConfig() // Empty placeholder until loaded
		this.#receiver.registerHandler(this.receiveActivity) // Connect onActivity handler
		this.loadConfig()
		this.loadGroups()
	}

	//////////////////////////////////////////
	// Startup
	//////////////////////////////////////////

	// loadConfig retrieves the configuration from the
	// database and starts the MLS service (if encryption keys are present)
	loadConfig = async () => {
		this.config = await this.#database.loadConfig()

		if (this.config.hasEncryptionKeys) {
			this.#startMLS()
		}
		m.redraw()
	}

	// startMLS initializes the MLS service IF the configuration includes encryption keys
	#startMLS = async () => {
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
	createEncryptionKeys = async (clientName: string, password: string, passwordHint: string) => {
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
		this.#startMLS()

		// Redraw the UX
		m.redraw()
	}

	// skipEncryptionKeys is called when the user just wants to
	// use "direct messages" and does not want to create encryption keys (yet)
	skipEncryptionKeys = async () => {
		//
		// Initialize the config
		this.config.welcome = true
		await this.#database.saveConfig(this.config)

		// Redraw the UX
		m.redraw()
	}

	//////////////////////////////////////////
	// Getters
	//////////////////////////////////////////

	actorId = (): string => {
		return this.#actor.id()
	}

	//////////////////////////////////////////
	// Conversations (Plaintext)
	//////////////////////////////////////////

	// newConversation creates a new plaintext ActivityPub conversation
	// with the specified recipients
	newConversation = async (to: string[], message: string) => {
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
			headers: { "Content-Type": "application/activity+json" },
			body: JSON.stringify(activity),
		})
	}

	//////////////////////////////////////////
	// Contacts
	//////////////////////////////////////////

	loadContacts = async () => {
		//
		// Retrieve each contact in the selected group.
		const promises = this.group.members.map(async (actorId) => this.loadContact(actorId))
		const contacts = await Promise.all(promises)

		// Return contacs in a Map, not an array
		const result = new Map<string, Contact>()
		for (const contact of contacts) {
			if (contact == undefined) {
				continue
			}
			result.set(contact.id, contact)
		}

		this.contacts = result
		m.redraw()
	}

	loadContact = async (actorId: string) => {
		//
		// Try to get the contact from the database first
		var result = await this.#database.getContact(actorId)

		if (result !== undefined) {
			return result
		}

		// Otherwise, load from the directory
		return await this.#directory.getContact(actorId)
	}

	//////////////////////////////////////////
	// Groups (Encrypted)
	//////////////////////////////////////////

	// createGroup creates a new MLS-encrypted
	// group message with the specified recipients
	createGroup = async (recipients: string[]) => {
		//
		// Guarantee dependency
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		// Create a new group
		var group = await this.#mls.createGroup()

		// Add initial members to the group
		this.group = await this.#mls.addGroupMembers(group, recipients)

		// Save the group to the database
		await this.#database.saveGroup(this.group)

		// Reload groups and messages to refresh the UX
		await this.loadGroups()
	}

	// loadGroups retrieves all groups from the database and
	// updates the "groups" and "messages" streams.
	loadGroups = async () => {
		//
		// load groups from the database
		this.groups = await this.#database.allGroups()

		this.selectGroup(this.selectedGroupId())
	}

	// selectGroup updates the "selectedGroupId" and reloads messages for that group
	selectGroup = (groupId: string) => {
		//

		// If there are no groups, then clear values and exit.
		if (this.groups.length == 0) {
			this.group = NewGroup()
			this.messages = []
			this.contacts = new Map<string, Contact>()
			return
		}

		// Find the group with the specified ID
		const group = this.groups.find((group) => group.id == groupId)

		// If the group can't be found, then clear values
		if (group != undefined) {
			// Update the selected group, and reload related records
			this.group = group
			this.loadMessages()
			this.loadContacts()
			this.page_messages()
			return
		}

		// Fall through means we have at least one group, but
		// the specified groupId wasn't found, so just select the first one.
		this.group = this.groups[0]!
		this.loadMessages()
		this.loadContacts()
		this.page_messages()
	}

	selectedGroupId = () => {
		if (this.group != undefined) {
			return this.group.id
		}

		return ""
	}

	// saveGroup saves the specified group to the database and reloads groups
	saveGroup = async (group: Group) => {
		//

		// RULE: Truncate lastMessage to 100 characters for display purposes
		group.lastMessage = group.lastMessage.slice(0, 100)

		// Save the group to the database
		await this.#database.saveGroup(group)

		// Reload the group to refresh the UX
		await this.loadGroups()
	}

	// deleteGroup deletes the specified group from the database
	deleteGroup = async (group: string) => {
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
	loadMessages = async () => {
		this.messages = await this.#database.allMessages(this.selectedGroupId())
		m.redraw()
	}

	// loadMessage retrieves a single message
	loadMessage = async (messageId: string) => {
		return await this.#database.loadMessage(messageId)
	}

	// sendMessage sends a message to the specified group
	sendMessage = async (content: string) => {
		//
		// Guarantee dependencies
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		if (this.group == undefined) {
			throw new Error("No group selected")
		}

		// Update the group with the message content
		this.group.lastMessage = content
		await this.saveGroup(this.group)

		var activity = new Activity({
			"@context": vocab.ContextActivityStreams,
			id: newId(),
			actor: this.actorId(),
			type: vocab.ActivityTypeCreate,
			to: this.group.members,
			object: {
				id: newId(),
				attributedTo: this.actorId(),
				type: vocab.ObjectTypeNote,
				to: this.group.members,
				context: this.selectedGroupId,
				content: content,
				published: new Date().toISOString(),
			},
		})

		console.log("Created activity:", activity)

		// (asynchronously) Send the activity through the delivery service
		this.#sendActivity(this.group, activity)

		// Create a new Message record for the database
		var message = NewMessage()
		message.group = this.group.id
		message.sender = this.#actor.id()
		message.plaintext = content

		// Save the message to the database, and reload to refresh the UX
		await this.#database.saveMessage(message)
		await this.loadMessages()
	}

	like_message = async (messageId: string) => {

		// Mark the message as "liked" in the database
		const message = await this.#database.likeMessage(this.actorId(), messageId)

		if (message == undefined) {
			console.log("Unable to like message: " + messageId)
			return
		}

		// Load the group that this message belongs to (for addressing info)
		var group = await this.#database.loadGroup(message.group)
		if (group == undefined) {
			console.log("Error: cannot like message with missing group")
			return
		}

		// Send a "like" activity to the actor's outbox
		var activity = new Activity({
			"@context": vocab.ContextActivityStreams,
			id: newId(),
			actor: this.actorId(),
			type: vocab.ActivityTypeLike,
			to: group.members,
			object: message.id,
		})

		// Send the activity to the outbox
		this.#sendActivity(group, activity)

		// Reload messages to refresh the UX
		await this.loadMessages()
	}


	undo_like_message = async (messageId: string) => {

		// Undo Mark the message as "liked" in the database
		const message = await this.#database.undoLikeMessage(this.actorId(), messageId)


		// RULE: If the message doesn't exist, then exit
		if (message == undefined) {
			return
		}

		// Load the group that this message belongs to (for addressing info)
		var group = await this.#database.loadGroup(message.group)
		if (group == undefined) {
			console.log("Error: cannot like message with missing group")
			return
		}

		// Send a "like" activity to the actor's outbox
		var activity = new Activity({
			"@context": vocab.ContextActivityStreams,
			id: newId(),
			actor: this.actorId(),
			type: vocab.ActivityTypeUndo,
			to: group.members,
			object: {
				type: vocab.ActivityTypeLike,
				actor: this.actorId(),
				object: message.id,
			}
		})

		// Send the activity to the outbox
		this.#sendActivity(group, activity)

		// Reload messages to refresh the UX
		await this.loadMessages()
	}

	//////////////////////////////////////////
	// Pages
	//////////////////////////////////////////

	page_groups = () => {
		this.pageView = "GROUPS"
		m.redraw()
	}

	page_messages = () => {
		this.pageView = "MESSAGES"
		m.redraw()
	}

	page_group_settings = () => {
		this.pageView = "GROUP-SETTINGS"
		m.redraw()
	}

	//////////////////////////////////////////
	// Receiving Activities
	//////////////////////////////////////////

	receiveActivity = async (activity: Activity) => {
		//

		console.log("Received activity:", activity.toJSON())

		// Retrieve the object from the activity. This should be embedded,
		// but we can load from the network if needed.
		var object = await activity.object()

		// RULE: Activities must match the object that they contain
		if (activity.actorId() != object.attributedToId()) {
			console.log("Error processing activity:", activity)
			throw new Error("Activity actor must match object actor")
		}

		// Decode MLS-encrypted messages
		if (object.isMLSMessage()) {
			//
			// Guarantee dependency
			if (this.#mls == undefined) {
				throw new Error("MLS service is not initialized")
			}

			// Decode the message embedded in the object.content.
			const decodedActivity = await this.#mls.decodeMessage(object.content())

			// If the activity is null, then there's nothing more to do. Exit.
			if (decodedActivity == null) {
				console.log("Received MLS message that did not require additional processing (probably a mls:Welcome)")
				return
			}

			// RULE: guarantee that the actorIds match the encrypted content
			if (decodedActivity.actorId() != activity.actorId()) {
				throw new Error("Decrypted activity actor must match outer activity actor")
			}


			// Update activity and object to continue processing using the decoded values.
			activity = decodedActivity
			console.log("successfully decoded object:", activity.toJSON())
		}

		switch (activity.type()) {

			case vocab.ActivityTypeCreate:
				await this.#receiveActivity_CreateDocument(activity)
				return

			case vocab.ActivityTypeUpdate:
				await this.#receiveActivity_UpdateDocument(activity)
				return

			case vocab.ActivityTypeDelete:
				await this.#receiveActivity_DeleteDocument(activity)
				return

			case vocab.ActivityTypeLike:
				await this.#receiveActivity_Like(activity)
				return

			case vocab.ActivityTypeUndo:
				await this.#receiveActivity_Undo(activity)

				return

			default:
				console.log("Received unrecognized activity:", activity)
				return
		}
	}

	#receiveActivity_CreateDocument = async (activity: Activity) => {

		// Decode the object embedded in the activity.
		const object = await activity.object()

		if (object.attributedToId() != activity.actorId()) {
			throw new Error("Decrypted activity actor must match object's attributedTo")
		}

		// Create a new message record in the database for this incoming message
		const message = {
			id: activity.id(),
			group: activity.context(),
			sender: activity.actorId(),
			plaintext: object.content(),
			likes: [],
			inReplyTo: object.inReplyToId(),
			createDate: Date.now(),
		}

		// Save the message to the database
		await this.#database.saveMessage(message)
	}

	#receiveActivity_UpdateDocument = async (activity: Activity) => {

		// Decode the object embedded in the activity.
		const object = await activity.object()

		if (object.attributedToId() != activity.actorId()) {
			throw new Error("Decrypted activity actor must match object's attributedTo")
		}

		// Create a new message record in the database for this incoming message
		const message = {
			id: activity.id(),
			group: activity.context(),
			sender: activity.actorId(),
			plaintext: object.content(),
			likes: [],
			inReplyTo: object.inReplyToId(),
			createDate: Date.now(),
		}

		// Save the message to the database
		await this.#database.saveMessage(message)
	}

	#receiveActivity_DeleteDocument = async (activity: Activity) => {

		// Delete the message from the database
		await this.#database.deleteMessage(activity.objectId())

		// Reload messages to refresh the UX
		this.loadMessages()
	}

	#receiveActivity_Like = async (activity: Activity) => {

		// Add a "like" to the message in the database
		const message = await this.#database.likeMessage(activity.actorId(), activity.objectId())
		if (message == undefined) {
			return
		}

		// Reload messages to refresh the UX
		if (message.group == this.selectedGroupId()) {
			this.loadMessages()
		}
	}

	#receiveActivity_Undo = async (activity: Activity) => {

		// The object of an "Undo" activity is the activity being undone. In this case, it should be a "Like" activity.
		const message = await this.#database.undoLikeMessage(activity.actorId(), activity.objectId())
		if (message == undefined) {
			return
		}

		// Reload messages to refresh the UX
		if (message.group == this.selectedGroupId()) {
			this.loadMessages()
		}
	}

	//////////////////////////////////////////
	// Modal Dialogs
	//////////////////////////////////////////

	modal_close = () => {
		this.modalView = ""
	}

	modal_newConversation = () => {
		this.modalView = "NEW-CONVERSATION"
	}


	//////////////////////////////////////////
	// Network Stuff
	//////////////////////////////////////////


	// sendActivity sends an activity to the Actor's outbox
	#sendActivity = async (group: Group, activity: Activity) => {

		// RULE: Guarantee that MLS service is initialized.
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		// If necessary, encrypt the activity using MLS before sending
		if (groupIsEncrypted(group)) {
			activity = await this.#mls.encodeActivity(group, activity)
		}

		return this.#delivery.sendActivity(activity)
	}
}
