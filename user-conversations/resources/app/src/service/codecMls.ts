// MLS functions and types
import { bytesToBase64, nodeTypes, type DefaultProposal, type IncomingMessageAction, type LeafIndex, type ProposalRemove, type ProposalWithSender, createProposal, defaultCredentialTypes, createApplicationMessage, createCommit, createGroup, decode, defaultProposalTypes, encode, getGroupMembers, joinGroup, mlsMessageDecoder, mlsMessageEncoder, processMessage, wireformats, zeroOutUint8Array, type CiphersuiteImpl, type ClientState, type CredentialBasic, type KeyPackage, type MlsContext, type MlsMessage, type MlsPublicMessage, type MlsPrivateMessage, type MlsWelcomeMessage, type Proposal, type PrivateKeyPackage } from "ts-mls"

// ActivityPub Types
import { Actor } from "../as/actor"
import { Activity } from "../as/activity"
import { Document } from "../as/document"
import * as vocab from "../as/vocab"

// Application Types
import { type EncryptedGroup, type Group, NewGroup, groupIsEncrypted } from "../model/group"
import { type Message, attachmentToDocument } from "../model/message"

import { type ICodec, type IController, type IDatabase, type IDelivery, type IDirectory } from "./interfaces"

import { uint8ArrayEqual, uint8ArraysContain, base64ToUint8Array } from "./utils"
import { keyPackageIsExpired, keyPackageIdentity } from "./cryptography"
import { CredentialBindings } from "./credentialBindings"
import { algorithms, CIPHER_X25519_AES128 } from "./algorithms"

// MLS service encrypts/decrypts messages using the MLS protocol.
// This is intended to be a reusable service that could be called
// by any software component that needs to use MLS-encrypted messages.
export class CodecMls implements ICodec {
	readonly #controller: IController
	readonly #database: IDatabase
	readonly #delivery: IDelivery
	readonly #directory: IDirectory
	readonly #cipherSuite: CiphersuiteImpl
	readonly #generatorId: string

	#publicKeyPackage: KeyPackage
	#privateKeyPackage: PrivateKeyPackage
	#actor: Actor

	// #authService answers ts-mls's validateCredential() hook from a local cache of
	// identity↔key bindings (no network). See AGENTS.md and CredentialBindings.
	readonly #authService: CredentialBindings = new CredentialBindings()

	constructor(
		controller: IController,
		database: IDatabase,
		delivery: IDelivery,
		directory: IDirectory,
		cipherSuite: CiphersuiteImpl,

		publicKeyPackage: KeyPackage,
		privateKeyPackage: PrivateKeyPackage,
		actor: Actor,
		generatorId: string,
	) {
		this.#controller = controller
		this.#database = database
		this.#delivery = delivery
		this.#directory = directory
		this.#cipherSuite = cipherSuite

		this.#actor = actor
		this.#generatorId = generatorId
		this.#publicKeyPackage = publicKeyPackage
		this.#privateKeyPackage = privateKeyPackage

		// Register our own identity↔key binding so ts-mls can validate our own leaf.
		this.#authService.register(publicKeyPackage.leafNode.signaturePublicKey, actor.id())
	}

	stop() {
		this.#publicKeyPackage = null as any
		this.#privateKeyPackage = null as any
		this.#actor = null as any
	}

	//////////////////////////////////////////
	// Group Management
	//////////////////////////////////////////

	// createGroup is an encoder hook that is called when an encrypted group is created.
	async createGroup(newMembers: string[]): Promise<Group> {

		const group = NewGroup("MLS")

		// Fetch KeyPackages for the new members and negotiate the best shared cipher suite.
		// const keyPackages = await this.#directory.getKeyPackages(newMembers)
		// ciphersuite = chooseCipherSuite(keyPackages, newMembers)

		// Generate a new clientState for this group
		const clientState = await createGroup({
			context: this.#context(),
			groupId: encodeText(group.id),
			keyPackage: this.#publicKeyPackage,
			privateKeyPackage: this.#privateKeyPackage,
		})

		// make an EncryptedGroup using the clientState
		const encryptedGroup = addClientState(group, clientState)

		// reset the group members based on the clientState
		await this.addGroupMembers(encryptedGroup, newMembers)

		// Save the EncryptedGroup
		await this.#database.saveGroup(encryptedGroup)

		// Cycle Encryption Keys
		await this.#cycleKeyPackages()

		// Success!
		return encryptedGroup
	}

