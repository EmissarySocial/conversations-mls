// old imports
import m from "mithril"

// ActivityPub objects
import { Actor } from "../as/actor"
import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"

// Model objects
import { type Config } from "../model/config"
import { type Contact } from "../model/contact"
import { type EncryptedGroup, type Group } from "../model/group"
import { NewConfig } from "../model/config"
import { NewGroup } from "../model/group"
import { Message, NewMessage } from "../model/message"
import { groupIsEncrypted } from "../model/group"

// Services
import { type IContacts } from "./interfaces"
import { type IDelivery } from "./interfaces"
import { type IDirectory } from "./interfaces"
import { type IDatabase } from "./interfaces"
import { type IReceiver } from "./interfaces"

import { type Emoji, keyPackageEmojiKey } from "./emojikeys"

// MLS Services
import { MLSFactory } from "./mls-factory"
import { MLS } from "./mls"

// Other utility functions
import { generateAESKey } from "./cryptography"
import { messageToActivityStream } from "./utils"
import { newId } from "./utils"
import type { APKeyPackage } from "../model/ap-keypackage"
import type { KeyPackage } from "ts-mls"
import Stream from "mithril/stream"

export class Controller {

	#actorId: string
	#actor: Actor
	#database: IDatabase
	#delivery: IDelivery
	#directory: IDirectory
	#receiver: IReceiver
	#contacts: IContacts
	#mls?: MLS
	#allowPlaintextMessages: boolean
	#encryptionKey?: CryptoKey
	emojiKey: Emoji[] = []

	config: Config
	groups: Group[]
	messages: Message[]

	groupStream: Stream<Group | EncryptedGroup>
	groupNameStream: Stream<string>
	groupMemberStream: Stream<string[]>
	groupContactStream: Stream<Stream<Contact>[]>

	message: Message
	inReplyTo: Message | undefined

	pageView: string = "LOADING"
	modalView: string = ""
	isWindowFocused: boolean = true
	isApplicationRunning: boolean = true
	stopReason: string = ""

	// constructor initializes the Controller with its dependencies
	constructor(
		actorId: string,
		contacts: IContacts,
		database: IDatabase,
		delivery: IDelivery,
		directory: IDirectory,
		receiver: IReceiver,
	) {
		// Dependencies
		this.#actorId = actorId
		this.#actor = new Actor()
		this.#contacts = contacts
		this.#database = database
		this.#delivery = delivery
		this.#directory = directory
		this.#receiver = receiver
		this.#allowPlaintextMessages = false

		// Application State
		this.groups = []
		this.messages = []
		this.message = new Message()
		this.inReplyTo = undefined

		// Reactive Streams
		this.groupStream = Stream(NewGroup())
		this.groupMemberStream = this.groupStream.map(group => group.members)
		this.groupContactStream = this.groupMemberStream.map((members) => members.map(id => this.#contacts.loadContact(id)))
		this.groupNameStream = Stream.combine(calcGroupName, [this.groupStream, this.groupContactStream])

		// Application Configuration
		this.config = NewConfig() // Empty placeholder until loaded
		this.#start()
	}

	//////////////////////////////////////////
	// Startup
	//////////////////////////////////////////

	// loadConfig retrieves the configuration from the
	// database and starts the MLS service (if encryption keys are present)
	#start = async () => {

		// Load configuration from the database
		this.config = await this.#database.loadConfig()

		// If the app has not been configured yet, then display the "WELCOME"
		// page first, before initializing anything else.
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
		try {
			this.#mls = await MLSFactory(
				this.#database,
				this.#delivery,
				this.#directory,
				this.#actor,
				this.config.generatorId,
				this.config.generatorName,
			)
		} catch (error) {
			console.error("Failed to initialize MLS service", error)
			this.stop("SERVER_DOWN")
			return
		}

		// Calculate EmojiKey
		this.emojiKey = await keyPackageEmojiKey(this.#mls.publicKeyPackage)

		// Start the realtime message receiver
		this.#receiver.start(this.config.generatorId, this.receiveActivity, this.lastMessage)

		// Wire UX redraws into database updates
		this.#database.onchange(async () => {
			await this.loadGroups()
			await this.loadMessages()
		})

