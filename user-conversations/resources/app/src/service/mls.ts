// MLS functions
import { bytesToBase64, defaultCredentialTypes, getOwnLeafNode, processPrivateMessage, type MlsGroupInfo, type MlsMessage, type MlsPublicMessage } from "ts-mls"
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
import { type MlsContext } from "ts-mls"
import { type MlsPrivateMessage } from "ts-mls"
import { type MlsWelcomeMessage } from "ts-mls"
import { type Proposal } from "ts-mls"
import { type PrivateKeyPackage } from "ts-mls"

// ActivityPub Types
import { Actor } from "../as/actor"
import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"

// Application Types
import { type EncryptedGroup } from "../model/group"
import { type Group } from "../model/group"
import { NewGroup } from "../model/group"

import { type IDatabase } from "./interfaces"
import { type IDelivery } from "./interfaces"
import { type IDirectory } from "./interfaces"
import { groupIsEncrypted } from "../model/group"

import { uint8ArrayEqual, uint8ArraysContain } from "./utils"
import { base64ToUint8Array, newId } from "./utils"

interface IReceiver {
	poll(): void
}

const cipherSuiteName = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"

// MLS service encrypts/decrypts messages using the MLS protocol.
// This is intended to be a reusable service that could be called
// by any software component that needs to use MLS-encrypted messages.
export class MLS {
	#database: IDatabase
	#delivery: IDelivery
	#directory: IDirectory
	#cipherSuite: CiphersuiteImpl
	#privateKeyPackage: PrivateKeyPackage
	#generatorId: string
	#actor: Actor

	publicKeyPackage: KeyPackage

	constructor(
		database: IDatabase,
		delivery: IDelivery,
		directory: IDirectory,

		cipherSuite: CiphersuiteImpl,
		publicKeyPackage: KeyPackage,
		privateKeyPackage: PrivateKeyPackage,
		actor: Actor,
		generatorId: string,
	) {
		this.#database = database
		this.#delivery = delivery
		this.#directory = directory

		this.#actor = actor
		this.#generatorId = generatorId
		this.#cipherSuite = cipherSuite
		this.publicKeyPackage = publicKeyPackage
		this.#privateKeyPackage = privateKeyPackage
	}

	stop = () => {
		this.publicKeyPackage = null as any
		this.#privateKeyPackage = null as any
		this.#actor = null as any
	}

	//////////////////////////////////////////
	// Group Management
	//////////////////////////////////////////

	// createGroup is an encoder hook that is called when an encrypted group is created.
	createGroup = async (group: Group): Promise<EncryptedGroup> => {

		// Generate a new clientState for this group
		const clientState = await createGroup({
			context: this.#context(),
			groupId: encodeText(group.id),
			keyPackage: this.publicKeyPackage,
			privateKeyPackage: this.#privateKeyPackage,
		})

		// make an EncryptedGroup using the clientState
		const encryptedGroup = addClientState(group, clientState)

		// reset the group members based on the clientState
		await this.addGroupMembers(encryptedGroup, [this.#actor.id()])

		// Save the EncryptedGroup
		await this.#database.saveGroup(encryptedGroup)

		// Success!
		return encryptedGroup
	}

	// getGroupMembers returns the list of member IDs for a given group
	getGroupMembers = (group: EncryptedGroup): string[] => {

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
		return [...new Set(members)]
	}

	#getGroupSignatures = (group: EncryptedGroup): Uint8Array<ArrayBufferLike>[] => {
		const leafNodes = getGroupMembers(group.clientState)
		const keyPackages = leafNodes.map(leafNode => leafNode.signature)
		return keyPackages.filter(keyPackage => keyPackage !== undefined)
	}

	// addGroupMembers updates the group state.  It sends a Commit
	// message to existing members, and a Welcome message to new members,
	addGroupMembers = async (group: EncryptedGroup, newMembers: string[]): Promise<EncryptedGroup> => {

		// Look up all KeyPackages for the new Members
		const currentMembers = group.members
		var addKeyPackages = await this.#directory.getKeyPackages(newMembers)

		// Filter out the KeyPackage for THIS device
		addKeyPackages = addKeyPackages.filter(keyPackage => !uint8ArrayEqual(keyPackage.signature, this.publicKeyPackage.signature))

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
			)
		}

