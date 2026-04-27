// MLS functions
import { bytesToBase64, getOwnLeafNode, leafNodeSources, nodeTypes, type DefaultProposal, type IncomingMessageAction, type LeafIndex, type NodeLeaf, type ProposalRemove, type ProposalWithSender } from "ts-mls"
import { createProposal } from "ts-mls"
import { defaultCredentialTypes } from "ts-mls"
import { createApplicationMessage } from "ts-mls"
import { createCommit } from "ts-mls"
import { createGroup } from "ts-mls"
import { decode } from "ts-mls"
import { defaultProposalTypes } from "ts-mls"
import { encode } from "ts-mls"
import { getGroupMembers } from "ts-mls"
import { joinGroup } from "ts-mls"
import { mlsMessageDecoder } from "ts-mls"
import { mlsMessageEncoder } from "ts-mls"
import { processMessage } from "ts-mls"
import { unsafeTestingAuthenticationService } from "ts-mls"
import { wireformats } from "ts-mls"
import { zeroOutUint8Array } from "ts-mls"

// MLS Types
import { type CiphersuiteImpl } from "ts-mls"
import { type ClientState } from "ts-mls"
import { type CredentialBasic } from "ts-mls"
import { type KeyPackage } from "ts-mls"
import { type LeafNode } from "ts-mls"
import { type Node } from "ts-mls"
import { type MlsContext } from "ts-mls"
import { type MlsGroupInfo } from "ts-mls"
import { type MlsMessage } from "ts-mls"
import { type MlsPublicMessage } from "ts-mls"
import { type MlsPrivateMessage } from "ts-mls"
import { type MlsWelcomeMessage } from "ts-mls"
import { type Proposal } from "ts-mls"
import { type PrivateKeyPackage } from "ts-mls"

// ActivityPub Types
import { Actor } from "../as/actor"
import { Activity } from "../as/activity"
import { Document } from "../as/document"
import * as vocab from "../as/vocab"

// Application Types
import { type EncryptedGroup } from "../model/group"
import { type Group } from "../model/group"
import { NewGroup } from "../model/group"

import { type IController } from "./interfaces"
import { type IDatabase } from "./interfaces"
import { type IDelivery } from "./interfaces"
import { type IDirectory } from "./interfaces"
import { groupIsEncrypted } from "../model/group"

import { uint8ArrayEqual, uint8ArraysContain } from "./utils"
import { base64ToUint8Array, newId } from "./utils"

const cipherSuiteName = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"

// MLS service encrypts/decrypts messages using the MLS protocol.
// This is intended to be a reusable service that could be called
// by any software component that needs to use MLS-encrypted messages.
export class MLS {
	#controller: IController
	#database: IDatabase
	#delivery: IDelivery
	#directory: IDirectory
	#cipherSuite: CiphersuiteImpl

	#keyPackageId: string
	#publicKeyPackage: KeyPackage
	#privateKeyPackage: PrivateKeyPackage
	#generatorId: string
	#actor: Actor


	constructor(
		controller: IController,
		database: IDatabase,
		delivery: IDelivery,
		directory: IDirectory,
		cipherSuite: CiphersuiteImpl,

		keyPackageId: string,
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
		this.#keyPackageId = keyPackageId
		this.#publicKeyPackage = publicKeyPackage
		this.#privateKeyPackage = privateKeyPackage
	}

	stop = () => {
		this.#publicKeyPackage = null as any
		this.#privateKeyPackage = null as any
		this.#actor = null as any
	}

	//////////////////////////////////////////
	// Group Management
	//////////////////////////////////////////