	// getGroup locates the group for the specified ID
	// Groups must already exist for the MLS codec to function.
	async getGroup(groupId: string): Promise<Group> {
		const result = await this.#database.loadGroup(groupId)

		if (result == undefined) {
			throw new Error("Group not found for id: " + groupId)
		}

		return result
	}

	// getGroupMembers returns the list of member IDs for a given group
	getGroupMembers(group: EncryptedGroup): string[] {

		// Find all current clients in this group
		const leafNodes = getGroupMembers(group.clientState)

		// Extract the client's identity for each leaf node
		const members = leafNodes
			.map(leaf => {
				const credential = leaf.credential as CredentialBasic
				if (credential.identity != undefined) {
					return decodeText(credential.identity)
				}
				return ""
			})
			.filter((identity) => identity != "")

		// Remove duplicates (many users will have multiple clients)
		const result = [...new Set(members)]
		return result
	}

	// #registerGroupBindings records the identity↔key binding for every leaf in a group's ratchet
	// tree. ts-mls validates a sender's leaf credential DURING processMessage(), so this must run
	// BEFORE processing any inbound message — otherwise the binding would not yet be on record and
	// the (legitimate) sender would be rejected. The bindings originate from KeyPackages that were
	// KP2-validated when each member was added, so the tree is a trustworthy source.
	#registerGroupBindings(group: EncryptedGroup): void {
		for (const leaf of getGroupMembers(group.clientState)) {
			this.#authService.registerLeaf(leaf)
		}
	}

	// #getGroupSignatures retrieves all KeyPackage signatures from the group state.
	#getGroupSignatures(group: EncryptedGroup): Uint8Array[] {
		const leafNodes = getGroupMembers(group.clientState)
		const keyPackages = leafNodes.map(leafNode => leafNode.signature)
		return keyPackages.filter(keyPackage => keyPackage !== undefined)
	}

	// addGroupMembers updates the group state.  It sends a Commit
	// message to existing members, and a Welcome message to new members,
	async addGroupMembers(group: EncryptedGroup, newMembers: string[]): Promise<EncryptedGroup> {

		// Step 1: look up all KeyPackages published by the new members
		const currentMembers = group.members
		const signatures = this.#getGroupSignatures(group)

		let keyPackages = await this.#directory.getKeyPackages(newMembers)

		// Register each fetched member's identity↔key binding. getKeyPackages has already verified
		// (KP2) that each package's credential identity matches the actor it was fetched under, so
		// these bindings are trustworthy and let ts-mls validate these members' leaves.
		for (const keyPackage of keyPackages) {
			this.#authService.register(keyPackage.leafNode.signaturePublicKey, keyPackageIdentity(keyPackage))
		}

		// Filter out the KeyPackage for THIS device
		keyPackages = keyPackages.filter(keyPackage => !uint8ArrayEqual(keyPackage.signature, this.#publicKeyPackage.signature))

		// Filter out KeyPackages that are already in the group state (e.g. from another device of the same user)
		keyPackages = keyPackages.filter(keyPackage => !uint8ArraysContain(signatures, keyPackage.signature))

		// Filter out expired KeyPackages
		keyPackages = keyPackages.filter(keyPackage => !keyPackageIsExpired(keyPackage))

		// Only allow KeyPackages that match the ciphersuite for this group
		keyPackages = keyPackages.filter(kp => kp.cipherSuite === group.clientState.groupContext.cipherSuite)

		// Deduplicate KeyPackages per device
		keyPackages = deduplicateKeyPackages(keyPackages)

		// RULE: Must have at least one valid KeyPackage to add
		if (keyPackages.length == 0) {
			console.warn("addGroupMembers: 0 valid KeyPackages found for new members:", newMembers, "-- cannot add members to group")
			return group
		}

		// Create add proposals for each key package
		const addProposals: Proposal[] = keyPackages.map(keyPackage => ({
			proposalType: defaultProposalTypes.add,
			add: {
				keyPackage: keyPackage,
			},
		}))

		// Create commit with add proposals
		const commitResult = await createCommit({
			context: this.#context(),
			state: group.clientState,
			extraProposals: addProposals,
			ratchetTreeExtension: true,
		})

		// Zero out the keys used to encrypt the commit message
		commitResult.consumed.forEach(zeroOutUint8Array)

		// Update the group with new state and new list of members
		group.clientState = commitResult.newState
		group.members = this.getGroupMembers(group)
		await this.#database.saveGroup(group)

		// (async) Send welcome to new members
		if (commitResult.welcome != undefined) {
			void this.#sendMlsMessage(
				group,
				vocab.ObjectTypeMlsWelcome,
				newMembers,
				commitResult.welcome,
			)
		}

		// (async) Send commit to existing members
		if (currentMembers.length > 0) {
			void this.#sendMlsMessage(
				group,
				vocab.ObjectTypeMlsPrivateMessage,
				currentMembers,
				commitResult.commit,
			)
		}

		// Return the newly updated group
		return group
	}

	// leaveGroup sends a COMMIT that removes ALL OTHER DEVICES 
	// for this user from the group, then sends a PROPOSAL to 
	// remove THIS DEVICE from the group.
	async leaveGroup(group: EncryptedGroup): Promise<void> {

		// Remove all of "my" devices EXCEPT the current one...
		await this.removeGroupMember(group, this.#actor.id())

		// After my other devices have been removed, 
		// remove THIS device via a PROPOSAL that others will commit.

		// Find my leaf node in the ratchet tree
		const ownLeafIndex = group.clientState.privatePath.leafIndex

		// Create a proposal
		const proposal = await createProposal({
			context: this.#context(),
			state: group.clientState,
			proposal: {
				proposalType: defaultProposalTypes.remove,
				remove: { removed: ownLeafIndex },
			},
		})

		// Send a message to the group members
		void this.#sendMlsMessage(
			group,
			vocab.ObjectTypeMlsGroupInfo,
			group.members,
			proposal.message,
		)
	}

	// removeGroupMember removes all clients for the specified actorId. This function cannot be used
	// to remove the current signed-in actor; use leaveGroup() for this operation instead.
	async removeGroupMember(group: EncryptedGroup, actorId: string): Promise<void> {

		// inspect each node in the group's ratchetTree
		const proposals = group.clientState.ratchetTree.map((node, ratchetIndex) => {

			// Skip undefined nodes
			if (node == undefined) {
				return null
			}

			// RULE: Skip parent nodes
			if (node.nodeType != nodeTypes.leaf) {
				return null
			}

			// RULE: Can't remove THIS DEVICE from the group. Use leaveGroup() instead.
			const leafIndex = ratchetIndex / 2
			if (leafIndex == group.clientState.privatePath.leafIndex) {
				return null
			}

			// RULE: Guarantee that we're working with a basic credential (not X.509 or something else)
			if (node.leaf.credential.credentialType != defaultCredentialTypes.basic) {
				return null
			}

			// Get the credential and decode the identity
			const credential = node.leaf.credential as CredentialBasic
			const leafNodeActorId = decodeText(credential.identity)

			// If this leaf node doesn't match the specified actorId, then do nothing.
			if (leafNodeActorId != actorId) {
				return null
			}

			return {
				proposalType: defaultProposalTypes.remove,
				remove: { removed: leafIndex },
			}

		}).filter((proposal) => proposal != null)

		// Commit the proposals to remove the specified member
		// This MUST have an `await` so that the group is fully updated before exiting, or else leaveGroup() fails.
		await this.#commitProposals(group, proposals)
	}

	//////////////////////////////////////////
	// Sending Messages
	//////////////////////////////////////////

	// encodeMessage encrypts the provided message and returns the encrypted ActivityPub object.
	async encodeMessage(group: EncryptedGroup, message: Message): Promise<{}> {

		const object: Record<string, unknown> = {
			id: message.id,
			attributedTo: message.sender,
			type: vocab.ObjectTypeNote,
			to: group.members,
			context: group.id,
			content: message.content,
			attachment: message.attachments.map(attachment => attachmentToDocument(attachment)),
			published: new Date().toISOString(),
		}

		// RULE: Only emit "inReplyTo" when there is something to thread against. An empty
		// string is not a valid reference and confuses receiving servers (e.g. Mastodon).
		if (message.inReplyTo != "") {
			object.inReplyTo = message.inReplyTo
		}

		return object
	}

	// sendActivity encodes an Activity as an MLS message and sends it to all group members.
	// Returns "" because the server-assigned ID belongs to the MLS envelope, not the inner message.
	async sendActivity(group: EncryptedGroup, activity: Activity): Promise<string> {

		// Encrypt the message using MLS
		const messageText = activity.toJSON()
		const messageBytes = encodeText(messageText)
		const applicationMessage = await createApplicationMessage({
			context: this.#context(),
			state: group.clientState,
			message: messageBytes,
		})

		// Zero out the keys used to encrypt the message
		applicationMessage.consumed.forEach(zeroOutUint8Array)

		// update the Group with the new group state
		group.clientState = applicationMessage.newState

		// save the updated group
		await this.#database.saveGroup(group)

		// send the activity to all group members
		await this.#sendMlsMessage(
			group,
			vocab.ObjectTypeMlsPrivateMessage,
			activity.getArrayOfString("as", vocab.PropertyTo),
			applicationMessage.message,
		)

		return ""
	}

	// #sendMlsMessage is a private method that sends an MLS message via the user's ActivityPub outbox
	async #sendMlsMessage(group: EncryptedGroup, type: string, recipients: string[], message: MlsMessage) {


		// If there are no recipients to send to, just return early
		if (recipients.length === 0) {
			return
		}

		// Encode the private message as bytes, then to base64
		const contentBytes = encode(mlsMessageEncoder, message)
		const contentBase64 = bytesToBase64(contentBytes)

		// Create an ActivityPub activity for the private message
		const activity = new Activity({
			"@context": [vocab.ContextActivityStreams, vocab.ContextMLS],
			type: vocab.ActivityTypeCreate,
			actor: this.#actor.id(),
			to: recipients,
			instrument: this.#generatorId,
			context: group.id,
			object: {
				type: type,
				attributedTo: this.#actor.id(),
				to: recipients,
				content: contentBase64,
				context: group.id,
				mediaType: vocab.MediaTypeMLSMessage,
				encoding: vocab.EncodingTypeBase64,
			},
		})

		await this.#delivery.sendActivity(activity)

		return activity
	}


	//////////////////////////////////////////
	// Receiving Messages
	//////////////////////////////////////////

	// receiveActivity decodes an incoming MLS message and returns the decrypted ActivityStream.
	// If no further action is required (such as processing a GroupInfo or Welcome message) then
	// undefined is returned.
	async receiveActivity(activity: Activity): Promise<Activity | undefined> {


		// Expect the object to be embedded in the Activity (as MLS+ActivityPub requires)
		const object = activity.objectAsDocument()

		// Parse the message content
		const message = object.content()
		const uintArray = base64ToUint8Array(message)
		const mlsMessage = decode(mlsMessageDecoder, uintArray)

		// Require that the we have a valid decoded message before proceeding
		if (mlsMessage == undefined) {
			const firstBytes = Array.from(uintArray.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
			console.error("Unable to decode MLS message.")
			console.error("  object:", object.toJSON())
			console.error("  first 8 bytes (hex):", firstBytes, "-- expected: 00 01 00 0N (version=1, wireformat=1-5)")
			throw new Error("Unable to decode message: " + message)
		}

		// Execute the appropriate handler
		switch (mlsMessage.wireformat) {

			// A GroupInfo message requires no further action from the controller.
			case wireformats.mls_group_info:
				return undefined

			case wireformats.mls_key_package:
				return undefined

			case wireformats.mls_private_message:
				return await this.#receiveActivity_PublicPrivateMessage(object, mlsMessage)

			case wireformats.mls_public_message:
				return await this.#receiveActivity_PublicPrivateMessage(object, mlsMessage)

			case wireformats.mls_welcome:
				await this.#receiveActivity_Welcome(activity, mlsMessage)
				return undefined

			default:
				throw new Error("Unknown MLS message type: " + JSON.stringify(mlsMessage))
		}
	}

	// decodeMessage_Welcome processes MLS "Welcome" messages that add this user to a new group.
	async #receiveActivity_Welcome(activity: Activity, message: MlsWelcomeMessage): Promise<void> {

		let clientState: ClientState

		try {

			// Try to join the new group. ts-mls validates the entire (encrypted) ratchet tree
			// during this call, before we can see it, so run under bootstrap (trust-on-first-use):
			// the Welcome's authenticity is established by the private-key match checked below.
			clientState = await this.#authService.withBootstrap(() => joinGroup({
				context: this.#context(),
				welcome: message.welcome,
				keyPackage: this.#publicKeyPackage,
				privateKeys: this.#privateKeyPackage,
			}))

		} catch (error) {
			// Errors mean that the private keys probably don't match, so
			// this welcome wasn't intended for this device, so just quit.
			console.error("Unable to process welcome message", error)
			return
		}

		// RULE: Require that the private key signatures match before proceeding.
		// This guarantees that the welcome message was encrypted for THIS device.
		if (!uint8ArrayEqual(clientState.signaturePrivateKey, this.#privateKeyPackage.signaturePrivateKey)) {
			return
		}

		// Create a new group record
		const groupId = decodeText(clientState.groupContext.groupId)

		// Guarantee that we don't already have this group in our database.
		const previousGroup = await this.#database.loadGroup(groupId)
		if (previousGroup != undefined) {
			console.warn("Received welcome message for a group that already exists locally.")
			return
		}

		// Create a new EncryptedGroup
		const group = NewGroup("MLS")
		group.id = groupId
		group.createdById = activity.actorId()

		const encryptedGroup = addClientState(group, clientState)
		encryptedGroup.members = this.getGroupMembers(encryptedGroup)

		// Save the group to the database
		await this.#database.saveGroup(encryptedGroup)

		// Cycle the KeyPackage
		await this.#cycleKeyPackages()
	}

	// decodeMessage_PrivateMessage processes incoming MLS "Private Messages" that contain encrypted
	// application messages for this user.  These messages are decrypted and then processes as
	// ActivityStreams messages.
	async #receiveActivity_PublicPrivateMessage(document: Document, mlsMessage: MlsPublicMessage | MlsPrivateMessage): Promise<Activity | undefined> {

		let groupId: string


		switch (mlsMessage.wireformat) {

			case wireformats.mls_private_message:
				groupId = decodeText(mlsMessage.privateMessage.groupId)
				break

			case wireformats.mls_public_message:
				groupId = decodeText(mlsMessage.publicMessage.content.groupId)
				break

			default:
				console.error("Invalid message type for PrivateMessage decoder")
				return undefined
		}


		// Load the group from the database so we can get the current client state for decryption
		const group = await this.#database.loadGroup(groupId)

		if (group == undefined) {
			throw new Error("Received message for unknown group: " + groupId + ". This should be retried.")
		}


		// RULE: Cannot receive encrypted messages for unencrypted groups
		if (!groupIsEncrypted(group)) {
			console.warn("Received MLS-encrypted message for unencrypted group: " + groupId + ". This will NOT be retried.")
			return undefined
		}

		// RULE: Sender must be a member of the group
		if (!group.members.includes(document.attributedToId())) {
			console.warn("Received MLS message from a sender that is not a member of the group: " + document.toJSON() + ". This will NOT be retried.")
			return undefined
		}

		// RULE: Do not accept messages for closed groups
		if (group.stateId == "CLOSED") {
			return undefined
		}

		// Register every member's identity↔key binding from the group's ratchet tree BEFORE
		// processMessage validates the sender's leaf credential (see #registerGroupBindings).
		this.#registerGroupBindings(group)

		const _this = this // NOSONAR: typescript:S7740 (this is required to make the callback work correctly... IDK man.)

		// Decode the message using ts-mls
		let decodedMessage: Awaited<ReturnType<typeof processMessage>>

		decodedMessage = await processMessage({
			context: this.#context(),
			state: group.clientState,
			message: mlsMessage,
			callback: (message) => {
				return _this.#processMessageCallback(message, group)
			}
		})

		// If no action is taken, then do not write it to the group.
		if (decodedMessage.kind == "newState") {
			if (decodedMessage.actionTaken == "reject") {
				return undefined
			}
		}

		// Fall through means the message is accepted. Apply the new state to the group.
		// Zero out the keys used to decrypt the message
		decodedMessage.consumed.forEach(zeroOutUint8Array)

		// Update the group state
		group.clientState = decodedMessage.newState
		group.members = this.getGroupMembers(group)

		// If the current actor has been removed from the group, then close it permanently...
		if (!group.members.includes(this.#actor.id())) {
			group.stateId = "CLOSED"
			await this.#database.saveGroup(group)
			return undefined
		}

		// Save the updated group to the database
		await this.#database.saveGroup(group)

		// If this is not an application message, then there are no further actions to take.
		if (decodedMessage.kind != "applicationMessage") {
			return undefined
		}

		// Otherwise, this IS an application message, so return the decrypted JSON-LD to the controller.
		const plaintext = decodeText(decodedMessage.message)

		// Create a result object
		const result = new Activity().fromJSON(plaintext)

		// Force the context to be the group ID so malicious clients
		// can't spoof this and trick the controller into sending messages to the wrong group.
		result.setContext(group.id)

		// SECURITY: Bind the decrypted activity's actor (C) to the outer ActivityPub
		// attributedTo (A). These two attacker-authored identities MUST agree, which —
		// combined with HTTP-signature verification of A on the inbound envelope — prevents
		// a sender from attributing a message to a different actor.
		//
		// NOTE: The ideal check also binds both to (B) the MLS leaf credential identity of
		// the cryptographically-authenticated sender. ts-mls does not currently expose the
		// sender leaf index on application-message results, so B is deferred. See AGENTS.md.
		if (!senderIdentityMatches(result.actorId(), document.attributedToId())) {
			console.log("CodecMls.receiveActivity")
			console.log(result, document)
			throw new Error("CodecMls.receiveActivity: sender mismatch - decrypted actor '" + result.actorId() + "' does not match envelope attributedTo '" + document.attributedToId() + "'")
		}

		// Send Acknowledge message for certain kinds of activities. This is awaited so
		// its group save (advancing MLS state) completes before the controller updates
		// the group's lastMessage — otherwise a late-landing acknowledgement save would
		// clobber the freshly-received message's preview with the previous value.
		await this.#maybeSendAcknowledgement(group, result)

		// Continue processing the message in the controller.
		return result
	}

	async #maybeSendAcknowledgement(group: EncryptedGroup, activity: Activity): Promise<void> {

		// Only sent Acknowledgements for "Create" activities, which represent new messages.
		if (activity.type() !== vocab.ActivityTypeCreate) {
			return
		}

		// Acknowledge successful message received
		await this.sendActivity(group, new Activity({
			actor: this.#actor.id(),
			type: vocab.ActivityTypeAcknowledge,
			to: [activity.actorId()],
			object: activity.objectId(),
			context: group.id,
		}))
	}

	#processMessageCallback(message: incomingMessage, group: EncryptedGroup): IncomingMessageAction {

		if (message.kind == "commit") {
			return "accept"
		}

		const proposal = message.proposal.proposal as DefaultProposal

		// Otherwise, this is a proposal. Special rules for "remove" proposals...
		if (proposal.proposalType == defaultProposalTypes.remove) {

			const myLeafIndex = group.clientState.privatePath.leafIndex
			const waitMs = myLeafIndex * 1000 // Reduce collisions by waiting 0ms, 1000ms, 2000ms, 3000ms... 

			globalThis.setTimeout(() => {
				void this.#processMessageCallback_RemoveProposal(group.id, proposal)
			}, waitMs)
		}

		// Reject all proposals
		return "reject"
	}

	// #processMessageCallback_RemoveProposal is triggered when we receive a "remove" proposal (after a timeout based on our leaf index). 
	// This method checks commits the sender's proposal to the group IF they have not already been removed by another network node.
	async #processMessageCallback_RemoveProposal(groupId: string, proposal: ProposalRemove) {

		// Load the group from the database
		const group = await this.#database.loadGroup(groupId)

		if (group == undefined) {
			console.error("mls.#processMessageCallback_RemoveProposal: Unable to load group for remove proposal", groupId)
			return
		}

		// Guarantee that the group is encrypted
		if (!groupIsEncrypted(group)) {
			console.error("mls.#processMessageCallback_RemoveProposal: Received remove proposal for unencrypted group", groupId)
			return
		}

		const leafIndex = proposal.remove.removed

		// Exit if the sender has already been removed from the group (the ratchet tree
		// is sparse, so a removed leaf's slot is undefined).
		const ratchetTreeIndex = leafIndex * 2
		const deviceToRemove = group.clientState.ratchetTree[ratchetTreeIndex]

		if (deviceToRemove == undefined) {
			return
		}

		// Otherwise, continue removing the deviceToRemove and notifying the rest of the group.
		await this.#commitProposals(group, [proposal])
	}

	// commitProposals commits the specified proposals to the group state and sends the resulting commit message to the group members.
	async #commitProposals(group: EncryptedGroup, proposals: Proposal[]): Promise<void> {

		// Create a proper commit to remove this device
		const commitResult = await createCommit({
			context: this.#context(),
			state: group.clientState,
			extraProposals: proposals,
			ratchetTreeExtension: true,
		})

		// Zero out the keys used to encrypt the commit message
		commitResult.consumed.forEach(zeroOutUint8Array)

		// Update the group with new state and new list of members
		group.clientState = commitResult.newState

		// (async) Send commit to all members. Detached on purpose, but the rejection
		// is logged rather than left unhandled; the durable group state is saved below.
		void this.#sendMlsMessage(
			group,
			vocab.ObjectTypeMlsGroupInfo,
			group.members,
			commitResult.commit,
		).catch((error: unknown) => {
			console.error("Failed to send MLS commit to group members:", group.id, error)
		})

		// Recalculate the NEW list of members
		group.members = this.getGroupMembers(group)

		// Save the group to the database
		await this.#database.saveGroup(group)
	}


	//////////////////////////////////////////
	// Key Package Helpers
	//////////////////////////////////////////

	async #cycleKeyPackages(): Promise<void> {

		// Create a new KeyPackage for this device
		const keyPackage = await this.#controller.createOrUpdateKeyPackage()

		// Store the results.
		this.#publicKeyPackage = keyPackage.publicKeyPackage
		this.#privateKeyPackage = keyPackage.privateKeyPackage

		// Register the rotated key's binding. MLS may still validate our PREVIOUS leaf key for an
		// existing group, so register() keeps the old binding too — it never removes, only adds.
		this.#authService.register(keyPackage.publicKeyPackage.leafNode.signaturePublicKey, this.#actor.id())
	}


	//////////////////////////////////////////
	// Helper Methods
	//////////////////////////////////////////

	// #context returns an MlsContext with the current cipher suite and authentication service.
	#context(): MlsContext {
		return {
			cipherSuite: this.#cipherSuite,
			authService: this.#authService,
		}
	}
}


