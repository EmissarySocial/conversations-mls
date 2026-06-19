// Mithril
import m from "mithril"
import Stream from "mithril/stream"

// ts-mls
import { type KeyPackage } from "ts-mls"

// ActivityPub objects
import { Actor } from "../as/actor"
import { Activity } from "../as/activity"
import { Document } from "../as/document"
import * as vocab from "../as/vocab"

// Model objects
import { type Config, NewConfig } from "../model/config"
import { type Contact } from "../model/contact"
import { type DBKeyPackage } from "../model/db-keypackage"
import { type Emoji } from "../model/emoji"
import { type EncryptedGroup, type Group, type GroupState, NewGroup, groupIsEncrypted } from "../model/group"
import { Message, NewMessage } from "../model/message"

// Services
import { type ICodec, type IContacts, type IDelivery, type IDirectory, type IDatabase, type IHost, type IProxy, type IReceiver, type IWebFinger } from "./interfaces"
import { CodecMls } from "./codecMls"
import { ActivityPubAuthenticationService } from "./authService"
import { CodecPlaintext } from "./codecPlaintext"
import { WebFinger } from "./webfinger"
import { emojiKey } from "./emojikeys"

// Other utility functions
import { cipherSuiteImplementation, decodeKeyPackage, decodeKeyFromBase64, deriveKeyFromPassword, encodeKeyToBase64, generateAESKey, keyPackageIsExpired, newKeyPackage, shouldRefreshKeyPackage, unwrapKey, wrapKey } from "./cryptography"

import { newId, htmlToText, sanitizeHTML, formatMessageContent } from "./utils"
import { NewFilter, type Filter } from "../model/filter"

// SettingsTab identifies which tab is active on the settings screen.
export type SettingsTab = "FILTERS" | "GENERAL" | "SIGNOUT"

export class Controller {

	readonly #actorId: string
	readonly #database: IDatabase
	readonly #delivery: IDelivery
	readonly #directory: IDirectory
	readonly #receiver: IReceiver
	readonly #contacts: IContacts
	readonly #host: IHost
	readonly #codecPlaintext: CodecPlaintext
	readonly #proxy: IProxy
	readonly #webfinger: IWebFinger

	#actor: Actor
	#codecMls?: CodecMls
	#allowPlaintextMessages: boolean
	#allowEncryptedMessages: boolean
	#encryptionKey?: CryptoKey

	config: Config
	groups: Group[]
	messages: Message[]
	filters: Filter[]

	groupStream: Stream<Group | EncryptedGroup>
	groupMemberStream: Stream<string[]>
	groupContactStream: Stream<Stream<Contact>[]>

	message: Message | undefined
	inReplyTo: Message | undefined

	pageView: string = "LOADING"
	settingsTab: SettingsTab = "GENERAL"
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
		proxy: IProxy,
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
		this.#allowEncryptedMessages = false
		this.#codecPlaintext = new CodecPlaintext(this.#database, this.#delivery, this.#actorId)
		this.#proxy = proxy
		this.#webfinger = new WebFinger()

		// Application State
		this.groups = []
		this.messages = []
		this.filters = []
		this.message = undefined
		this.inReplyTo = undefined