	// createGroup is an encoder hook that is called when an encrypted group is created.
	async createGroup(group: Group): Promise<EncryptedGroup> {

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
		await this.addGroupMembers(encryptedGroup, [this.#actor.id()])

		// Save the EncryptedGroup
		await this.#database.saveGroup(encryptedGroup)

		// Cycle Encryption Keys
		await this.#cycleKeyPackages()

		// Success!
		return encryptedGroup
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

	// #getGroupSignatures retrieves all KeyPackage signatures from the group state.
	#getGroupSignatures(group: EncryptedGroup): Uint8Array<ArrayBufferLike>[] {
		const leafNodes = getGroupMembers(group.clientState)
		const keyPackages = leafNodes.map(leafNode => leafNode.signature)
		return keyPackages.filter(keyPackage => keyPackage !== undefined)
	}

	// addGroupMembers updates the group state.  It sends a Commit
	// message to existing members, and a Welcome message to new members,
	async addGroupMembers(group: EncryptedGroup, newMembers: string[]): Promise<EncryptedGroup> {

		// Look up all KeyPackages for the new Members
		const currentMembers = group.members
		var addKeyPackages = await this.#directory.getKeyPackages(newMembers)

		// Filter out the KeyPackage for THIS device
		addKeyPackages = addKeyPackages.filter(keyPackage => !uint8ArrayEqual(keyPackage.signature, this.#publicKeyPackage.signature))

		// Filter out KeyPackages that are already in the group state (e.g. from another device of the same user)
		const signatures = this.#getGroupSignatures(group)
		addKeyPackages = addKeyPackages.filter(keyPackage => !uint8ArraysContain(signatures, keyPackage.signature))

		// RULE: Must have at least one valid KeyPackage to add
		if (addKeyPackages.length == 0) {
			return group
		}

		// Create add proposals for each key package
		const addProposals: Proposal[] = addKeyPackages.map(newKeyPackage => ({
			proposalType: defaultProposalTypes.add,
			add: {
				keyPackage: newKeyPackage,
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

		// Send welcome to new members
		if (commitResult.welcome != undefined) {
			this.#sendMlsMessage(
				vocab.ObjectTypeMlsWelcome,
				newMembers,
				commitResult.welcome,
				"welcome: " + newMembers.join(", ")
			)
		}

		// (async) Send commit to existing members
		if (currentMembers.length > 0) {
			this.#sendMlsMessage(
				vocab.ObjectTypeMlsGroupInfo,
				currentMembers,
				commitResult.commit,
				"add members: " + newMembers.join(", ")
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
		await this.#sendMlsMessage(
			vocab.ObjectTypeMlsGroupInfo,
			group.members,
			proposal.message,
			"leave group:" + this.#actor.id()
		)
	}

	// removeGroupMember removes all clients for the specified actorId. This function cannot be used
	// to remove the current signed-in actor; use leaveGroup() for this operation instead.
	async removeGroupMember(group: EncryptedGroup, actorId: string): Promise<void> {

		// inspect each node in the group's ratchetTree
		var proposals = group.clientState.ratchetTree.map((node, ratchetIndex) => {

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
			} as Proposal

		}).filter((proposal) => proposal != null)

		// Commit the proposals to remove the specifid member
		// This MUST have an `await` so that the group is fully updated before exiting, or else leaveGroup() fails.
		await this.#commitProposals(group, proposals, "remove member: " + actorId)
	}


	//////////////////////////////////////////
	// Key Packages
	//////////////////////////////////////////

	async #cycleKeyPackages(): Promise<void> {

		// Create a new KeyPackage for this device
		const dbKeyPackage = await this.#controller.createOrUpdateKeyPackage()

		// Store the results.
		this.#publicKeyPackage = dbKeyPackage.publicKeyPackage
		this.#privateKeyPackage = dbKeyPackage.privateKeyPackage
	}

	//////////////////////////////////////////
	// Receiving Messages
	//////////////////////////////////////////

	// receiveActivity decodes an incoming MLS message and returns the decrypted ActivityStream.
	// If no further action is required (such as processing a GroupInfo or Welcome message) then
	// null is returned.
	async receiveActivity(activity: Activity, object: Document): Promise<Activity | null> {

		const message = object.content()
		const uintArray = base64ToUint8Array(message)
		const mlsMessage = decode(mlsMessageDecoder, uintArray)!

		// Require that the we have a valid decoded message before proceeding
		// TODO: Here's where we send a "Failure" message to the group.
		if (mlsMessage == undefined) {
			throw new Error("Unable to decode message: " + message)
			return null
		}

		// Execute the appropriate handler
		switch (mlsMessage.wireformat) {

			case wireformats.mls_group_info:
				return await this.#receiveActivity_GroupInfo(object, mlsMessage)

			case wireformats.mls_key_package:
				return null

			case wireformats.mls_private_message:
				return await this.#receiveActivity_PublicPrivateMessage(object, mlsMessage)

			case wireformats.mls_public_message:
				return await this.#receiveActivity_PublicPrivateMessage(object, mlsMessage)

			case wireformats.mls_welcome:
				return await this.#receiveActivity_Welcome(mlsMessage)

			default:
				throw new Error("Unknown MLS message type: " + JSON.stringify(mlsMessage))
		}
	}


	// decodeMessage_Welcome processes MLS "Welcome" messages that add this user to a new group.
	async #receiveActivity_Welcome(message: MlsWelcomeMessage): Promise<null> {

		var clientState: ClientState

		try {

			// Try to join the new group
			clientState = await joinGroup({
				context: this.#context(),
				welcome: message.welcome,
				keyPackage: this.#publicKeyPackage,
				privateKeys: this.#privateKeyPackage,
			})

		} catch (error) {
			// Errors mean that the private keys probably don't match, so
			// this welcome wasn't intended for this device, so just quit.
			console.error("Unable to process welcome message", error)
			return null
		}

		// RULE: Require that the private key signatures match before proceeding.
		// This guarantees that the welcome message was encrypted for THIS device.
		if (!uint8ArrayEqual(clientState.signaturePrivateKey, this.#privateKeyPackage.signaturePrivateKey)) {
			return null
		}

		// Create a new group record
		const groupId = decodeText(clientState.groupContext.groupId)

		// Guarantee that we don't already have this group in our database.
		const previousGroup = await this.#database.loadGroup(groupId)
		if (previousGroup != undefined) {
			console.warn("Received welcome message for a group that already exists locally.")
			return null
		}

		// Create a new EncryptedGroup
		const group = NewGroup()
		group.id = groupId

		var encryptedGroup = addClientState(group, clientState)
		encryptedGroup.members = this.getGroupMembers(encryptedGroup)

		// Save the group to the database
		await this.#database.saveGroup(encryptedGroup)

		// Cycle the KeyPackage
		await this.#cycleKeyPackages()

		// Returning `null` means that the controller won't take 
		// any additional actions to process this message.
		return null
	}

	// decodeMessage_GroupInfo processes MLS "GroupInfo" messages that add this user to a new group.
	async #receiveActivity_GroupInfo(document: Document, message: MlsGroupInfo) {

		var clientState: ClientState

		// Returning `null` means that the controller won't take 
		// any additional actions to process this message.
		return null
	}

	// decodeMessage_PrivateMessage processes incoming MLS "Private Messages" that contain encrypted
	// application messages for this user.  These messages are decrypted and then processes as
	// ActivityStreams messages.
	async #receiveActivity_PublicPrivateMessage(document: Document, mlsMessage: MlsPublicMessage | MlsPrivateMessage): Promise<Activity | null> {

		var groupId: string

		console.log("################ mls.#receiveActivity_PublicPrivateMessage: Received message", document.toObject())

		switch (mlsMessage.wireformat) {

			case wireformats.mls_private_message:
				groupId = decodeText(mlsMessage.privateMessage.groupId)
				break

			case wireformats.mls_public_message:
				groupId = decodeText(mlsMessage.publicMessage.content.groupId)
				break

			default:
				console.error("Invalid message type for PrivateMessage decoder")
				return null
		}


		// Load the group from the database so we can get the current client state for decryption
		const group = await this.#database.loadGroup(groupId)

		if (group == undefined) {
			console.error("Received message for unknown group", groupId)
			return null
		}

		// RULE: Cannot receive encrypted messages for unencrypted groups
		if (!groupIsEncrypted(group)) {
			throw new Error("Cannot receive MLS-encrypted messages for unencrypted group")
		}

		// RULE: Sender must be a member of the group
		if (!group.members.includes(document.attributedToId())) {
			throw new Error("Received MLS message from a sender that is not a member of the group: " + document.toJSON())
		}

		// RULE: Do not accept messages for closed groups
		if (group.stateId == "CLOSED") {
			return null
		}

		console.log("mls.#receiveActivity_PublicPrivateMessage: group epoch:", group.clientState.groupContext.epoch)

		const _this = this

		// Decode the message using ts-mls
		const decodedMessage = await processMessage({
			context: this.#context(),
			state: group.clientState,
			message: mlsMessage,
			callback: (message) => {
				return _this.#processMessageCallback(message, group)
			}
		})

		console.log("mls.#receiveActivity_PublicPrivateMessage: Decoded message:", decodedMessage)

		// If no action is taken, then do not write it to the group.
		if (decodedMessage.kind == "newState") {
			if (decodedMessage.actionTaken == "reject") {
				console.log("mls.#receiveActivity_PublicPrivateMessage: 'Rejected' message based on callback rules. No state changes applied to the group.")
				return null
			}
		}

		// Fall through means the message is accepted. Apply the new state to the group.
		// Zero out the keys used to decrypt the message
		decodedMessage.consumed.forEach(zeroOutUint8Array)

		// Update the group state
		group.clientState = decodedMessage.newState
		group.updateDate = Date.now()
		group.members = this.getGroupMembers(group)

		// If the current actor has been removed from the group, then close it permanently...
		if (!group.members.includes(this.#actor.id())) {
			group.stateId = "CLOSED"
			await this.#database.saveGroup(group)
			return null
		}

		// Save the updated group to the database
		await this.#database.saveGroup(group)
		console.log("mls.#receiveActivity_PublicPrivateMessage: Updated group. epoch:", group.clientState.groupContext.epoch)
		console.log("mls.#receiveActivity_PublicPrivateMessage: Updated group members:", group.members)

		// If this is not an application message, then there are no further actions to take.
		if (decodedMessage.kind != "applicationMessage") {
			return null
		}

		// Otherwise, this IS an application message, so return the decrypted JSON-LD to the controller.
		const plaintext = decodeText(decodedMessage.message)

		// Create a result object and embed additional context data
		return new Activity().fromJSON(plaintext)
	}

	#processMessageCallback(message: incomingMessage, group: EncryptedGroup): IncomingMessageAction {

		// TODO: Rollback "remove" commits IF we've also committed a "remove" proposal 
		// for the same leaf AND the sender has a lower leaf index than us.
		if (message.kind == "commit") {
			return "accept"
		}

		const proposal = message.proposal.proposal as DefaultProposal

		// Otherwise, this is a proposal. Special rules for "remove" proposals...
		if (proposal.proposalType == defaultProposalTypes.remove) {

			console.log("mls.#processMessageCallback: Received remove proposal. Delaying commit based on leaf index to reduce collisions.")

			const myLeafIndex = group.clientState.privatePath.leafIndex
			const waitMs = myLeafIndex * 1000 // Reduce collisions by waiting 0ms, 1000ms, 2000ms, 3000ms... 

			console.log("myLeafIndex:", myLeafIndex)
			console.log("waiting ms:", waitMs)
			console.log("epoch:", group.clientState.groupContext.epoch)

			window.setTimeout(() => {
				console.log("mls.#processMessageCallback: Finished waiting. Processing remove proposal now....")
				this.#processMessageCallback_RemoveProposal(group.id, proposal)
			}, waitMs)
		}

		// Reject all proposals
		return "reject"
	}

	// #processMessageCallback_RemoveProposal is triggered when we receive a "remove" proposal (after a timeout based on our leaf index). 
	// This method checks commits the sender's proposal to the group IF they have not already been removed by another network node.
	async #processMessageCallback_RemoveProposal(groupId: string, proposal: ProposalRemove) {

		// Load the group from the database
		var group = await this.#database.loadGroup(groupId)

		if (group == undefined) {
			console.error("mls.#processMessageCallback_RemoveProposal: Unable to load group for remove proposal", groupId)
			return
		}

		// Guarantee tha the group is encrypted
		if (!groupIsEncrypted(group)) {
			console.error("mls.#processMessageCallback_RemoveProposal: Received remove proposal for unencrypted group", groupId)
			return
		}

		console.log("mls.#processMessageCallback_RemoveProposal: Processing 'remove myself' proposal", proposal)
		console.log("mls.#processMessageCallback_RemoveProposal: group: ", group.clientState)

		const leafIndex = proposal.remove.removed

		// Exit if the sender has already been removed from the group
		const ratchetTreeIndex = leafIndex * 2
		const deviceToRemove = group.clientState.ratchetTree[ratchetTreeIndex] as NodeLeaf

		if (deviceToRemove == undefined) {
			console.log("mls.#processMessageCallback_RemoveProposal: Proposal deviceToRemove has already been removed from the group.")
			return
		}
		const credential = deviceToRemove.leaf.credential as CredentialBasic

		console.log("mls.#processMessageCallback_RemoveProposal: deviceToRemove ", deviceToRemove, decodeText(credential.identity))

		// Otherwise, continue removing the deviceToRemove and notifying the rest of the group.
		console.log("mls.#processMessageCallback_RemoveProposal: Committing 'remove myself' proposal to other group members.", proposal)
		await this.#commitProposals(group, [proposal], "Async process self-removal proposal for " + leafIndex)
	}


	//////////////////////////////////////////
	// Sending Messages
	//////////////////////////////////////////

	// sendActivity encodes an Activity as an MLS message and sends it to 
	// updated as a result of this message.
	async sendActivity(group: EncryptedGroup, activity: Activity | { [key: string]: any }, debug?: any) {

		// If not already, wrap Objects in an Activity.
		if (!(activity instanceof Activity)) {
			activity = new Activity(activity)
		}

		console.log("mls.sendActivity: ", activity.toObject())

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
		group.updateDate = Date.now()
		console.log("mls.sendActivity: Created message. epoch:", group.clientState.groupContext.epoch)

		// save the updated group
		await this.#database.saveGroup(group)

		// send the activity to all group members
		return await this.#sendMlsMessage(
			vocab.ObjectTypeMlsPrivateMessage,
			activity.getArray("as", vocab.PropertyTo),
			applicationMessage.message,
			debug,
		)
	}

	// commitProposals commits the specified proposals to the group state and sends the resulting commit message to the group members.
	async #commitProposals(group: EncryptedGroup, proposals: Proposal[], debug?: string): Promise<void> {

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
		console.log("mls.#commitProposals. previous epoch", group.clientState.groupContext.epoch)
		group.clientState = commitResult.newState
		console.log("mls.#commitProposals. new epoch", group.clientState.groupContext.epoch)

		// (async) Send commit to all members
		this.#sendMlsMessage(
			vocab.ObjectTypeMlsGroupInfo,
			group.members,
			commitResult.commit,
			debug,
		)