//////////////////////////////////////////
// CipherSuite Helper Functions
//////////////////////////////////////////

// chooseCipherSuite returns the cipher suite ID to use for a new group.
// It intersects the cipher suite IDs published by all actors, picks the highest-ranked
// algorithm from our preference list, and falls back to CIPHER_X25519_AES128.
export function chooseCipherSuite(candidates: KeyPackage[], actorIds: string[]): number {

	// Build a map of actor → set of cipher suite IDs they have KeyPackages for
	const actorCipherSuites = buildActorCipherSuiteMap(candidates)

	// Intersect all actors' cipher suite sets
	let commonSuites: Set<number> | undefined
	for (const actorId of actorIds) {
		const suites = actorCipherSuites.get(actorId)
		if (suites == undefined) {
			console.warn(`#chooseCipherSuite: No valid KeyPackages found for actor ${actorId}`)
			continue
		}
		commonSuites = (commonSuites == undefined)
			? new Set(suites)
			: new Set([...commonSuites].filter(id => suites.has(id)))
	}

	// Pick the highest-ranked algorithm from our preference list that all actors support
	if (commonSuites != undefined) {
		for (const algorithm of algorithms) {
			if (commonSuites.has(algorithm.id)) {
				return algorithm.id
			}
		}
	}

	// Fall back to the provided default
	return CIPHER_X25519_AES128
}