		// Reactive Streams. The initial group is an empty-id placeholder meaning
		// "nothing selected" (see clearSelectedGroup / viewDetails).
		const placeholderGroup = NewGroup("PLAINTEXT")
		placeholderGroup.id = ""
		this.groupStream = Stream(placeholderGroup)
		this.groupMemberStream = this.groupStream.map(group => group.members)
		this.groupContactStream = this.groupMemberStream.map((members) => members.map(id => this.#contacts.getContactStream(id)))

		// Application Configuration
		this.config = NewConfig() // Empty placeholder until loaded
	}


	//////////////////////////////////////////
	// Startup
	//////////////////////////////////////////

	// loadConfig retrieves the configuration from the
	// database and starts the MLS service (if encryption keys are present)
	readonly start = async () => {

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

			const sessionKey = globalThis.sessionStorage.getItem("key")
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
			this.#actor = await new Actor().fromUrl(this.#actorId)

		} catch (error) {
			console.error("Unable to load the Actor record", error)
			this.stop("SERVER-DOWN")
			return
		}

		// Update the proxy endpoint with the exact value from the actor
		this.#proxy.setProxyUrl(this.#actor.proxyUrl())

		// Collect the messages API information
		const { url, plaintext, ciphertext } = this.#actor.messages()

		if (url == "") {
			console.error("Actor does not support messages APIs")
			this.stop("UNSUPPORTED")
			return
		}

		// Apply the freshly loaded actor to all of the dependencies
		this.#allowPlaintextMessages = plaintext
		this.#allowEncryptedMessages = ciphertext

		// Wire additional data into each dependency
		this.#receiver.setActor(this.#actor)
		this.#delivery.setActor(this.#actor)
		this.#delivery.setSignout(() => this.stop("SESSION-EXPIRED"))
		this.#directory.setActor(this.#actor)

		// Initialize MLS (if supported by the server)
		if (this.useEncryptedMessages()) {

			try {

				// Validate all KeyPackages on the server
				await this.#validateKeyPackages()

				// Load async dependencies: ciphersuite and keyPackage
				const cipherSuite = await cipherSuiteImplementation()
				const keyPackage = await this.loadOrCreateKeyPackage()
				const authenticationService = new ActivityPubAuthenticationService(this.#directory)

				// Create the MLS encoder service
				this.#codecMls = new CodecMls(
					this,
					this.#database,
					this.#delivery,
					this.#directory,
					authenticationService,
					cipherSuite,
					keyPackage.publicKeyPackage,
					keyPackage.privateKeyPackage,
					this.#actor,
					this.config.generatorId,
				)

			} catch (error) {
				console.error("Unable to initialize MLS service", error)
				this.stop("SERVER-DOWN")
				return
			}
		}

		// Start the realtime message receiver
		this.#receiver.start(this.config.generatorId, this.receiveActivity, this.lastMessage, () => this.stop("SESSION-EXPIRED"))

		// Wire UX redraws into database updates. Filters load first because
		// loadGroups() limits the result to the selected filter's tags and states.
		this.#database.onchange(async () => {
			await this.loadFilters()
			await this.loadGroups()
			await this.loadMessages()
		})

		// Refresh Data for the UX (filters before groups, see above)
		this.loadFilters().then(() => this.loadGroups())

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

		// Create the default conversation filters (IDs are auto-generated by NewFilter)
		const defaultFilters: { name: string, sort: number, states: GroupState[] }[] = [
			{ name: "Conversations", sort: 1, states: ["ACTIVE", "IMPORTANT"] },
			{ name: "Important Only", sort: 2, states: ["IMPORTANT"] },
			{ name: "Archived", sort: 3, states: ["ARCHIVED"] },
			{ name: "All Conversations", sort: 4, states: [] }, // No criteria: shows every conversation
		]

		for (const { name, sort, states } of defaultFilters) {
			const filter = NewFilter()
			filter.name = name
			filter.sort = sort
			filter.states = states
			filter.locked = true // Built-in filters cannot be deleted by the user
			await this.#database.saveFilter(filter)

			// Select the first filter by default, so the menu always has a selection
			if (this.config.selectedFilterId == "") {
				this.config.selectedFilterId = filter.id
			}
		}

		// Save the new configuration to the database
		await this.#database.saveConfig(this.config)

		// Call start again.  Since we've set config.ready to true, this will skip the welcome screen and initialize the app.
		await this.start()
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

	// saveConfig persists the current in-memory config to the database. Used by the
	// settings screen for auto-saving individual changes after mutating this.config.
	saveConfig = async () => {
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
			globalThis.sessionStorage.setItem("key", await encodeKeyToBase64(this.#encryptionKey))

			// If you've made it this far, then the passcode is valid and you can proceed with the app
			await this.start()
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

		globalThis.sessionStorage.removeItem("key")

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

		// Remove the KeyPackage from the server
		const keyPackage = await this.#database.loadKeyPackage()
		if (keyPackage != undefined) {
			await this.#directory.deleteKeyPackage(keyPackage.keyPackageURL)
		}

		// Erase the session key from sessionStorage
		globalThis.sessionStorage.removeItem("key")

		// Erase all local data
		this.#database.erase()

		// Reload the application
		globalThis.document.location.reload()
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

		// Deliberately entering settings always starts on the default tab
		this.settingsTab = "GENERAL"
		m.redraw()
	}

	// selectedFilterName returns the display name of the currently selected
	// conversation filter (empty string if none is selected).
	selectedFilterName = (): string => {
		return this.filters.find((filter) => filter.id == this.config.selectedFilterId)?.name ?? ""
	}

	// setConversationFilter records the currently selected conversation filter,
	// persists it, and reloads the conversation list to match the new filter.
	setConversationFilter = async (filterId: string) => {
		this.config.selectedFilterId = filterId
		await this.#database.saveConfig(this.config)
		await this.loadGroups()
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

	host_block = (actorId: string) => {
		this.#host.viewBlockActor(actorId)
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

	useEncryptedMessages = (): boolean => {

		// this is set when the USER chooses to send encrypted messages
		if (!this.config.isEncryptedMessages) {
			return false
		}

		// this is set when the SERVER supports encrypted messages.
		if (!this.#allowEncryptedMessages) {
			return false
		}

		return true
	}

	//////////////////////////////////////////
	// KeyPackages
	//////////////////////////////////////////


	// #validateKeyPackages checks all KeyPackages owned by the current actor and removes any that have expired.
	readonly #validateKeyPackages = async (): Promise<void> => {

		// RULE: Only validate KeyPackages if the server supports encrypted messages.
		if (!this.useEncryptedMessages()) {
			return
		}

		const documents = this.#directory.getKeyPackagesByActor(this.#actorId)
		let shouldCreateKeyPackage = true

		for await (const document of documents) {
			try {

				// Parse the ActivityStreams document as a KeyPackage
				const keyPackage = decodeKeyPackage(document)

				// Special rules if this KeyPackage was generated by this device (matching generatorId)
				if (document.generator() == this.config.generatorId) {

					// If the KeyPackage is expired, then delete it from the server (it will be replaced with a new one below)					
					if (shouldRefreshKeyPackage(document)) {
						await this.#directory.deleteKeyPackage(document.id())
						continue
					}

					shouldCreateKeyPackage = false
					continue
				}

				// If the KeyPackage from ANOTHER DEVICE is expired, then delete it from the server (it cannot be used anyway)
				if (keyPackageIsExpired(keyPackage)) {
					await this.#directory.deleteKeyPackage(document.id())
					continue
				}
			}

			catch (error) {
				console.error("validateKeyPackages: Failed to validate KeyPackage document:", document.toObject(), error)
			}
		}

		// If there is no valid KeyPackage for this device, then create a new one
		if (shouldCreateKeyPackage) {
			await this.#database.deleteKeyPackage()
			await this.createOrUpdateKeyPackage()
		}
	}


	// createOrUpdateKeyPackage creates a new KeyPackage and POSTs it
	// to the server to replaces the current one. If there is no
	// existing KeyPackage, then the new one is created
	createOrUpdateKeyPackage = async (): Promise<DBKeyPackage> => {

		// RULE: Require server support for encrypted messages
		if (!this.#allowEncryptedMessages) {
			throw new Error("Server does not support sending of encrypted messages")
		}

		// Try to find an existing KeyPackage record
		const existing = await this.#database.loadKeyPackage()

		// Generate a new key package for this user
		const keyPackageResult = await newKeyPackage(this.#actor.id())

		// Compute the signature and emojiKey from the public key package
		const [signature, emojiKeyValue] = await emojiKey(keyPackageResult.publicPackage.signature)

		// Build the DBKeyPackage with all required fields
		const dbKeyPackage: DBKeyPackage = {
			id: "self",
			keyPackageURL: existing?.keyPackageURL ?? "",
			publicKeyPackage: keyPackageResult.publicPackage,
			privateKeyPackage: keyPackageResult.privatePackage,
			generatorId: this.config.generatorId,
			generatorName: this.config.generatorName,
			actorId: this.#actorId,
			signature: signature,
			emojiKey: emojiKeyValue,
			createDate: Date.now(),
		}

		if (existing == undefined) {
			const [activityId, keyPackageURL] = await this.#directory.createKeyPackage(dbKeyPackage)
			dbKeyPackage.keyPackageURL = keyPackageURL
			await this.lastMessage(activityId)
		} else {
			await this.#directory.updateKeyPackage(dbKeyPackage)
		}

		// Save to the local database and return
		return await this.#database.saveKeyPackage(dbKeyPackage)
	}

	// loadKeyPackage reads the current Actor's KeyPackage from the local
	// database, or returns undefined if none exists. Unlike loadOrCreateKeyPackage,
	// it never creates a new KeyPackage.
	loadKeyPackage = (): Promise<DBKeyPackage | undefined> => {
		return this.#database.loadKeyPackage()
	}

	// loadOrCreateKeyPackage tries to load the KeyPackage for the
	// current Actor. If none exists, then a new one is created and returned
	loadOrCreateKeyPackage = async (): Promise<DBKeyPackage> => {

		// RULE: Require server support for encrypted messages
		if (!this.#allowEncryptedMessages) {
			throw new Error("Server does not support sending of encrypted messages")
		}

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

		// RULE: Require server support for encrypted messages
		if (!this.#allowEncryptedMessages) {
			throw new Error("Server does not support sending of encrypted messages")
		}

		return this.#directory.getKeyPackages([actorId])
	}

	//////////////////////////////////////////
	// Groups
	//////////////////////////////////////////

	// createGroup creates a new group and initial message
	createGroup = async (recipients: string[], initialMessage: string, encrypted: boolean) => {

		// Add "me" to the members list
		recipients.push(this.actorId())

		// If encrypted messages are disallowed, then only create plaintext groups
		if (!this.useEncryptedMessages()) {
			encrypted = false
		}

		// Extra validate that the server will let us do this...
		if (encrypted) {

			// RULE: Require server support for encrypted messages
			if (!this.#allowEncryptedMessages) {
				throw new Error("Server does not support sending of encrypted messages")
			}

		} else {

			// RULE: Require server support for plaintext messages
			if (!this.#allowPlaintextMessages) { // NOSONAR typescript:S6660 - this is clearer this way
				throw new Error("Server does not support sending of plaintext messages")
			}
		}

		// Use the codec to generate a new Group record.
		const codec = this.#getCodec(encrypted)
		let group = await codec.createGroup(recipients)

		// Since we're creating this group, it becomes active immediately (no WELCOME step)
		this.setGroupState(group, "ACTIVE")

		// Save the group as the "current" group in the UX
		this.groupStream(group)

		// Send the initial message
		await this.sendMessage(initialMessage)

		// Move the view to the messages for this group
		this.pageView = "GROUP-MESSAGES"
	}

	joinGroup = async (group: Group) => {

		if (group.stateId != "WELCOME") {
			console.error("Can only join groups that are in the WELCOME state")
			return
		}

		this.setGroupState(group, "ACTIVE")
		await this.saveGroup(group)
		m.redraw()

		this.syncGroup(group)
	}

	// loadGroups retrieves the groups matching the currently selected filter from
	// the database. When no filter is selected, every group is loaded.
	loadGroups = async () => {

		// Load groups from the database, limited to the selected filter's tags and states
		const filter = this.filters.find((f) => f.id == this.config.selectedFilterId)

		if (filter == undefined) {
			this.groups = await this.#database.allGroups()
		} else {
			this.groups = await this.#database.searchGroups(filter.tags, filter.states)
		}

		// Keep a valid group displayed without letting the filter change the selection
		await this.reconcileSelectedGroup()
	}

	// loadFilters retrieves all conversation filters from the database
	loadFilters = async () => {
		this.filters = await this.#database.allFilters()
	}

	// saveFilter persists a conversation filter to the database
	saveFilter = async (filter: Filter) => {
		await this.#database.saveFilter(filter)
	}

	// deleteFilter removes a conversation filter from the database. If the deleted
	// filter was the selected one, the selection falls back to the first remaining
	// filter (as if no filter were selected).
	deleteFilter = async (filterId: string) => {
		await this.#database.deleteFilter(filterId)

		if (this.config.selectedFilterId == filterId) {
			await this.loadFilters()
			this.config.selectedFilterId = this.filters[0]?.id ?? ""
			await this.saveConfig()
		}
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
		const activity = new Activity({
			"to": [this.actorId()],
			"actor": this.actorId(),
			"type": vocab.ActivityTypeUpdate,
			"object": {
				"id": group.id,
				"context": group.id,
				"type": vocab.ObjectTypeEmissaryContext,
				"name": group.name,
				"summary": group.summary,
				"lastMessage": group.lastMessage,
				"lastMessageId": group.lastMessageId,
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

		// Get the coded for this group (Plaintext or MLS)
		const codec = this.#getCodecForGroup(group)

		try {
			await codec.leaveGroup(group)
		} catch (error) {
			console.error("Error leaving group:", error)
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

	// selectGroup displays the group with the specified ID and reloads its messages.
	// The group is loaded directly from the database, so it is displayed even when
	// it is not present in the (filtered) sidebar list.
	selectGroup = async (groupId: string) => {

		// Load the requested group from the database (not just the filtered list),
		// so the selection survives even when the active filter excludes it.
		const group = await this.#database.loadGroup(groupId)

		// If the group can't be found, then clear the selection and exit.
		if (group == undefined) {
			this.clearSelectedGroup()
			return
		}

		// Set the current group stream
		this.groupStream(group)

		// Remove "unread" marker, if it exists
		if (group.unread) {
			group.unread = false
			await this.saveGroup(group)
			this.syncGroup(group) // (run async)
		}

		await this.loadMessages()
		this.inReplyTo = undefined

		this.page_group_messages()
	}

	// clearSelectedGroup resets the displayed group to an empty placeholder. The
	// placeholder uses an empty ID so selectedGroupId() reports "nothing selected".
	clearSelectedGroup = () => {
		const placeholder = NewGroup("PLAINTEXT")
		placeholder.id = ""
		this.groupStream(placeholder)
		this.messages = []
	}

	// reconcileSelectedGroup keeps a valid group displayed after the sidebar list
	// is (re)loaded. The currently displayed group is left in place when it still
	// exists, so the active filter never changes what conversation is shown. Only
	// when nothing is selected yet does it fall back to the first group in the list.
	reconcileSelectedGroup = async () => {

		// If a real group is already displayed and still exists, leave it alone.
		const currentId = this.selectedGroupId()
		if (currentId != "") {
			const current = await this.#database.loadGroup(currentId)
			if (current != undefined) {
				return
			}
		}

		// Nothing valid is selected: fall back to the first group in the list (if any).
		const first = this.groups[0]
		if (first == undefined) {
			this.clearSelectedGroup()
			return
		}

		await this.selectGroup(first.id)
	}

	selectedGroupId = () => {
		return this.groupStream().id
	}

	// getFirstMessageInGroup returns the content of the first received message in a group
	getFirstMessageInGroup = async (groupId: string): Promise<string> => {
		const message = await this.#database.getFirstMessageInGroup(groupId)
		return message?.content ?? ""
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

	// setSelectedGroupState changes the currently displayed group's state, persists
	// it (syncing to other devices), and redraws. Changing the state may move the
	// group in or out of the active filter's sidebar list.
	setSelectedGroupState = async (stateId: GroupState) => {

		const group = this.groupStream()

		// Nothing to do when the state is unchanged
		if (group.stateId == stateId) {
			return
		}

		this.setGroupState(group, stateId)
		await this.saveGroupAndSync(group)
		m.redraw()
	}


	//////////////////////////////////////////
	// Group Members
	//////////////////////////////////////////

	// addGroupMember adds a new actorId to the currently selected group
	addGroupMembers = async (actorIds: string[]) => {

		// Read the current value of the "selected group"
		const group = this.groupStream()

		// RULE: De-duplicate the request, and remove actors already in the group
		actorIds = [...new Set(actorIds)].filter(actorId => !group.members.includes(actorId))

		// If there are no additional actors to add, then exit early
		if (actorIds.length == 0) {
			return group
		}

		// Specific logic for encrypted/unencrypted groups
		const codec = this.#getCodecForGroup(group)
		await codec.addGroupMembers(group, actorIds)

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

		const group = this.groupStream()

		// Specific logic for encrypted/unencrypted groups
		const codec = this.#getCodecForGroup(group)
		await codec.removeGroupMember(group, actorId)

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
		globalThis.requestAnimationFrame(() => {
			document.getElementById("message-input")?.focus()
		})
	}

	removeReply = () => {
		this.inReplyTo = undefined
		m.redraw()
	}

	// sendMessage sends a message to the specified group
	sendMessage = async (content: string) => {

		console.log("sendMessage called with content:", content)

		// Get the currently selected group
		const group = this.groupStream()

		if (group.id == "") {
			throw new Error("No group selected")
		}

		// Create a new Message record and save to the database
		const message = NewMessage()
		message.groupId = group.id
		message.sender = this.#actor.id()
		message.content = await formatMessageContent(content, (handle) => this.#webfinger.resolveActorURL(handle))
		message.type = "SENT"

		if (this.inReplyTo != undefined) {
			message.inReplyTo = this.inReplyTo.id
		}

		// Send message using the appropriate codec
		const codec = this.#getCodecForGroup(group)
		const object = await codec.encodeMessage(group, message)

		// Create an ActivityPub activity
		const activity = new Activity({
			context: group.id,
			actor: this.actorId(),
			type: vocab.ActivityTypeCreate,
			to: group.members,
			object: object,
		})

		console.log("Constructed activity:", activity.toObject())

		// Send the activity and capture the server-assigned ID
		const serverId = await this.#sendActivity(group, activity)

		// If the server assigned a URL then use it
		if (serverId !== "") {
			message.id = serverId
		}

		// Save message and reload to refresh the UX
		await this.#database.saveMessage(message)
		this.removeReply()
		await this.loadMessages()

		// Update the group with the message metadata (lastMessage is text, not HTML)
		group.lastMessage = htmlToText(content)
		group.lastMessageId = message.id
		group.updateDate = Temporal.Now.instant().epochMilliseconds

		// Save the group with updated message metadata
		await this.saveGroup(group)
	}

	// sendFile sends a base64-encoded file to the specified group
	sendFile = async (file: string) => {

		// Get the currently selected group
		const group = this.groupStream()

		if (group.id == "") {
			throw new Error("No group selected")
		}

		// Create a new Message record and save to the database
		const message = NewMessage()
		message.groupId = group.id
		message.sender = this.#actor.id()
		message.attachments = [file]
		message.type = "SENT"

		if (this.inReplyTo != undefined) {
			message.inReplyTo = this.inReplyTo.id
		}

		// Save message and reload to refresh the UX
		await this.#database.saveMessage(message)
		await this.loadMessages()

		// Update the group with the message content
		await this.saveGroup(group)

		// Encode the message object using the appropriate codec for this group
		const codec = this.#getCodecForGroup(group)
		const object = await codec.encodeMessage(group, message)

		// Create an ActivityPub activity 
		const activity = new Activity({
			context: group.id,
			actor: this.actorId(),
			type: vocab.ActivityTypeCreate,
			to: group.members,
			object: object,
		})

		// (asynchronously) Send the activity through the delivery service
		await this.#sendActivity(group, activity)
		this.removeReply()
	}

	updateMessage = async (message: Message) => {

		const group = this.groupStream()

		// RULE: Only the original sender can update a message
		if (message.sender != this.actorId()) {
			return
		}

		// Format the edited (plain text) content into sanitized HTML for storage/display
		message.content = await formatMessageContent(message.content, (handle) => this.#webfinger.resolveActorURL(handle))

		// RULE: Can only update messages in the current group.
		if (message.groupId != group.id) {
			return
		}

		// Encode the message object using the appropriate codec for this group
		const codec = this.#getCodecForGroup(group)
		const object = await codec.encodeMessage(group, message)

		// The server locates the existing object to update by its "id", so the Update's
		// object MUST carry the message's (server-assigned) id. (Create lets the server
		// assign the id; Update must reference the one it already gave us.)
		;(object as Record<string, unknown>)["id"] = message.id

		// Create an "Update" activity
		const activity = new Activity({
			context: group.id,
			actor: this.actorId(),
			type: vocab.ActivityTypeUpdate,
			to: group.members,
			object: object,
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
		const group = this.groupStream()

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
		const activity = new Activity({
			"@context": vocab.ContextActivityStreams,
			context: group.id,
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
		const activity = new Activity({
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
	// Contacts
	//////////////////////////////////////////

	// getContactStream returns a Contact stream for the specified actorId
	getContactStream = (actorId: string): Stream<Contact> => {
		return this.#contacts.getContactStream(actorId)
	}


	//////////////////////////////////////////
	// Sending Activities
	//////////////////////////////////////////

	// sendActivity sends an activity to the Actor's outbox.
	// Returns the server-assigned URL for the created object, or "" if none was returned.
	readonly #sendActivity = async (group: Group, activity: Activity): Promise<string> => {

		// Apply the "instrument" property to the activity to identify that it came from this client.
		activity.set(vocab.PropertyInstrument, this.config.generatorId)

		// Find the codec for this group (plaintext or MLS)
		const codec = this.#getCodecForGroup(group)

		// Send the activity through the codec and return the server-assigned ID.
		return await codec.sendActivity(group, activity)
	}


	//////////////////////////////////////////
	// Receiving Activities
	//////////////////////////////////////////

	receiveActivity = async (activity: Activity, retryCount: number = 0) => {

		console.log("controller.receiveActivity called with activity:", activity.toObject(), "retryCount:", retryCount)

		// Resolve the activity's object into a Document. Leave/Delete reference their
		// object by bare URL and never use the resolved Document (their handlers and the
		// codec work from objectId()), so we skip resolving it — that URL is often
		// unreachable anyway (e.g. a reflected "Leave" for a group we just left, whose
		// collection the server now 400s). For every other type we resolve it (usually
		// embedded, so no network), but still tolerate a failed fetch by falling back to
		// an empty Document rather than crashing the whole pipeline.
		const object = await this.#resolveActivityObject(activity)

		// Find the codec for this activity
		const codec = this.#getCodecForActivity(object)

		try {

			// Process the activity through the codec. This will handle decryption and verification of
			// the activity, and will throw an error if the activity is invalid or cannot be processed
			const decodedValue = await codec.receiveActivity(activity, object)

			// If this is null, the Codec is saying it has already done all the work,
			// and there's nothing else for US to process. So just exit.
			if (decodedValue == null) {
				return
			}

			// Otherwise, use the decodedValue as the activity and continue processing
			activity = decodedValue

		} catch (error) {

			if (retryCount < 120) { // retry every second for up to 2 minutes
				console.log("Retrying error processing activity with codec:", error)
				setTimeout(() => {
					this.receiveActivity(activity, retryCount + 1)
				}, 1000)
				return
			}

			console.error("Failed to process activity after multiple attempts:", error)
			return
		}

		// Part 2: Route the activity based on its type, and apply changes to the 
		// local database and UX as needed.
		try {

			switch (activity.type()) {

				case vocab.ActivityTypeAcknowledge:
					return await this.#receiveActivity_Acknowledge(activity)

				case vocab.ActivityTypeCreate:

					if (object.type() == vocab.ObjectTypeMlsKeyPackage) {
						return
					}

					return await this.#receiveActivity_CreateMessage(codec, activity)

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

					// Group updates are handled differently than message updates, so we need to check the object type to route properly.
					if (object.type() == vocab.ObjectTypeEmissaryContext) {
						return await this.#receiveActivity_UpdateContext(activity)
					}

					return await this.#receiveActivity_UpdateMessage(activity)

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

	// resolveActivityObject returns the activity's "object" as a Document. Leave and
	// Delete reference their object by bare URL and never read the resolved Document
	// (they use objectId()), so we skip resolving it — and avoid a doomed fetch of a
	// URL the server may reject. For other types, resolve it (usually embedded, so no
	// network), tolerating a failed fetch with an empty Document.
	readonly #resolveActivityObject = async (activity: Activity): Promise<Document> => {

		switch (activity.type()) {
			case vocab.ActivityTypeLeave:
			case vocab.ActivityTypeDelete:
				return new Document({})
		}

		try {
			return await activity.object()
		} catch (error) {
			console.warn("controller.receiveActivity: could not resolve activity object, continuing with empty object:", error)
			return new Document({})
		}
	}

	readonly #receiveActivity_Acknowledge = async (activity: Activity) => {

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

	readonly #receiveActivity_CreateMessage = async (codec: ICodec, activity: Activity) => {

		// Decode the object embedded in the activity.
		const object = await activity.object()

		// RULE: The message must be attributed to the actor who sent the activity
		if (object.attributedToId() != activity.actorId()) {
			throw new Error("Decrypted activity actor must match object's attributedTo")
		}

		// Locate the group assigned to this activity
		const groupId = activity.context()
		const group = await codec.getGroup(groupId)

		// Create a new message record in the database for this incoming message.
		const sentByMe = (object.attributedToId() == this.actorId())
		const message = NewMessage({
			id: object.id(),
			groupId: groupId,
			type: (sentByMe ? "SENT" : "RECEIVED"),
			sender: object.attributedToId(),
			content: sanitizeHTML(object.content()),
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

		// Track the most recent message in the group
		group.lastMessageId = message.id

		// Mark the group with the lastMessage content (text, not HTML)
		group.lastMessage = htmlToText(object.content())

		// RULE: A new message in an ARCHIVED group revives it to the ACTIVE state.
		if (group.stateId == "ARCHIVED") {
			this.setGroupState(group, "ACTIVE")
		}

		if (!sentByMe) {

			// Mark the group as "unread"
			// If not currentlly viewing this group
			if (groupId != this.selectedGroupId()) {

				// Mark it as "unread"
				group.unread = true
				group.updateDate = Temporal.Now.instant().epochMilliseconds

				// Send desktop notifications (if requested)
				if (this.config.isDesktopNotifications) {
					if (!this.isWindowFocused) {
						this.#host.notify(message.sender, message.content)
					}
				}
			}
		}

		console.log("Saving new message to group...", group, message)

		// Update the group
		await this.saveGroup(group)
	}

	readonly #receiveActivity_Failure = async (activity: Activity) => {
	}

	readonly #receiveActivity_DeleteMessage = async (activity: Activity) => {

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

	readonly #receiveActivity_Leave = async (activity: Activity) => {

		// RULE: Only listen to "Leave" activities from myself.
		if (activity.actorId() != this.actorId()) {
			return
		}

		// Remove the "left" group from the database, if it exists
		await this.#database.deleteGroup(activity.objectId())

		// Refresh the group list to update the UX
		this.loadGroups()
	}

	readonly #receiveActivity_Like = async (activity: Activity) => {

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

	readonly #receiveActivity_Undo = async (activity: Activity) => {

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
		const message = await this.#database.loadMessage(originalLike.objectId())
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

	readonly #receiveActivity_UpdateContext = async (activity: Activity) => {

		const object = await activity.object()

		const group = await this.#database.loadGroup(object.id())

		if (group == undefined) {
			return
		}

		group.name = object.name()
		group.summary = object.summary()
		group.tags = object.getArray("as", "tag")
		group.unread = object.getBoolean("emissary", "unread")
		group.lastMessage = object.getString("emissary", "lastMessage")
		group.lastMessageId = object.getString("emissary", "lastMessageId")
		this.setGroupState(group, object.getString("emissary", "stateId"))

		await this.saveGroup(group)
	}

	readonly #receiveActivity_UpdateMessage = async (activity: Activity) => {

		// Decode the object embedded in the activity.
		const object = await activity.object()

		// RULE: only the original sender can update a message
		if (object.attributedToId() != activity.actorId()) {
			throw new Error("Decrypted activity actor must match object's attributedTo")
		}

		// Load the message from the database
		const message = await this.#database.loadMessage(object.id())

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

		// Update the message content (sanitize the inbound HTML)
		message.history.push(message.content)
		message.content = sanitizeHTML(object.content())
		message.updateDate = Date.now()

		// Save the message to the database
		await this.#database.saveMessage(message)
	}


	//////////////////////////////////////////
	// Other Helpers
	//////////////////////////////////////////

	// getCodec returns the appropriate codec (Plaintext or MLS) based on the "encrypted" parameter.
	readonly #getCodec = (encrypted: boolean): ICodec => {
		if (encrypted) {
			if (this.#codecMls == undefined) {
				throw new Error("No codec available for encrypted messages. Either MLS has not initialized properly, or your permissions have changed on the server.")
			}
			return this.#codecMls
		}

		if (this.#codecPlaintext == undefined) {
			throw new Error("No codec available for plaintext messages. Either the plaintext codec has not initialized properly, or your permissions have changed on the server.")
		}

		return this.#codecPlaintext
	}

	// getCodecForGroup returns the appropriate codec for the specified group based on whether the group is encrypted or not.
	readonly #getCodecForGroup = (group: Group): ICodec => {
		return this.#getCodec(groupIsEncrypted(group))
	}

	// getCodecForActivity returns the appropriate codec for the specified activity based on whether the activity's object is encrypted or not.
	readonly #getCodecForActivity = (object: Document): ICodec => {
		return this.#getCodec(object.isMLSMessage())
	}

	// calcGroupName is a mithril.Stream combiner that returns an intelligent name for the group based on its 
	// internal state and member list.
	readonly #calcGroupDefaultName = async (group: Group): Promise<string> => {

		// Exclude the current user, so the default name shows only the OTHER members
		const otherMembers = group.members.filter(actorId => actorId != this.actorId())

		const contactPromises = otherMembers.map(actorId => this.#contacts.loadContact(actorId))
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