		// Listen for application state changes
		cookieStore.addEventListener("change", async () => {
			this.stop("COOKIES_CHANGED")
		})

		window.addEventListener("focus", async () => {
			this.#focusWindow()
		})

		window.addEventListener("blur", async () => {
			this.#blurWindow()
		})

		// Refresh Data for the UX
		this.loadGroups()

		// Update view once everything is initialized
		this.pageView = "GROUPS"
		m.redraw()
	}

	// startupConfiguration is called when the user submits their options from the initial welcome screen
	startupConfiguration = async (clientName: string, passcode: string, isEncryptedMessages: boolean, isDesktopNotifications: boolean, isHideOnBlur: boolean) => {

		// Create encryption key for database encryption
		this.#encryptionKey = await generateAESKey()

		// Set up the initial configuration
		this.config.ready = true
		this.config.generatorName = clientName
		this.config.isEncryptedMessages = isEncryptedMessages
		this.config.isDesktopNotifications = isDesktopNotifications
		this.config.isHideOnBlur = isHideOnBlur

		await this.#database.saveConfig(this.config)

		// Call start again.  Since we've set config.ready to true, this will skip the welcome screen and initialize the app.
		await this.#start()
	}

	// saveConfiguration is called when the user submits their options from the initial welcome screen
	saveConfiguration = async (clientName: string, passcode: string, isEncryptedMessages: boolean, isDesktopNotifications: boolean, isHideOnBlur: boolean) => {

		this.config.ready = true
		this.config.generatorName = clientName
		this.config.isEncryptedMessages = isEncryptedMessages
		this.config.isDesktopNotifications = isDesktopNotifications
		this.config.isHideOnBlur = isHideOnBlur

		await this.#database.saveConfig(this.config)
	}

	// stop halts all services and listeners and clears local memory. It is like
	// a "log out" feature, but does not remove encrypted data from the device.
	stop = (message: string) => {
		this.#database.stop()
		this.#delivery.stop()
		this.#receiver.stop()
		this.#directory.stop()

		this.isApplicationRunning = false
		this.stopReason = message
		m.redraw()
	}

	// eraseDevice removes all locally stored data and reloads the application.
	eraseDevice = async () => {

		if (!confirm("Encrypted messages on this device will be lost forever. Are you sure you want to erase this device?")) {
			return
		}

		// Remove the KeyPackage from the server
		const keyPackage = await this.#database.loadKeyPackage()
		if (keyPackage != undefined) {
			await this.#directory.deleteKeyPackage(keyPackage.keyPackageURL)
		}

		// Erase all local data
		this.#database.erase()

		// Reload the application
		window.document.location.reload()
	}

	//////////////////////////////////////////
	// Getters
	//////////////////////////////////////////

	actorId = (): string => {
		return this.#actor.id()
	}

	actorIcon = (): string => {
		return this.#actor.icon()
	}

	lastMessage = async (messageId?: string): Promise<string> => {

		// If a new messageId has been provided, then update the configuration
		if (messageId != undefined) {
			this.config.lastMessageId = messageId
			await this.#database.saveConfig(this.config)
		}

		// Return the current value of lastMessageId
		return this.config.lastMessageId
	}

	//////////////////////////////////////////
	// KeyPackages
	//////////////////////////////////////////

	loadKeyPackages = async (actorId: string): Promise<KeyPackage[]> => {
		return this.#directory.getKeyPackages([actorId])
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
			this.groupStream(group)
		}

		// Add new recipients to the list of group members (and save)
		await this.addGroupMembers(recipients)

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
		await this.selectGroup(this.selectedGroupId())
	}

	saveGroupAndSync = async (group: Group) => {

		console.log("saveGroupAndSync", group)

		// Save the group in the database
		await this.saveGroup(group)

		// Synchronize with the server
		this.syncGroup(group)
	}

	// saveGroup saves the specified group to the database
	saveGroup = async (group: Group) => {

		// RULE: Truncate lastMessage to 100 characters for display purposes
		group.lastMessage = group.lastMessage.slice(0, 100)

		// Save the group to the database
		await this.#database.saveGroup(group)

		// Reload the group to refresh the UX
		await this.loadGroups()
	}

	syncGroup = async (group: Group) => {

		console.log("syncGroup", group)

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
				"unread": group.unread,
			}
		})

		// Asynchronously send a private message to my other devices
		this.#sendActivity(group, activity)
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
	selectGroup = async (groupId: string) => {

		// If there are no groups, then clear values and exit.
		if (this.groups.length == 0) {
			this.groupStream(NewGroup())
			this.messages = []
			return
		}

		// Find the group with the specified ID
		var group = this.groups.find((group) => group.id == groupId)

		// If the group can't be found, then just use the first group in the list
		if (group == undefined) {
			group = this.groups[0]!
		}

		// Set the current group stream
		this.groupStream(group)

		// Remove "unread" marker, if it exists
		if (group.unread) {
			group.unread = false
			await this.saveGroup(group) // Run this HTTP call asynchronously
			this.syncGroup(group) // Run this HTTP call asynchronously
		}

		this.groupStream(group)
		await this.loadMessages()

		this.page_group_messages()
	}

	selectedGroupId = () => {
		return this.groupStream().id
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
	// Group Members
	//////////////////////////////////////////

	// addGroupMember adds a new actorId to the currently selected group
	addGroupMembers = async (actorIds: string[]) => {

		// Read the current value of the "selected group"
		var group = this.groupStream()

		// RULE: Remove actors who are already in the group
		actorIds = actorIds.filter(actorId => !group.members.includes(actorId))

		// If there are no additional actors to add, then exit early
		if (actorIds.length == 0) {
			return group
		}

		// Simple path if this is an unencrypted group group
		if (groupIsEncrypted(group)) {
			if (this.#mls == undefined) {
				throw new Error("MLS service is not initialized")
			}

			// Use MLS to add the members to the group
			group = await this.#mls.addGroupMembers(group, actorIds)

		} else {
			// Otherwise, just add the actors to the list of group members
			group.members.push(...actorIds)
		}

		// Update the "selected group" stream
		this.groupStream(group)

		// Save the group to the database
		await this.saveGroup(group)

		// Return the updated group
		return group
	}

	removeContact = async (actorId: string) => {

		// Guarantee dependency
		if (this.#mls == undefined) {
			throw new Error("MLS service is not initialized")
		}

		var group = this.groupStream()

		if (!groupIsEncrypted(group)) {
			throw new Error("Not Implemented")
		}

		// Remove the member from the group
		group = await this.#mls.removeGroupMember(group, actorId)

		// Apply the updated group to the "current group" stream
		this.groupStream(group)

		// Save the group to the database
		await this.#database.saveGroup(group)

		// Reload groups and messages to refresh the UX
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

	startReply = (message: Message) => {
		this.inReplyTo = message
		m.redraw()
	}

	removeReply = () => {
		this.inReplyTo = undefined
		m.redraw()
	}

	// sendMessage sends a message to the specified group
	sendMessage = async (content: string) => {

		// Get the currently selected group
		var group = this.groupStream()

		if (group.id == "") {
			throw new Error("No group selected")
		}

		// Create a new Message record and save to the database
		var message = NewMessage()
		message.groupId = group.id
		message.sender = this.#actor.id()
		message.content = content
		message.type = "SENT"

		if (this.inReplyTo != undefined) {
			message.inReplyTo = this.inReplyTo.id
			this.removeReply()
		}

		// Save message and reload to refresh the UX
		await this.#database.saveMessage(message)
		await this.loadMessages()

		// Update the group with the message content
		group.lastMessage = content
		await this.saveGroup(group)

		// Create an ActivityPub activity 
		var activity = new Activity({
			context: group.id,
			actor: this.actorId(),
			type: vocab.ActivityTypeCreate,
			to: group.members,
			object: messageToActivityStream(group, message),
		})

		// (asynchronously) Send the activity through the delivery service
		this.#sendActivity(group, activity)
	}

	updateMessage = async (message: Message) => {

		var group = this.groupStream()

		// RULE: Only the original sender can update a message
		if (message.sender != this.actorId()) {
			return
		}

		// RULE: Can only update messages in the current group.
		if (message.groupId != group.id) {
			return
		}

		// Create an "Update" activity
		const activity = new Activity({
			actor: this.actorId(),
			type: vocab.ActivityTypeUpdate,
			to: group.members,
			object: messageToActivityStream(group, message),
		})

		// Send the activity
		this.#sendActivity(group, activity)

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


		if (!confirm("Are you sure you want to delete this message? This action cannot be undone.")) {
			return
		}

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

		// Get the currently selected group
		var group = this.groupStream()

		// RULE: Can only delete messages in the current group.
		if (message.groupId != group.id) {
			return
		}

		// Send the "delete" activity to all group members
		const activity = new Activity({
			"@context": vocab.ContextActivityStreams,
			"id": newId(),
			"to": group.members,
			"actor": this.actorId(),
			"type": vocab.ActivityTypeDelete,
			"object": message.id,
		})

		this.#sendActivity(group, activity)

		// Delete the message
		await this.#database.deleteMessage(messageId)
		await this.loadMessages()
	}

	// reactToMessage adds a "reaction" from the current actor to the specified message
	reactToMessage = async (messageId: string, content: string = "❤️") => {

		// Load the message from the database
		const group = this.groupStream()
		const message = await this.loadMessage(messageId)

		if (message == undefined) {
			console.error("Message not found:", messageId)
			return
		}

		if (message.groupId != group.id) {
			console.error("Cannot react to message in a different group")
			return
		}

		// Add the reaction and save to the database
		message.setReaction(this.actorId(), content)
		await this.#database.saveMessage(message)

		// Reload messages to refresh the UX
		this.loadMessages()

		// Send a "like" activity to the actor's outbox
		var activity = new Activity({
			"@context": vocab.ContextActivityStreams,
			id: newId(),
			actor: this.actorId(),
			type: vocab.ActivityTypeLike,
			content: content,
			to: group.members,
			object: message.id,
		})

		// Send the activity to the outbox
		this.#sendActivity(group, activity)
	}

	// undoReaction removes a "reaction" from the specified message
	undoReaction = async (messageId: string) => {

		// Undo Mark the message as "liked" in the database
		const message = await this.loadMessage(messageId)
		const group = this.groupStream()

		// RULE: If the message doesn't exist, then exit
		if (message == undefined) {
			return
		}

		// RULE: Message must match the current group
		if (message.groupId != group.id) {
			console.error("Cannot undo reaction to message in a different group")
			return
		}

		// Try to remove the reaction. If no change required, then exit.
		if (!message.removeReaction(this.actorId())) {
			return
		}

		// Save the changes to the database
		await this.#database.saveMessage(message)

		// (async ok) Reload messages to refresh the UX
		this.loadMessages()

		// (async ok) Send an "undo" activity to the actor's outbox
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

		// (asynchronously) send the activity to the outbox
		this.#sendActivity(group, activity)
	}

	//////////////////////////////////////////
	// Receiving Activities
	//////////////////////////////////////////

	receiveActivity = async (activity: Activity) => {

		// Part 1: Parse and possibly decode the received activity
		try {
			// Retrieve the object from the activity. This should be embedded,
			// but we can load from the network if needed.
			var object = await activity.object()

			// RULE: Activities must match the object that they contain
			if (activity.actorId() != object.attributedToId()) {
				console.log("Activity actor must match object actor")
				return
			}

			console.log("Received activity:", activity.toObject())

			// Decode MLS-encrypted messages
			if (object.isMLSMessage()) {

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
					console.error("Decrypted activity actor must match outer activity actor")
					return
				}

				// Update activity and object to continue processing using the decoded values.
				activity = decodedActivity
				object = await activity.object()

				console.log("Decoded activity:", activity.toObject())
			}

		} catch (error) {
			console.error("Unable to decode MLS message:", error)
			return
		}

		// Part 2: Route the activity based on its type, and apply changes to the local database and UX as needed.
		try {

			switch (activity.type()) {

				case vocab.ActivityTypeAcknowledge:
					return await this.#receiveActivity_Acknowledge(activity)

				case vocab.ActivityTypeCreate:
					return await this.#receiveActivity_CreateMessage(activity)

				case vocab.ActivityTypeDelete:
					return await this.#receiveActivity_DeleteMessage(activity)

				case vocab.ActivityTypeFailure:
					return await this.#receiveActivity_Failure(activity)

				case vocab.ActivityTypeLike:
					return await this.#receiveActivity_Like(activity)

				case vocab.ActivityTypeUndo:
					return await this.#receiveActivity_Undo(activity)

				case vocab.ActivityTypeUpdate:

					switch (object.type()) {

						// Group updates are handled differently than message updates, so we need to check the object type to route properly.
						case vocab.ObjectTypeEmissaryContext:
							return await this.#receiveActivity_UpdateContext(activity)

						default:
							return await this.#receiveActivity_UpdateMessage(activity)
					}

				default:
					return
			}

		} catch (error) {

			console.error("Error receiving activity:", error)
			/*
			this.#delivery.sendActivity({
				actor: this.actorId(),
				type: vocab.ActivityTypeFailure,
				object: activity.id(),
			})
			*/
		}
	}

	#receiveActivity_Acknowledge = async (activity: Activity) => {

		// Find the message referred in the activity
		const message = await this.#database.loadMessage(activity.objectId())

		// RULE: Verify that the message exists before trying to delete it
		if (message == undefined) {
			return
		}

		// If we have not already received an acknowledgement from this actor, then add it to the "received" list for this message
		if (!message.received.includes(activity.actorId())) {
			message.received.push(activity.actorId())
			await this.#database.saveMessage(message)
			this.loadMessages()
		}
	}

	#receiveActivity_CreateMessage = async (activity: Activity) => {

		// Decode the object embedded in the activity.
		const object = await activity.object()

		// RULE: The message must be attributed to the actor who sent the activity
		if (object.attributedToId() != activity.actorId()) {
			throw new Error("Decrypted activity actor must match object's attributedTo")
		}

		// Locate the group assigned to this activity
		const groupId = activity.context()
		var group = await this.#database.loadGroup(groupId)

		if (group == undefined) {
			throw new Error("Group not found for incoming message")
		}

		// Create a new message record in the database for this incoming message
		const sentByMe = (object.attributedToId() == this.actorId())
		const message = NewMessage({
			id: object.id(),
			groupId: groupId,
			type: (sentByMe ? "SENT" : "RECEIVED"),
			sender: object.attributedToId(),
			content: object.content(),
			reactions: {},
			history: [],
			received: [],
			inReplyTo: object.inReplyToId(),
			createDate: Date.now(),
			updateDate: Date.now(),
		})

		console.log("Received new message:", message)

		// Save the message to the database
		await this.#database.saveMessage(message)

		// Mark the group with the lastMessage content
		group.lastMessage = object.content()

		// Mark the group as "unread"
		if (!sentByMe) {
			if (groupId != this.selectedGroupId()) {
				group.unread = true
			}
		}

		// Update the group
		await this.saveGroup(group)

		// Send acknowledgement to the sender
		this.#sendActivity(group, {
			actor: this.actorId(),
			type: vocab.ActivityTypeAcknowledge,
			to: [message.sender],
			object: message.id,
			context: group.id,
		})

		// Send desktop notifications (if requested)
		if (this.config.isDesktopNotifications) {
			if (Notification.permission === "granted") {
				if (!sentByMe) {
					if (this.isWindowFocused == false) {
						new Notification(message.sender, {
							body: message.content,
						})
					}
				}
			}
		}
	}

	#receiveActivity_Failure = async (activity: Activity) => {
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
		await this.loadMessages()
	}

	#receiveActivity_Like = async (activity: Activity) => {

		const message = await this.#database.loadMessage(activity.objectId())

		// RULE: Verify that the message exists before trying to add a reaction
		if (message == undefined) {
			console.error("#receiveActivity_Like: Message not found:", activity.objectId())
			return
		}

		// Apply the reaction as a "like" (with optional content)
		const content = activity.content() || "❤️"
		message.setReaction(activity.actorId(), content)

		// Save the message to the database
		await this.#database.saveMessage(message)

		// Reload messages to refresh the UX
		if (message.groupId == this.selectedGroupId()) {
			this.loadMessages()
		}
	}

	#receiveActivity_Undo = async (activity: Activity) => {

		const originalLike = await activity.objectAsActivity()

		// RULE: Actors can only "Undo" their own activities.
		if (activity.actorId() != originalLike.actorId()) {
			return
		}

		// RULE: For now, we only support "Undo" of "Like" activities.
		if (originalLike.type() != vocab.ActivityTypeLike) {
			return
		}

		// The object of an "Undo" activity is the activity being undone. In this case, it should be a "Like" activity.
		var message = await this.#database.loadMessage(originalLike.objectId())
		if (message == undefined) {
			return
		}

		// Remove the reaction, then (asynchronously) save the message to the database
		message.removeReaction(activity.actorId())
		this.#database.saveMessage(message)

		// (If this we're looking at this group right now, then Reload messages to refresh the UX
		if (message.groupId == this.selectedGroupId()) {
			this.loadMessages()
		}
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
		group.unread = object.getBoolean("emissary", "unread")
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
		message.history.push(message.content)
		message.content = object.content()
		message.updateDate = Date.now()

		// Save the message to the database
		await this.#database.saveMessage(message)
	}


	//////////////////////////////////////////
	// Pages
	//////////////////////////////////////////

	page_index = () => {
		this.pageView = "INDEX"
		m.redraw()
	}

	page_settings = () => {
		this.pageView = "SETTINGS"
		m.redraw()
	}

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

		const message = await this.loadMessage(messageId)

		if (message == undefined) {
			console.error("Message not found")
			return
		}

		if (message.sender != this.actorId()) {
			console.error("Only the sender can edit this message")
			return
		}

		this.message = message
		this.modalView = "EDIT-MESSAGE"
		m.redraw()
	}

	modal_messageHistory = async (messageId: string) => {

		const message = await this.loadMessage(messageId)

		if (message == undefined) {
			return
		}

		this.message = message
		this.modalView = "MESSAGE-HISTORY"
	}

	//////////////////////////////////////////
	// Window Focus/Blur
	//////////////////////////////////////////

	#focusWindow = () => {
		this.isWindowFocused = true
		m.redraw()
	}

	#blurWindow = () => {
		this.isWindowFocused = false
		m.redraw()
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
		console.log("Sending activity via MLS service:", activity.toObject())
		return await this.#mls.sendActivity(group, activity)
	}
}

/******************************************
 * Helper Functions
 ******************************************/

// calcGroupName is a mithril.Stream combiner that returns an intelligent name for the group based on its 
// internal state and member list.
function calcGroupName(group: Stream<Group>, contacts: Stream<Stream<Contact>[]>): string {

	// If the group has a name, then just use that.
	const groupName = group().name
	if (groupName != "") {
		return groupName
	}

	const contactNames = contacts().map(stream => stream().name).filter(name => name != "")

	// Fancy default name based on the number of members (excluding "me")
	switch (contactNames.length) {

		// This should never happen, but just in case...
		case 0:
			return "Empty Group"

		// For small sets, display all names
		case 1:
		case 2:
		case 3:
		case 4:
			return contactNames.join(", ")
	}

	// For larger groups, display the first 3 names + the remaining count
	return contactNames
		.slice(0, 3)
		.join(", ") + `, +${contactNames.length - 3} others`
}