// buildActorCipherSuiteMap builds a map of actor ID → set of cipher suite IDs
// for which that actor has published valid KeyPackages.
export function buildActorCipherSuiteMap(candidates: KeyPackage[]): Map<string, Set<number>> {
	const result = new Map<string, Set<number>>()

	for (const kp of candidates) {
		const credential = kp.leafNode.credential as CredentialBasic

		// Skip KeyPackages that don't carry an actor identity in their credential
		if (credential.identity == undefined) {
			continue
		}

		// Skip KeyPackages whose cipher suite isn't in our supported algorithm list
		if (!algorithms.some(a => a.id === kp.cipherSuite)) {
			continue
		}

		// Decode the actor ID and add this cipher suite ID to their set
		const actorId = decodeText(credential.identity)
		if (!result.has(actorId)) {
			result.set(actorId, new Set())
		}

		result.get(actorId)!.add(kp.cipherSuite)
	}

	return result
}

// deduplicateKeyPackages returns one KeyPackage per unique device (signaturePublicKey),
// choosing the one with the latest notAfter when multiple packages exist for the same device.
export function deduplicateKeyPackages(candidates: KeyPackage[]): KeyPackage[] {

	// Map from hex-encoded signaturePublicKey → the best KeyPackage seen so far for that device.
	// signaturePublicKey is the stable identifier for a single device across all its KeyPackages.
	const best = new Map<string, KeyPackage>()

	for (const kp of candidates) {

		// Convert the device's signing key to a hex string so it can be used as a Map key
		const deviceKey = Array.from(kp.leafNode.signaturePublicKey, b => b.toString(16).padStart(2, '0')).join('')

		const existing = best.get(deviceKey)
		if (existing == undefined) {
			// First KeyPackage seen for this device — accept it unconditionally
			best.set(deviceKey, kp)
			continue
		}

		// A KeyPackage with no lifetime is treated as already-expired (notAfter = 0),
		// so any package with a real lifetime will displace it.
		const existingNotAfter = existing.leafNode.lifetime?.notAfter ?? 0n
		const candidateNotAfter = kp.leafNode.lifetime?.notAfter ?? 0n

		// Keep the KeyPackage that stays valid the longest
		if (candidateNotAfter > existingNotAfter) {
			best.set(deviceKey, kp)
		}
	}

	return [...best.values()]
}


