// Mithril
import m from "mithril"
import Stream from "mithril/stream"

// ts-mls
import type { KeyPackage } from "ts-mls"

// ActivityPub objects
import { Actor } from "../as/actor"
import { Activity } from "../as/activity"
import { Document } from "../as/document"
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
import { type IContacts, type IHost } from "./interfaces"
import { type IDelivery } from "./interfaces"
import { type IDirectory } from "./interfaces"
import { type IDatabase } from "./interfaces"
import { type IReceiver } from "./interfaces"
import { type EmojiKey, keyPackageEmojiKey } from "./emojikeys"
import { MLS } from "./mls"

// Other utility functions
import { cipherSuiteImplementation, decodeKeyFromBase64, deriveKeyFromPassword, encodeKeyToBase64, generateAESKey, newKeyPackage, unwrapKey, wrapKey } from "./cryptography"
import { messageToActivityStream } from "./utils"
import { newId } from "./utils"
import type { Emoji } from "../model/emoji"
import type { DBKeyPackage } from "../model/db-keypackage"

export class Controller {

	#actorId: string
	#actor: Actor
	#database: IDatabase
	#delivery: IDelivery
	#directory: IDirectory
	#receiver: IReceiver
	#contacts: IContacts
	#host: IHost
	#mls?: MLS
	#allowPlaintextMessages: boolean
	#allowCiphertextMessages: boolean
	#encryptionKey?: CryptoKey
	emojiKey: EmojiKey[] = []

	config: Config
	groups: Group[]
	messages: Message[]

	groupStream: Stream<Group | EncryptedGroup>
	groupMemberStream: Stream<string[]>
	groupContactStream: Stream<Stream<Contact>[]>

