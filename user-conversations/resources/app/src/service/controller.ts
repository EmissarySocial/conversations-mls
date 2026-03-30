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
import { type EncryptedGroup, type Group } from "../model/group"
import { NewConfig } from "../model/config"
import { NewGroup } from "../model/group"
import { NewMessage } from "../model/message"
import { groupIsEncrypted } from "../model/group"

// Services
import { type IDelivery } from "./interfaces"
import { type IDirectory } from "./interfaces"
import { type IDatabase } from "./interfaces"
import { type IReceiver } from "./interfaces"

// MLS Services
import { MLSFactory } from "./mls-factory"
import { MLS } from "./mls"

// Other utility functions
import { messageToActivityStream } from "./utils"
import { newId } from "./utils"

export class Controller {

	#actorId: string
	#actor: Actor
	#database: IDatabase
	#delivery: IDelivery
	#directory: IDirectory
	#receiver: IReceiver
	#mls?: MLS
	#allowPlaintextMessages: boolean

	config: Config
	groups: Group[]
	messages: Message[]
	contacts: Map<string, Contact>

	group: Group | EncryptedGroup
	message: Message

	pageView: string
	modalView: string

	// constructor initializes the Controller with its dependencies
	constructor(
		actorId: string,
		database: IDatabase,
		delivery: IDelivery,
		directory: IDirectory,
		receiver: IReceiver,
	) {
		// Dependencies
		this.#actorId = actorId
		this.#actor = new Actor()
		this.#database = database
		this.#delivery = delivery
		this.#directory = directory
		this.#receiver = receiver
		this.#allowPlaintextMessages = false

		// Application State
		this.groups = []
		this.messages = []
		this.contacts = new Map<string, Contact>()
		this.group = NewGroup()
		this.message = NewMessage()

		// UX state
		this.pageView = "LOADING"
		this.modalView = ""

		// Application Configuration
		this.config = NewConfig() // Empty placeholder until loaded
		this.#receiver.registerHandler(this.receiveActivity) // Connect onActivity handler
		this.#start()
		this.loadGroups()
		this.#refreshContacts()
	}

	//////////////////////////////////////////
	// Startup
	//////////////////////////////////////////

	// loadConfig retrieves the configuration from the
	// database and starts the MLS service (if encryption keys are present)
	#start = async () => {

		// Load configuration from the database
		this.config = await this.#database.loadConfig()

		if (!this.config.ready) {
			this.pageView = "WELCOME"
			m.redraw()
			return
		}

		// Load the actor object from the network and locate their messages collection
		this.#actor = await new Actor().fromURL(this.#actorId)
		const { url, plaintext } = this.#actor.messages()

		if (url == "") {
			throw new Error(`Actor does not support MLS API.`)
		}

		// Apply the freshly loaded actor to all of the dependencies
		this.#allowPlaintextMessages = plaintext
		this.#delivery.setActor(this.#actor)
		this.#directory.setActor(this.#actor)
		this.#receiver.setActor(this.#actor)

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