		// Recalculate the NEW list of members
		group.members = this.getGroupMembers(group)

		// Save the group to the database
		await this.#database.saveGroup(group)
		console.log("#commitProposals. Group saved:", group)
	}

	// #sendMlsMessage is a private method that sends an MLS message via the user's ActivityPub outbox
	async #sendMlsMessage(type: string, recipients: string[], message: MlsMessage, debug?: any) {

		// If there are no recipients to send to, just return early
		if (recipients.length === 0) {
			return
		}

		if (debug == undefined) {
			debug = "MLS message: " + type
		}

		// Encode the private message as bytes, then to base64
		const contentBytes = encode(mlsMessageEncoder, message)
		const contentBase64 = bytesToBase64(contentBytes)

		// Create an ActivityPub activity for the private message
		const activity = new Activity({
			"@context": [vocab.ContextActivityStreams, { mls: vocab.ContextMLS }],
			type: vocab.ActivityTypeCreate,
			actor: this.#actor.id(),
			to: recipients,
			instrument: this.#generatorId,
			debug: debug,
			object: {
				type: type,
				attributedTo: this.#actor.id(),
				to: recipients,
				content: contentBase64,
				mediaType: vocab.MediaTypeMLSMessage,
				"mls:encoding": vocab.EncodingTypeBase64,
			},
		})

		this.#delivery.sendActivity(activity)

		return activity
	}


	//////////////////////////////////////////
	// Helpers
	//////////////////////////////////////////

	// #context returns an MlsContext with the current cipher suite and authentication service.
	#context(): MlsContext {
		return {
			cipherSuite: this.#cipherSuite,
			authService: unsafeTestingAuthenticationService,
		}
	}
}


//////////////////////////////////////////
// Helpers
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
function encodeText(text: string) {
	return new TextEncoder().encode(text)
}

// decodeText is a shorthand for using the ts-mls TextDecoder.
function decodeText(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes)
}

// addClientState is a shorthand to map a Group -> EncryptedGroup
function addClientState(group: Group, clientState: ClientState): EncryptedGroup {
	return {
		...group,
		clientState: clientState,
	}
}