	message: Message | undefined
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
		host: IHost,
	) {
		// Dependencies
		this.#actorId = actorId
		this.#actor = new Actor()
		this.#contacts = contacts
		this.#database = database
		this.#delivery = delivery
		this.#directory = directory
		this.#receiver = receiver
		this.#host = host
		this.#allowPlaintextMessages = false
		this.#allowCiphertextMessages = false

		// Application State
		this.groups = []
		this.messages = []
		this.message = undefined
		this.inReplyTo = undefined

		// Reactive Streams
		this.groupStream = Stream(NewGroup())
		this.groupMemberStream = this.groupStream.map(group => group.members)
		this.groupContactStream = this.groupMemberStream.map((members) => members.map(id => this.#contacts.getContactStream(id)))

		// Application Configuration
		this.config = NewConfig() // Empty placeholder until loaded

		// window.setTimeout(() => this.#start(), 1000) // Start the app after a short delay (for testing)
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

		// Try to load the encryption key from sessionStorage (in case of page reload)
		if (this.#encryptionKey == undefined) {

			const sessionKey = window.sessionStorage.getItem("key")
			if (sessionKey) {
				this.#encryptionKey = await decodeKeyFromBase64(sessionKey)
			}
		}

		// The user must sign in (and extract their encryption key) to continue
		if (this.#encryptionKey == undefined) {
			this.pageView = "SIGN-IN"
			m.redraw()
			return
		}

		// Try to load the Actor and locate their messages collection
		try {
			this.#actor = await new Actor().fromURL(this.#actorId)

		} catch (error) {
			console.error("Unable to load the Actor record", error)
			this.stop("SERVER-DOWN")
			return
		}

		// Collect the messages API information
		const { url, plaintext, ciphertext } = this.#actor.messages()

		if (url == "") {
			console.error("Actor does not support messages APIs")
			this.stop("UNSUPPORTED")
			return
		}

		// Apply the freshly loaded actor to all of the dependencies
		this.#allowPlaintextMessages = plaintext
		this.#allowCiphertextMessages = ciphertext

		// Wire additional data into each dependency
		this.#receiver.setActor(this.#actor)
		this.#delivery.setActor(this.#actor)
		this.#directory.setActor(this.#actor)
		this.#directory.setGenerator(this.config.generatorId, this.config.generatorName)

		// Initialize MLS (if supported by the server)
		if (this.#allowCiphertextMessages) {

			try {

				// Load async dependencies: ciphersuite and keyPackage
				const cipherSuite = await cipherSuiteImplementation()
				const keyPackage = await this.loadOrCreateKeyPackage()

				// Create the MLS encoder service
				this.#mls = new MLS(
					this,
					this.#database,
					this.#delivery,
					this.#directory,
					cipherSuite,
					keyPackage.id,
					keyPackage.publicKeyPackage,
					keyPackage.privateKeyPackage,
					this.#actor,
					this.config.generatorId,
				)

				// Calculate EmojiKey
				this.emojiKey = await keyPackageEmojiKey(keyPackage.publicKeyPackage)

			} catch (error) {
				console.error("Unable to initialize MLS service", error)
				this.stop("SERVER-DOWN")
				return
			}
		}

		// Start the realtime message receiver
		this.#receiver.start(this.config.generatorId, this.receiveActivity, this.lastMessage)

		// Wire UX redraws into database updates
		this.#database.onchange(async () => {
			await this.loadGroups()
			await this.loadMessages()
		})

		// Refresh Data for the UX
		this.loadGroups()

		// Update view once everything is initialized
		this.pageView = "GROUPS"
		m.redraw()
	}

	// startupConfiguration is called when the user submits their options from the initial welcome screen
	startupConfiguration = async (clientName: string, passcode: string, isEncryptedMessages: boolean, isDesktopNotifications: boolean, isHideOnBlur: boolean) => {

		// Set up the initial configuration
		this.config.ready = true
		this.config.generatorName = clientName
		this.config.isEncryptedMessages = isEncryptedMessages
		this.config.isDesktopNotifications = isDesktopNotifications
		this.config.isHideOnBlur = isHideOnBlur

		// Create encryption key for database encryption
		const encryptionKey = await generateAESKey()

		this.config.encryptionKeyIV = crypto.getRandomValues(new Uint8Array(16))
		this.config.encryptionKeySalt = crypto.getRandomValues(new Uint8Array(16))

		const wrappingKey = await deriveKeyFromPassword(passcode, this.config.encryptionKeySalt.buffer as ArrayBuffer)
		const wrappedKey = await wrapKey(encryptionKey, wrappingKey, this.config.encryptionKeyIV.buffer as ArrayBuffer)
		this.config.encryptionKey = wrappedKey

		// Save the new configuration to the database
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

	// signIn uses the provided passcode to extract the encryption key from the configuration value.
	signIn = async (passcode: string): Promise<boolean> => {

		try {

			// Derive the wrapping key from the passcode and salt
			const wrappingKey = await deriveKeyFromPassword(passcode, this.config.encryptionKeySalt.buffer as ArrayBuffer)

			// Unwrap the encryption key using the wrapping key and initial value
			this.#encryptionKey = await unwrapKey(this.config.encryptionKey, wrappingKey, this.config.encryptionKeyIV.buffer as ArrayBuffer)

			// Save the key in the session
			window.sessionStorage.setItem("key", await encodeKeyToBase64(this.#encryptionKey))

			// If you've made it this far, then the passcode is valid and you can proceed with the app
			await this.#start()
			return true

		} catch (error) {
			// Errors mean that we  do not have the correct passcode.
			console.error("Failed to sign in:", error)
			return false
		}
	}

	//////////////////////////////////////////
	// Other Lifecycle Methods
	//////////////////////////////////////////

	// stop halts all services and listeners and clears local memory. It is like
	// a "log out" feature, but does not remove encrypted data from the device.
	stop = (message: string) => {
		this.#database.stop()
		this.#delivery.stop()
		this.#receiver.stop()
		this.#directory.stop()

		window.sessionStorage.removeItem("key")

		this.isApplicationRunning = false
		this.stopReason = message
		m.redraw()
	}

	// eraseDevice removes all locally stored data and reloads the application.
	eraseDevice = async () => {

		// Remove the KeyPackage from the server
		const keyPackage = await this.#database.loadKeyPackage()
		if (keyPackage != undefined) {
			await this.#directory.deleteKeyPackage(keyPackage.keyPackageURL)
		}

		// Erase the session key from sessionStorage
		window.sessionStorage.removeItem("key")

		// Erase all local data
		this.#database.erase()

		// Reload the application
		window.document.location.reload()
	}


	//////////////////////////////////////////
	// Window Focus/Blur
	//////////////////////////////////////////

	onFocusWindow = () => {
		this.isWindowFocused = true
		if (this.config.isHideOnBlur) {
			m.redraw()
		}
	}

	onBlurWindow = () => {
		this.isWindowFocused = false
		if (this.config.isHideOnBlur) {
			m.redraw()
		}
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

	page_signout = () => {
		this.stop("SIGN-OUT")
	}

	//////////////////////////////////////////
	// Modal Dialogs
	//////////////////////////////////////////

	modal_addGroupMember = () => {
		this.modalView = "ADD-GROUP-MEMBER"
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

	modal_sendEmoji = async () => {
		this.modalView = "MESSAGE-SEND-EMOJI"
	}

	modal_sendEmoji_callback = async (emoji: Emoji) => {

		this.modalView = ""
		const group = this.groupStream()

		if (group.stateId == "CLOSED") {
			console.error("Cannot send emoji post to a CLOSED group.")
			return
		}

		this.sendMessage(emoji.emoji)
	}

	modal_startReaction = async (message: Message) => {
		this.message = message
		this.modalView = "MESSAGE-START-REACTION"
	}

	modal_startReaction_callback = async (emoji: Emoji) => {

		// Close the modal dialog
		this.modalView = ""

		// "current message" must be defined
		if (this.message == undefined) {
			console.error("No message selected for reaction")
			return
		}

		// Deselect the "current message"
		const messageId = this.message.id
		this.message = undefined

		// Create the reaction
		await this.reactToMessage(messageId, emoji.emoji)

		// Redraw the UX
		m.redraw()
	}

	//////////////////////////////////////////
	// Host Connectors
	//////////////////////////////////////////

	host_actor = (actorId: string) => {
		this.#host.viewActor(actorId)
	}

	host_keyPackages = () => {
		this.#host.viewKeyPackages()
	}

	//////////////////////////////////////////
	// Property Getters
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

	// createOrUpdateKeyPackage creates a new KeyPackage and POSTs it 
	// to the server to replaces the current one. If there is no 
	// existing KeyPackage, then the new one is created
	createOrUpdateKeyPackage = async (): Promise<DBKeyPackage> => {

		var activityId: string
		var keyPackageId: string

		// Generate initial key package for this user
		const keyPackageResult = await newKeyPackage(this.#actor.id())

		// Try to find an existing KeyPackage record
		const keyPackage = await this.#database.loadKeyPackage()

		// If we don't already have a KeyPackage, then create a new one
		if (keyPackage == undefined) {
			[activityId, keyPackageId] = await this.#directory.createKeyPackage(keyPackageResult.publicPackage)
			await this.lastMessage(activityId)

		} else {

			// Otherwise, update the existing KeyPackage
			keyPackageId = keyPackage.keyPackageURL
			await this.#directory.updateKeyPackage(keyPackageId, keyPackageResult.publicPackage)
		}

		// Recalculate the EmojiKey for this KeyPackage
		this.emojiKey = await keyPackageEmojiKey(keyPackageResult.publicPackage)

		// Save the KeyPackage to the local database and return
		return await this.#database.saveKeyPackage(keyPackageId, keyPackageResult.publicPackage, keyPackageResult.privatePackage)
	}

	// loadOrCreateKeyPackage tries to load the KeyPackage for the 
	// current Actor. If none exists, then a new one is created and returned
	loadOrCreateKeyPackage = async (): Promise<DBKeyPackage> => {

		// Try to load the KeyPackage from the IndexedDB database
		const dbKeyPackage = await this.#database.loadKeyPackage()

		// If it already exists, then use that
		if (dbKeyPackage != undefined) {
			return dbKeyPackage
		}

		// Otherwise, we don't already have a KeyPackage for this device 
		return await this.createOrUpdateKeyPackage()
	}

	// loadActorKeyPackages loads the KeyPackages for the specified actor
	loadActorKeyPackages = async (actorId: string): Promise<KeyPackage[]> => {
		return this.#directory.getKeyPackages([actorId])
	}


	//////////////////////////////////////////
	// Groups
	//////////////////////////////////////////

	// createGroup creates a new group and initial message
	createGroup = async (recipients: string[], initialMessage: string, encrypted: boolean) => {

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
			group = await this.#mls.createGroup(group)
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

		// Save the group in the database
		await this.saveGroup(group)

		// Synchronize with the server
		this.syncGroup(group)
	}

	// saveGroup saves the specified group to the database
	saveGroup = async (group: Group) => {

		// Calculate the default group name based on the members of the group
		group.defaultName = await this.#calcGroupDefaultName(group)

		// Save the group to the database
		await this.#database.saveGroup(group)

		// Reload the group to refresh the UX
		await this.loadGroups()
	}

	syncGroup = async (group: Group) => {

		// Send a "Group:Update" activity to my other devices
		var activity = new Activity({
			"to": [this.actorId()],
			"actor": this.actorId(),
			"type": vocab.ActivityTypeUpdate,
			"object": {
				"id": group.id,
				"type": vocab.ObjectTypeEmissaryContext,
				"name": group.name,
				"summary": group.summary,
				"stateId": group.stateId,
				"tag": group.tags,
				"unread": group.unread,
			}
		})

		// Asynchronously send a private message to my other devices
		this.#sendActivity(group, activity, "SYNC GROUP")
	}

	// leaveGroup leaves/deletes the specified group from the database
	leaveGroup = async (groupId: string) => {

		console.log("leaveGroup: " + groupId)

		// Guarantee dependency
		if (this.#database == undefined) {
			throw new Error("Database service is not initialized")
		}

		// Locate the group to leave
		const group = await this.#database.loadGroup(groupId)

		// RULE: If we don't have the group locally, then just exit
		if (group == undefined) {
			console.log("Group not found locally. Nothing to leave.")
			return
		}

		// Encrypted groups then we need to send an MLS "leave" message
		if (groupIsEncrypted(group)) {

			if (this.#mls == undefined) {
				throw new Error("MLS service is not initialized")
			}

			try {
				// Send MLS messages to leave the group
				await this.#mls.leaveGroup(group)
			} catch (error) {
				console.error("Error leaving group:", error)
			}
		}

		// (3/4) Send a message to my other devices to delete this group from their database.
		await this.#delivery.sendActivity(new Activity({
			to: this.#actor.id(),
			actor: this.#actor.id(),
			type: vocab.ActivityTypeLeave,
			object: group.id,
		}))

		// (4/4) Delete the group from THIS database
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
			await this.saveGroup(group)
			this.syncGroup(group) // (run async)
		}

		this.groupStream(group)
		await this.loadMessages()
		this.inReplyTo = undefined

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

		// Re-calculate the default name
		group.defaultName = await this.#calcGroupDefaultName(group)

		// Save the group to the database
		await this.saveGroup(group)

		// Update the "selected group" stream
		this.groupStream(group)

		// Return the updated group
		return group
	}

	removeGroupMember = async (actorId: string) => {

		var group = this.groupStream()

		// Special logic for encrypted groups
		if (groupIsEncrypted(group)) {

			// Guarantee dependency
			if (this.#mls == undefined) {
				throw new Error("MLS service is not initialized")
			}

			// Remove the member using MLS
			await this.#mls.removeGroupMember(group, actorId)

		} else {

			// Remove the member from the regular group list
			group.members = group.members.filter((member) => member != actorId)
		}

		// Recalculate the default group name
		group.defaultName = await this.#calcGroupDefaultName(group)

		// Save the group to the database
		await this.#database.saveGroup(group)

		// Apply the updated group to the "current group" stream
		this.groupStream(group)
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
		window.requestAnimationFrame(() => {
			document.getElementById("message-input")?.focus()
		})
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
		this.#sendActivity(group, activity, "SEND MESSAGE")
	}

	// sendFile sends a base64-encoded file to the specified group
	sendFile = async (file: string) => {

		// Get the currently selected group
		var group = this.groupStream()

		if (group.id == "") {
			throw new Error("No group selected")
		}

		// Create a new Message record and save to the database
		var message = NewMessage()
		message.groupId = group.id
		message.sender = this.#actor.id()
		message.attachments = [file]
		message.type = "SENT"

		if (this.inReplyTo != undefined) {
			message.inReplyTo = this.inReplyTo.id
			this.removeReply()
		}

		// Save message and reload to refresh the UX
		await this.#database.saveMessage(message)
		await this.loadMessages()

		// Update the group with the message content
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
		this.#sendActivity(group, activity, "SEND FILE")
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
		this.#sendActivity(group, activity, "UPDATE MESSAGE")

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

		this.#sendActivity(group, activity, 'DELETE MESSAGE')

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
		this.#sendActivity(group, activity, "REACTION")
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
		this.#sendActivity(group, activity, "UNDO REACTION")
	}


	//////////////////////////////////////////
	// Contacts
	//////////////////////////////////////////

	// getContactStream returns a Contact stream for the specified actorId
	getContactStream = (actorId: string): Stream<Contact> => {
		return this.#contacts.getContactStream(actorId)
	}


	//////////////////////////////////////////
	// Receiving Activities
	//////////////////////////////////////////

	receiveActivity = async (activity: Activity, retryCount: number = 0) => {

		var object: Document

		// Retrieve the object from the activity. This should be embedded,
		// but we can load from the network if needed.
		var object = await activity.object()

		// Decode MLS-encrypted messages
		if (object.isMLSMessage()) {

			// Part 1: Parse and possibly decode the received activity
			try {

				// Guarantee dependency
				if (this.#mls == undefined) {
					throw new Error("MLS service is not initialized (will retry shortly)")
				}

				// Decode the message embedded in the object.content.
				const decodedActivity = await this.#mls.receiveActivity(activity, object)

				// If the activity is null, then the MLS decoder has done all of the work.
				// There's nothing more to do, so exit.
				if (decodedActivity == null) {
					return
				}

				// RULE: guarantee that the actorIds match the encrypted content
				if (decodedActivity.actorId() != activity.actorId()) {
					console.error("Rejecting message: Decrypted activity actor must match outer activity actor")
					return
				}

				// Update activity and object to continue processing using the decoded values.
				activity = decodedActivity
				object = await activity.object()

			} catch (error) {

				if (retryCount < 120) { // retry every half-second for up to 1 minute
					console.log("Retrying activity reception... Attempt #" + (retryCount + 1))
					setTimeout(() => {
						this.receiveActivity(activity, retryCount + 1)
					}, 500)
					return
				}

				console.log("Giving up on message after 1 minute", error)
				return
			}
		}

		console.log("controller.receiveActivity", activity.toObject())

		// Part 2: Route the activity based on its type, and apply changes to the local database and UX as needed.
		try {

			switch (activity.type()) {

				case vocab.ActivityTypeAcknowledge:
					return await this.#receiveActivity_Acknowledge(activity)

				case vocab.ActivityTypeCreate:

					switch (object.type()) {
						case vocab.ObjectTypeMlsKeyPackage:
							return
						default:
							return await this.#receiveActivity_CreateMessage(activity)
					}

				case vocab.ActivityTypeDelete:
					return await this.#receiveActivity_DeleteMessage(activity)

				case vocab.ActivityTypeFailure:
					return await this.#receiveActivity_Failure(activity)

				case vocab.ActivityTypeLeave:
					return await this.#receiveActivity_Leave(activity)

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

		// Create a new message record in the database for this incoming message.
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

		if (object.attachment() != "") {
			message.attachments = [object.attachment()]
		}

		// Save the message to the database
		await this.#database.saveMessage(message)

		// Mark the group with the lastMessage content
		group.lastMessage = object.content()

		// Mark the group as "unread"
		if (!sentByMe) {

			// If not currentlly viewing this group
			if (groupId != this.selectedGroupId()) {

				// Mark it as "unread"
				group.unread = true

				// Send desktop notifications (if requested)
				if (this.config.isDesktopNotifications) {
					if (Notification.permission === "granted") {
						if (this.isWindowFocused == false) {
							new Notification(message.sender, {
								body: message.content,
							})
						}
					}
				}
			}
		}

		// Update the group
		await this.saveGroup(group)

		// Send acknowledgement to the sender
		this.#sendActivity(group, {
			actor: this.actorId(),
			type: vocab.ActivityTypeAcknowledge,
			to: [message.sender],
			object: object.id(),
			context: group.id,
		}, "ACK")

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

	#receiveActivity_Leave = async (activity: Activity) => {

		// RULE: Only listen to "Leave" activities from myself.
		if (activity.actorId() != this.actorId()) {
			return
		}

		// Remove the "left" group from the database, if it exists
		await this.#database.deleteGroup(activity.objectId())

		// Refresh the group list to update the UX
		this.loadGroups()
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

		const object = await activity.object()

		var group = await this.#database.loadGroup(object.id())

		if (group == undefined) {
			return
		}

		group.name = object.name()
		group.summary = object.summary()
		group.tags = object.getArray("as", "tag")
		group.unread = object.getBoolean("emissary", "unread")
		this.setGroupState(group, object.getString("emissary", "stateId"))

		await this.saveGroup(group)
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
	// Network Stuff
	//////////////////////////////////////////

	// sendActivity sends an activity to the Actor's outbox
	#sendActivity = async (group: Group, activity: Activity | { [key: string]: any }, debug?: any) => {

		// RULE: If the activity is not already an Activity object, convert it to one
		if (!(activity instanceof Activity)) {
			activity = new Activity(activity)
		}

		// Apply the "instrument" property to the activity to identify that it came from this client.
		activity.set(vocab.PropertyInstrument, this.config.generatorId)

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
		return await this.#mls.sendActivity(group, activity, debug)
	}


	//////////////////////////////////////////
	// Other Helpers
	//////////////////////////////////////////

	// calcGroupName is a mithril.Stream combiner that returns an intelligent name for the group based on its 
	// internal state and member list.
	#calcGroupDefaultName = async (group: Group): Promise<string> => {

		const contactPromises = group.members.map(actorId => this.#contacts.loadContact(actorId))
		const contacts = await Promise.all(contactPromises)
		const contactNames = contacts.map(contact => contact?.name || "").filter(name => name != "")

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
			.slice(0, 2)
			.join(", ") + `, +${contactNames.length - 2} others`
	}
}