		// Update view once everything is initialized
		this.pageView = "GROUPS"
		m.redraw()
	}

	// startupConfiguration is called when the user submits their options from the initial welcome screen
	startupConfiguration = async (clientName: string, passcode: string, desktopNotifications: boolean, notificationSounds: boolean) => {

		this.config.ready = true
		this.config.clientName = clientName
		this.config.passcode = passcode
		this.config.isDesktopNotifications = desktopNotifications
		this.config.isNotificationSounds = notificationSounds

		await this.#database.saveConfig(this.config)

		// Start the MLS service
		// this.#startMLS()

		await this.#start()
	}

	//////////////////////////////////////////
	// Getters
	//////////////////////////////////////////

	actorId = (): string => {
		return this.#actor.id()
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
		var result = await this.#database.loadContact(actorId)

		if (result !== undefined) {
			return result
		}

		// Otherwise, load from the directory
		return await this.#directory.loadContact(actorId)
	}

	addContacts = async (actorIds: string[]) => {

		// Guarantee dependency
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		if (!groupIsEncrypted(this.group)) {
			throw new Error("Not Implemented")
		}

		// Add initial members to the group
		this.group = await this.#mls.addGroupMembers(this.group, actorIds)

		// Save the group to the database
		await this.#database.saveGroup(this.group)

		// Reload groups and messages to refresh the UX
		await this.loadGroups()
	}

	removeContact = async (actorId: string) => {

		// Guarantee dependency
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		if (!groupIsEncrypted(this.group)) {
			throw new Error("Not Implemented")
		}

		// Remove the member from the group
		this.group = await this.#mls.removeGroupMember(this.group, actorId)

		// Save the group to the database
		await this.#database.saveGroup(this.group)

		// Reload groups and messages to refresh the UX
		await this.loadGroups()
	}

	#refreshContacts = async () => {

		const contacts = await this.#database.allContacts()

		for (const contact of contacts) {

			const updated = await this.#directory.loadContact(contact.id)

			if (updated == undefined) {
				return
			}

			if (updated != contact) {
				await this.#database.saveContact(updated)
			}
		}
	}

	//////////////////////////////////////////
	// Groups
	//////////////////////////////////////////

	// createGroup creates a new group and initial message
	createGroup = async (recipients: string[], initialMessage: string, encrypted: boolean) => {

		// TODO: Make this optional
		encrypted = true

		// Add "me" to the members list
		recipients.push(this.actorId())

		// Create a new Group record
		var group = NewGroup()

		// Extra handling for encrypted groups
		if (encrypted == true) {

			// Guarantee dependency
			if (this.#mls == undefined) {
				throw new Error("MLS service is not initialized")
			}

			// Add MLS clientState
			group = await this.#mls.encodeGroup(group)
		}

		// Save the group to the database
		this.saveGroup(group)

		// Add initial members to the group (this also saves the group)
		this.group = await this.addGroupMembers(group, recipients)

		// Send the initial message
		await this.sendMessage(initialMessage)

		// Move the view to the messages for this group
		this.pageView = "GROUP-MESSAGES"
	}

	// loadGroups retrieves all groups from the database
	loadGroups = async () => {

		// load groups from the database
		this.groups = await this.#database.allGroups()

		// Find/set the selected group
		this.selectGroup(this.selectedGroupId())
	}

	// saveGroup saves the specified group to the database
	saveGroup = async (group: Group) => {

		// RULE: Truncate lastMessage to 100 characters for display purposes
		group.lastMessage = group.lastMessage.slice(0, 100)
		group.contacts = await this.calcGroupContacts(group)

		// Save the group to the database
		await this.#database.saveGroup(group)

		// Reload the group to refresh the UX
		await this.loadGroups()
	}

	saveGroupAndSync = async (group: Group) => {

		console.log("saveGroupAndSync", group)

		// Save the group in the database
		this.saveGroup(group)

		// Send a "Group:Update" activity to my other devices
		var activity = new Activity({
			"to": [this.actorId()],
			"actor": this.actorId(),
			"type": vocab.ActivityTypeUpdate,
			"object": {
				"id": group.id,
				"type": vocab.ObjectTypeEmissaryContext,
				"name": group.name,
				"description": group.description,
				"stateId": group.stateId,
				"tag": group.tags,
			}
		})

		// Send a private message to my other devices
		this.#sendActivity(group, activity)
	}

	// addGroupMember adds a new actorId to the group
	addGroupMembers = async (group: Group, actorIds: string[]) => {

		// RULE: Remove actors that are already in the group
		actorIds = actorIds.filter(actorId => !group.members.includes(actorId))

		// If there are no additional actors to add, then exit early
		if (actorIds.length == 0) {
			return group
		}

		// Add the members to the group
		group.members.push(...actorIds)

		// Special handling for encrypted groups
		if (groupIsEncrypted(group)) {

			if (this.#mls == undefined) {
				throw new Error("MLS service is not initialized")
			}

			group = await this.#mls.addGroupMembers(group, actorIds)
		}

		// Save group  also recalculates Contacts and updates the UX
		await this.saveGroup(group)

		return group
	}

	// leaveGroup leaves/deletes the specified group from the database
	leaveGroup = async (groupId: string) => {

		// Guarantee dependency
		if (this.#database == undefined) {
			throw new Error("Database service is not initialized")
		}

		// Locate the group to leave
		const group = await this.#database.loadGroup(groupId)

		// RULE: If we don't have the group locally, then just exit
		if (group == undefined) {
			return
		}

		// Encrypted groups then we need to send an MLS "leave" message
		if (groupIsEncrypted(group)) {

			if (this.#mls == undefined) {
				throw new Error("MLS service is not initialized")
			}

			// await this.#mls.leaveGroup(group)
		}

		// Delete the group
		await this.#database.deleteGroup(groupId)
		await this.#database.deleteMessagesByGroup(groupId)
		await this.loadGroups()
	}

	// selectGroup updates the "selectedGroupId" and reloads messages for that group
	selectGroup = (groupId: string) => {

		// If there are no groups, then clear values and exit.
		if (this.groups.length == 0) {
			this.group = NewGroup()
			this.messages = []
			this.contacts = new Map<string, Contact>()
			return
		}

		// Find the group with the specified ID
		const group = this.groups.find((group) => group.id == groupId)

		// If the group can't be found, update the selected group and reload related records
		if (group != undefined) {
			this.group = group
			this.loadMessages()
			this.loadContacts()
			this.page_group_messages()
			return
		}

		// Fall through means we have at least one group, but
		// the specified groupId wasn't found, so just select the first one.
		this.group = this.groups[0]!
		this.loadMessages()
		this.loadContacts()
		this.page_group_messages()
	}

	selectedGroupId = () => {
		if (this.group != undefined) {
			return this.group.id
		}

		return ""
	}

	// calcGroupContacts calculates all contacts within a group
	calcGroupContacts = async (group: Group): Promise<Contact[]> => {

		// Look up Contact info for each member in the group
		const contacts = await Promise.all(group.members.map(member => this.#directory.loadContact(member)))

		// Remove null results
		return contacts.filter(contact => contact != undefined)
	}

	// groupName returns an intelligent name for the group based on its member count.
	groupName = (group: Group = this.group) => {

		// If the group has a custom name, then use that.
		if (group.name != "") {
			return group.name
		}

		const contacts = group.members
			.map(actorId => this.contacts.get(actorId))
			.filter(contact => contact != undefined)
			.filter(contact => contact.id != this.actorId())
			.map(contact => contact.name)

		// Fancy default name based on the number of members (excluding "me")
		switch (contacts.length) {

			// This should never happen, but just in case...
			case 0:
				return "Empty Group"

			// For small sets, display all names
			case 1:
			case 2:
			case 3:
			case 4:
				return contacts.join(", ")
		}

		// For larger groups, display the first 3 names + the remaining count
		return contacts
			.slice(0, 3)
			.join(", ") + `, +${contacts.length - 3} others`
	}

	setGroupState(group: Group, stateId: string) {

		switch (stateId) {
			case "IMPORTANT":
			case "ACTIVE":
			case "ARCHIVED":
			case "CLOSED":
				group.stateId = stateId
				break

			default:
		}
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

		if (this.group == undefined) {
			throw new Error("No group selected")
		}

		// Update the group with the message content
		this.group.lastMessage = content
		await this.saveGroup(this.group)

		// Create a new Message record and save to the database
		var message = NewMessage()
		message.groupId = this.group.id
		message.sender = this.#actor.id()
		message.plaintext = content

		await this.#database.saveMessage(message)

		// Create an ActivityPub activity 
		var activity = new Activity({
			context: this.group.id,
			actor: this.actorId(),
			type: vocab.ActivityTypeCreate,
			to: this.group.members,
			object: messageToActivityStream(this.group, message),
		})

		// (asynchronously) Send the activity through the delivery service
		this.#sendActivity(this.group, activity)

		// Reload to refresh the UX
		await this.loadMessages()
	}

	updateMessage = async (message: Message) => {

		// RULE: Only the original sender can update a message
		if (message.sender != this.actorId()) {
			return
		}

		// RULE: Can only update messages in the current group.
		if (message.groupId != this.group.id) {
			return
		}

		// Create an "Update" activity
		const activity = new Activity({
			actor: this.actorId(),
			type: vocab.ActivityTypeUpdate,
			to: this.group.members,
			object: messageToActivityStream(this.group, message),
		})

		// Send the activity
		this.#sendActivity(this.group, activity)

		// Update the message in the database, and reload to refresh the UX
		await this.#database.saveMessage(message)
		await this.loadMessages()
	}

	// clearMessage resets the "message" stream to an empty state for composing new messages
	clearMessage = () => {
		this.message = NewMessage()
	}

	// deleteMessage removes a message (sent by the current actor) from the current group
	deleteMessage = async (messageId: string) => {

		// Load the message from the data store
		const message = await this.loadMessage(messageId)

		// RULE: If the message doesn't exist, then exit
		if (message == undefined) {
			return
		}

		// RULE: Only the sender of a message can delete it.
		if (message.sender != this.actorId()) {
			return
		}

		// RULE: Can only delete messages in the current group.
		if (message.groupId != this.group.id) {
			return
		}

		// Send the "delete" activity to all group members
		const activity = new Activity({
			"@context": vocab.ContextActivityStreams,
			"id": newId(),
			"to": this.group.members,
			"actor": this.actorId(),
			"type": vocab.ActivityTypeDelete,
			"object": message.id,
		})

		this.#sendActivity(this.group, activity)

		// Delete the message
		await this.#database.deleteMessage(messageId)
		await this.loadMessages()
	}

	// likeMessage adds a "like" from the current actor to the specified message
	likeMessage = async (messageId: string) => {

		// Mark the message as "liked" in the database
		const message = await this.#database.likeMessage(this.actorId(), messageId)

		if (message == undefined) {
			return
		}

		// Load the group that this message belongs to (for addressing info)
		var group = await this.#database.loadGroup(message.groupId)
		if (group == undefined) {
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

	// undoLikeMessage removes a "like" from the specified message
	undoLikeMessage = async (messageId: string) => {

		// Undo Mark the message as "liked" in the database
		const message = await this.#database.undoLikeMessage(this.actorId(), messageId)

		// RULE: If the message doesn't exist, then exit
		if (message == undefined) {
			return
		}

		// Load the group that this message belongs to (for addressing info)
		var group = await this.#database.loadGroup(message.groupId)
		if (group == undefined) {
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
				object: messageId,
			}
		})

		// Send the activity to the outbox
		this.#sendActivity(group, activity)

		// Reload messages to refresh the UX
		await this.loadMessages()
	}

	//////////////////////////////////////////
	// Receiving Activities
	//////////////////////////////////////////

	receiveActivity = async (activity: Activity) => {

		try {

			// Retrieve the object from the activity. This should be embedded,
			// but we can load from the network if needed.
			var object = await activity.object()

			// RULE: Activities must match the object that they contain
			if (activity.actorId() != object.attributedToId()) {
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

				// If the activity is null, then the MLS decoder has done all of the work.
				// There's nothing more to do, so exit.
				if (decodedActivity == null) {
					return
				}

				// RULE: guarantee that the actorIds match the encrypted content
				if (decodedActivity.actorId() != activity.actorId()) {
					throw new Error("Decrypted activity actor must match outer activity actor")
				}

				// Update activity and object to continue processing using the decoded values.
				activity = decodedActivity
				object = await activity.object()
			}

			console.log("Received activity:", activity.toObject())

			switch (activity.type()) {

				case vocab.ActivityTypeCreate:

					// All other document types (Note, Article, Document, etc.)
					await this.#receiveActivity_CreateMessage(activity)
					return

				case vocab.ActivityTypeUpdate:

					switch (object.type()) {

						// Group updates are handled differently than message updates, so we need to check the object type to route properly.
						case vocab.ObjectTypeEmissaryContext:
							return await this.#receiveActivity_UpdateContext(activity)

						default:
							return await this.#receiveActivity_UpdateMessage(activity)
					}

				case vocab.ActivityTypeDelete:
					return await this.#receiveActivity_DeleteMessage(activity)

				case vocab.ActivityTypeLike:
					return await this.#receiveActivity_Like(activity)

				case vocab.ActivityTypeUndo:
					return await this.#receiveActivity_Undo(activity)

				default:
					return
			}

		} catch (error) {

			/*
				this.#delivery.sendActivity({
				actor: this.actorId(),
				type: vocab.ActivityTypeReject,
				object: activity.id(),
			})
			*/
		}
	}

	#receiveActivity_CreateMessage = async (activity: Activity) => {

		// Decode the object embedded in the activity.
		const object = await activity.object()

		if (object.attributedToId() != activity.actorId()) {
			throw new Error("Decrypted activity actor must match object's attributedTo")
		}

		// Locate the group assigned to this activity
		const groupId = activity.context()
		const group = await this.#database.loadGroup(groupId)

		if (group == undefined) {
			return
		}

		// Create a new message record in the database for this incoming message
		const message = {
			id: object.id(),
			groupId: groupId,
			sender: object.attributedToId(),
			plaintext: object.content(),
			likes: [],
			history: [],
			inReplyTo: object.inReplyToId(),
			createDate: Date.now(),
			updateDate: Date.now(),
		}

		// Save the message to the database
		await this.#database.saveMessage(message)

		// Send desktop notifications (if requested)
		if (this.config.isDesktopNotifications) {
			if (Notification.permission === "granted") {
				new Notification(message.sender, {
					body: message.plaintext,
				})
			}
		}

		/*/ Play notification sounds (if requested)
		// This won't work until the whole thing is put into a service worker
		if (this.config.isNotificationSounds) {
			if (document.hidden) {
				// notification sound from: https://mixkit.co/free-sound-effects/notification/
				const audio = new Audio("/.templates/user-conversations/resources/notification.wav")
				audio.play()
			}
		}*/

		this.#sendActivity(group, {
			actor: this.actorId(),
			type: vocab.ActivityTypeAccept,
			to: [message.sender],
			object: messageToActivityStream(group, message),
			context: group.id,
		})
	}

	#receiveActivity_UpdateContext = async (activity: Activity) => {

		console.log("receiveActivity_UpdateContext", activity)
		const object = await activity.object()

		var group = await this.#database.loadGroup(object.id())

		if (group == undefined) {
			console.log("Group not found")
			return
		}

		console.log("Group found", group)
		group.name = object.name()
		group.description = object.description()
		group.tags = object.getArray("as", "tag")
		this.setGroupState(group, object.getString("emissary", "stateId"))

		await this.saveGroup(group)
		console.log("Group updated", group)
	}

	#receiveActivity_UpdateMessage = async (activity: Activity) => {

		// Decode the object embedded in the activity.
		const object = await activity.object()

		// RULE: only the original sender can update a message
		if (object.attributedToId() != activity.actorId()) {
			throw new Error("Decrypted activity actor must match object's attributedTo")
		}

		// Load the message from the database
		var message = await this.#database.loadMessage(object.id())

		// RULE: Don't make new messages.  If not found, then ignore.
		if (message == undefined) {
			return
		}

		// RULE: original sender must also match the activity actor
		if (message.sender != activity.actorId()) {
			return
		}

		// temporary hack to ensure that the message hisory has been initialized.
		if (message.history == undefined) {
			message.history = []
		}

		// Update the message content
		message.history.push(message.plaintext)
		message.plaintext = object.content()
		message.updateDate = Date.now()

		// Save the message to the database
		await this.#database.saveMessage(message)
	}

	#receiveActivity_DeleteMessage = async (activity: Activity) => {

		// Find the message referred in the activity
		const message = await this.#database.loadMessage(activity.objectId())

		// RULE: Verify that the message exists before trying to delete it
		if (message == undefined) {
			return
		}

		// RULE: Only the sender of a message can delete it.
		if (message.sender != activity.actorId()) {
			return
		}

		// Delete the message from the database
		await this.#database.deleteMessage(message.id)

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
		if (message.groupId == this.selectedGroupId()) {
			this.loadMessages()
		}
	}

	#receiveActivity_Undo = async (activity: Activity) => {


		const object = await activity.objectAsActivity()

		// RULE: Actors can only "Undo" their own activities.
		if (activity.actorId() != object.actorId()) {
			return
		}

		// RULE: For now, we only support "Undo" of "Like" activities.
		if (object.type() != vocab.ActivityTypeLike) {
			return
		}

		// The object of an "Undo" activity is the activity being undone. In this case, it should be a "Like" activity.
		const message = await this.#database.undoLikeMessage(activity.actorId(), object.objectId())
		if (message == undefined) {
			return
		}

		// Reload messages to refresh the UX
		if (message.groupId == this.selectedGroupId()) {
			this.loadMessages()
		}
	}

	//////////////////////////////////////////
	// Pages
	//////////////////////////////////////////

	page_groups = () => {
		this.pageView = "GROUPS"
		m.redraw()
	}

	page_group_messages = () => {
		this.pageView = "GROUP-MESSAGES"
		m.redraw()
	}

	page_group_members = () => {
		this.pageView = "GROUP-MEMBERS"
		m.redraw()
	}

	page_group_notes = () => {
		this.pageView = "GROUP-NOTES"
		m.redraw()
	}

	page_group_leave = () => {
		this.pageView = "GROUP-LEAVE"
		m.redraw()
	}

	//////////////////////////////////////////
	// Modal Dialogs
	//////////////////////////////////////////

	modal_addContact = () => {
		this.modalView = "ADD-CONTACT"
	}

	modal_close = () => {
		this.modalView = ""
	}

	modal_newConversation = () => {
		this.modalView = "NEW-CONVERSATION"
	}

	modal_editMessage = async (messageId: string) => {

		this.message = await this.loadMessage(messageId)

		if (this.message == undefined) {
			return
		}

		if (this.message.sender != this.actorId()) {
			return
		}

		this.modalView = "EDIT-MESSAGE"
	}

	modal_messageHistory = async (messageId: string) => {

		this.message = await this.loadMessage(messageId)

		if (this.message == undefined) {
			return
		}

		this.modalView = "MESSAGE-HISTORY"
	}

	//////////////////////////////////////////
	// Network Stuff
	//////////////////////////////////////////

	// sendActivity sends an activity to the Actor's outbox
	#sendActivity = async (group: Group, activity: Activity | { [key: string]: any }) => {

		console.log("sendActivity:", activity)

		// RULE: If the activity is not already an Activity object, convert it to one
		if (!(activity instanceof Activity)) {
			activity = new Activity(activity)
		}

		// If this is a plaintext group, then just send the message without any more processing.
		if (!groupIsEncrypted(group)) {
			return this.#delivery.sendActivity(activity)
		}

		// Fallthrough: this is an encrypted group. Require MLS encoding.

		// RULE: Guarantee that MLS service is initialized.
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		// Send the activity MLS service
		console.log("Sending activity via MLS service:", activity)
		return await this.#mls.sendActivity(group, activity)
	}
}