		// (async) Send commit to existing members
		if (currentMembers.length > 0) {
			this.#sendMlsMessage(
				vocab.ObjectTypeMlsGroupInfo,
				currentMembers,
				commitResult.commit,
			)
		}

		// Return the newly updated group
		return group
	}

	async removeGroupMember(group: EncryptedGroup, actorId: string): Promise<EncryptedGroup> {

		// Find all current clients in this group 
		const leafNodes = getGroupMembers(group.clientState)

		while (true) {

			// Find the first leaf node that matches the specified actorId
			const removeIndex = leafNodes.findIndex(leafNodeMatches(actorId))

			// If there are no more matching nodes to remove, then we're done.
			if (removeIndex === -1) {
				break
			}

			// Create a commit with remove proposals
			const commitResult = await createCommit({
				context: this.#context(),
				state: group.clientState,
				extraProposals: [{
					proposalType: defaultProposalTypes.remove,
					remove: { removed: removeIndex },
				}],
				ratchetTreeExtension: true,
			})

			// Zero out the keys used to encrypt the commit message
			commitResult.consumed.forEach(zeroOutUint8Array)

			// Send commit to all members
			await this.#sendMlsMessage(
				vocab.ObjectTypeMlsGroupInfo,
				group.members,
				commitResult.commit,
			)

			// Update the group with new state and new list of members
			group.clientState = commitResult.newState
			group.members = group.members.filter((member) => member !== actorId)
			await this.#database.saveGroup(group)
		}

		// Return the updated group (sans-actor)
		return group
	}

	// leaveGroup removes ALL CLIENTS for this user from this group and generates
	// a new commit that is sent to the remaining members of the group.
	async leaveGroup(group: EncryptedGroup): Promise<void> {

		// Find all clients for this user in the group
		const proposals = getGroupMembers(group.clientState)
			.filter(leafNodeMatches(this.#actor.id()))
			.map((_client, index) => {
				return {
					proposalType: defaultProposalTypes.remove,
					remove: { removed: index },
				} as Proposal
			})

		// Commit the remove proposals to generate a new group state.
		const commitResult = await createCommit({
			context: this.#context(),
			state: group.clientState,
			extraProposals: proposals,
			ratchetTreeExtension: true,
		})

		// Save the group with the new state
		await this.#database.saveGroup(group)

		// Send a message to the group members
		await this.#sendMlsMessage(
			vocab.ObjectTypeMlsGroupInfo,
			group.members,
			commitResult.commit,
		)
	}

	//////////////////////////////////////////
	// Receiving Messages
	//////////////////////////////////////////

	// use arrow function to preserve "this" context when passing as a callback
	async decodeMessage(message: string): Promise<Activity | null> {

		try {
			const uintArray = base64ToUint8Array(message)
			const content = decode(mlsMessageDecoder, uintArray)!

			// Require that the we have a valid decoded message before proceeding
			// TODO: Here's where we send a "Failure" message to the group.
			if (content == undefined) {
				console.error("Unable to decode MLS message", message)
				return null
			}

			switch (content.wireformat) {

				case wireformats.mls_group_info:
					return await this.#decodeMessage_GroupInfo(content)

				case wireformats.mls_key_package:
					return null

				case wireformats.mls_private_message:
					return await this.#decodeMessage_PublicPrivateMessage(content)

				case wireformats.mls_public_message:
					return await this.#decodeMessage_PublicPrivateMessage(content)

				case wireformats.mls_welcome:
					return await this.#decodeMessage_Welcome(content)

				default:
					console.error("Unknown MLS message type:")
					return null
			}
		} catch (error) {
			console.error("Error decoding MLS message::::", error)
			return null
		}
	}

	// decodeMessage_Welcome processes MLS "Welcome" messages that add this user to a new group.
	async #decodeMessage_Welcome(message: MlsWelcomeMessage): Promise<null> {

		var clientState: ClientState

		try {

			// Try to join the new group
			clientState = await joinGroup({
				context: this.#context(),
				welcome: message.welcome,
				keyPackage: this.publicKeyPackage,
				privateKeys: this.#privateKeyPackage,
			})

		} catch (e) {
			// Errors mean that the private keys probably don't match, so
			// this welcome wasn't intended for this device, so just quit.
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

		// Returning `null` means that the controller won't take 
		// any additional actions to process this message.
		return null
	}

	// decodeMessage_GroupInfo processes MLS "GroupInfo" messages that add this user to a new group.
	async #decodeMessage_GroupInfo(message: MlsGroupInfo) {

		var clientState: ClientState

		// Returning `null` means that the controller won't take 
		// any additional actions to process this message.
		return null
	}

	// decodeMessage_PrivateMessage processes incoming MLS "Private Messages" that contain encrypted
	// application messages for this user.  These messages are decrypted and then processes as
	// ActivityStreams messages.
	async #decodeMessage_PublicPrivateMessage(mlsMessage: MlsPublicMessage | MlsPrivateMessage): Promise<Activity | null> {

		var groupId: string

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

		// RULE: Do not accept messages for closed groups
		if (group.stateId == "CLOSED") {
			return null
		}

		// RULE: Cannot receive encrypted messages for unencrypted groups
		if (!groupIsEncrypted(group)) {
			throw new Error("Cannot receive encrypted messages for unencrypted group")
		}

		// Decode the message using ts-mls
		const decodedMessage = await processMessage({
			context: this.#context(),
			state: group.clientState,
			message: mlsMessage,
		})

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

		// If this is not an application message, then there are no further actions to take.
		if (decodedMessage.kind != "applicationMessage") {
			return null
		}

		// Otherwise, this IS an application message, so return the decrypted JSON-LD to the controller.
		const plaintext = decodeText(decodedMessage.message)

		// Create a result object and embed additional context data
		return new Activity().fromJSON(plaintext)
	}


	//////////////////////////////////////////
	// Sending Messages
	//////////////////////////////////////////

	// sendActivity encodes an Activity as an MLS message and sends it to 
	// updated as a result of this message.
	sendActivity = async (group: EncryptedGroup, activity: Activity | { [key: string]: any }) => {

		if (!(activity instanceof Activity)) {
			activity = new Activity(activity)
		}

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

		// save the updated group
		await this.#database.saveGroup(group)

		// send the activity to all group members
		return await this.#sendMlsMessage(
			vocab.ObjectTypeMlsPrivateMessage,
			activity.getArray("as", vocab.PropertyTo),
			applicationMessage.message,
		)
	}

	// #sendMlsMessage is a private method that sends an MLS message via the user's ActivityPub outbox
	#sendMlsMessage = async (type: string, recipients: string[], message: MlsMessage) => {

		// If there are no recipients to send to, just return early
		if (recipients.length === 0) {
			return
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
			generator: this.#generatorId,
			object: {
				type: type,
				attributedTo: this.#actor.id(),
				to: recipients,
				content: contentBase64,
				mediaType: vocab.MediaTypeMLSMessage,
				"mls:encoding": vocab.EncodingTypeBase64,
			},
		})

		console.log("#sendMlsMessage.. sending Activity", activity.toObject())

		this.#delivery.sendActivity(activity)

		return activity
	}

	//////////////////////////////////////////
	// Helpers
	//////////////////////////////////////////


	// #context returns an MlsContext with the current cipher suite and authentication service.
	#context = (): MlsContext => {
		return {
			cipherSuite: this.#cipherSuite,
			authService: unsafeTestingAuthenticationService,
		}
	}
}


//////////////////////////////////////////
// Helpers
//////////////////////////////////////////

// leafNodeMatches returns a unary function that returns TRUE if the 
// provided actorId matches the identity in the leaf node's credential.
function leafNodeMatches(actorId: string | string[]) {
	return (member: LeafNode) => {

		// Guarantee that we're working with a basic credential (not X.509 or something else)
		if (member.credential.credentialType != defaultCredentialTypes.basic) {
			return false
		}

		if (!Array.isArray(actorId)) {
			actorId = [actorId]
		}

		return actorId.some((id) => {
			const credential = member.credential as CredentialBasic
			return decodeText(credential.identity) == id
		})
	}
}


// encodeText is a shorthand for using the ts-mls TextEncoder
function encodeText(text: string) {
	return new TextEncoder().encode(text)
}

// decodeText is a shorthand for using the ts-mls TextDecoder
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