//////////////////////////////////////////
// Other Helper Functions
//////////////////////////////////////////

// incomingMessage is a type that is passed to an IncomingMessageCallback function.
type incomingMessage = incomingCommit | incomingProposal

type incomingProposal = {
	kind: "proposal";
	proposal: ProposalWithSender;
}

type incomingCommit = {
	kind: "commit";
	senderLeafIndex: LeafIndex | undefined;
	proposals: ProposalWithSender[];
}

// encodeText is a shorthand for using the ts-mls TextEncoder
export function encodeText(text: string) {
	return new TextEncoder().encode(text)
}

// decodeText is a shorthand for using the ts-mls TextDecoder.
export function decodeText(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes)
}

// senderIdentityMatches reports whether the actor (C) named inside a decrypted MLS
// application message matches the actor (A) named in the outer ActivityPub envelope's
// "attributedTo". Both values are attacker-authored, so they MUST agree before a message
// is trusted; the envelope identity (A) is independently authenticated by HTTP signatures.
// An empty identity on either side is treated as a non-match (never trusted).
//
// NOTE: This does not yet bind to (B) the MLS leaf credential identity of the
// cryptographically-authenticated sender — that check is deferred pending ts-mls support.
// See AGENTS.md.
export function senderIdentityMatches(decryptedActorId: string, envelopeAttributedToId: string): boolean {

	if (decryptedActorId == "" || envelopeAttributedToId == "") {
		return false
	}

	return decryptedActorId == envelopeAttributedToId
}

// addClientState is a shorthand to map a Group -> EncryptedGroup
function addClientState(group: Group, clientState: ClientState): EncryptedGroup {
	return {
		...group,
		clientState: clientState,
	}
}

