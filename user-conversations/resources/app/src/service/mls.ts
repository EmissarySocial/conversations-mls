// MLS functions
import {bytesToBase64} from "ts-mls"
import {createApplicationMessage} from "ts-mls"
import {createCommit} from "ts-mls"
import {createGroup} from "ts-mls"
import {decode} from "ts-mls"
import {defaultProposalTypes} from "ts-mls"
import {encode} from "ts-mls"
import {getGroupMembers} from "ts-mls"
import {joinGroup} from "ts-mls"
import {mlsMessageDecoder} from "ts-mls"
import {mlsMessageEncoder} from "ts-mls"
import {processMessage} from "ts-mls"
import {unsafeTestingAuthenticationService} from "ts-mls"
import {wireformats} from "ts-mls"
import {zeroOutUint8Array} from "ts-mls"

// MLS Types
import {type MlsMessageProtocol} from "ts-mls"
import {type CredentialBasic} from "ts-mls"
import {type Proposal} from "ts-mls"
import {type PrivateKeyPackage} from "ts-mls"
import {type KeyPackage} from "ts-mls"
import {type MlsContext} from "ts-mls"
import {type MlsPrivateMessage} from "ts-mls"
import {type MlsWelcomeMessage} from "ts-mls"
import {type MlsGroupInfo} from "ts-mls"
import {type CiphersuiteImpl} from "ts-mls"
import {type MlsFramedMessage} from "ts-mls"

// ActivityPub Types
import {Actor} from "../ap/actor"
import {Activity} from "../ap/activity"
import * as vocab from "../ap/vocab"

// Application Types
import {type Group, type EncryptedGroup, groupIsEncrypted} from "../model/group"
import {type APKeyPackage} from "../model/ap-keypackage"
import {type Message} from "../model/message"
import {type DBKeyPackage} from "../model/db-keypackage"
import {base64ToUint8Array, newId} from "./utils"

// IDatabase wraps all of the methods that the MLS service
// uses to store group state.
interface IDatabase {
	// load methods
	loadGroup(groupID: string): Promise<Group | EncryptedGroup>
	loadMessage(messageID: string): Promise<Message>

	// save methods
	saveGroup(group: Group): Promise<void>
	saveMessage(message: Message): Promise<void>

	loadKeyPackage(): Promise<DBKeyPackage | undefined>
	saveKeyPackage(keyPackage: DBKeyPackage): Promise<void>
}

// IDelivery wraps all of the methods that the MLS service
// uses to send messages.
interface IDelivery {
	sendFramedMessage(recipients: string[], message: MlsFramedMessage): void
	sendGroupInfo(recipients: string[], message: MlsGroupInfo): void
	sendPrivateMessage(recipients: string[], message: MlsFramedMessage): void
	sendWelcome(recipients: string[], welcome: MlsWelcomeMessage): void
}

// IDirectory wraps all of the methods that the MLS service
// uses to look up users' KeyPackages.
interface IDirectory {
	getKeyPackages(actorIDs: string[]): Promise<KeyPackage[]>
	createKeyPackage(keyPackage: APKeyPackage): Promise<string>
}

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
	#publicKeyPackage: KeyPackage
	#privateKeyPackage: PrivateKeyPackage
	#actor: Actor

	constructor(
		database: IDatabase,
		delivery: IDelivery,
		directory: IDirectory,

		cipherSuite: CiphersuiteImpl,
		publicKeyPackage: KeyPackage,
		privateKeyPackage: PrivateKeyPackage,
		actor: Actor,
	) {
		this.#database = database
		this.#delivery = delivery
		this.#directory = directory

		this.#actor = actor
		this.#cipherSuite = cipherSuite
		this.#publicKeyPackage = publicKeyPackage
		this.#privateKeyPackage = privateKeyPackage
	}

	/// Sending Messages

	// createGroup creates a new MLS group and saves it to the database
	createGroup = async () => {
		//
		const context = this.#context()
		const groupID = "uri:uuid:" + crypto.randomUUID()
		const groupIDBytes = new TextEncoder().encode(groupID)

		// Create group using ts-mls
		const clientState = await createGroup({
			context: context,
			groupId: groupIDBytes,
			keyPackage: this.#publicKeyPackage,
			privateKeyPackage: this.#privateKeyPackage,
		})

		// Populate a Group record
		const group: EncryptedGroup = {
			id: groupID,
			members: [],
			name: "New Group",
			tags: [],
			lastMessage: "",
			clientState: clientState,
			createDate: Date.now(),
			updateDate: Date.now(),
			readDate: Date.now(),
		}

		// Save the Group
		await this.#database.saveGroup(group)

		// Success
		return group
	}

	// addGroupMembers updates the group state.  It sends a Commit
	// message to existing members, and a Welcome message to new members,
	addGroupMembers = async (group: EncryptedGroup, newMembers: string[]): Promise<EncryptedGroup> => {
		//

		// Look up all KeyPackages for the new Members
		const currentMembers = group.members
		const keyPackages = await this.#directory.getKeyPackages(newMembers)

		// Create add proposals for each key package
		const addProposals: Proposal[] = keyPackages.map((keyPackage) => ({
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
		group.members = currentMembers.concat(newMembers)
		await this.#database.saveGroup(group)

		// Send welcome to new members
		if (commitResult.welcome != undefined) {
			this.#delivery.sendWelcome(newMembers, commitResult.welcome)
		}

		// (async) Send commit to existing members
		if (currentMembers.length > 0) {
			this.#delivery.sendFramedMessage(currentMembers, commitResult.commit)
		}

		// Return the newly updated group
		return group
	}

	// getGroupMembers returns the list of member IDs for a given group
	getGroupMembers = async (group: EncryptedGroup): Promise<string[]> => {
		//
		// Find all current members of this group
		const leafNodes = await getGroupMembers(group.clientState)
		const members = leafNodes
			.map((leaf) => {
				const credential = leaf.credential as CredentialBasic
				if (credential.identity != undefined) {
					return new TextDecoder().decode(credential.identity)
				}
				return ""
			})
			.filter((identity) => identity != "")

		return members
	}

	encodeActivity = async (group: EncryptedGroup, activity: Activity): Promise<Activity> => {
		//

		// Encrypt the message using MLS
		const messageText = activity.toJSON()
		const messageBytes = new TextEncoder().encode(messageText)
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
		await this.#database.saveGroup(group)

		// Encode the private message as bytes, then to base64
		const contentBytes = encode(mlsMessageEncoder, applicationMessage.message)
		const contentBase64 = bytesToBase64(contentBytes)

		// Calculate recipients (excluding "me")
		const recipients = group.members.filter((member) => member !== this.#actor.id())

		// Create a new activity that wraps the MLS-encrypted content
		const result = new Activity({
			"@context": [vocab.ContextActivityStreams, {mls: vocab.ContextMLS}],
			id: newId(),
			actor: this.#actor.id(),
			type: vocab.ActivityTypeCreate,
			to: recipients,
			object: {
				type: vocab.ObjectTypeMLSPrivateMessage,
				attributedTo: this.#actor.id(),
				to: recipients,
				content: contentBase64,
				mediaType: "message/mls",
				"mls:encoding": "base64",
			},
		})

		return result
	}

	/// Receiving Activities
	// use arrow function to preserve "this" context when passing as a callback
	async decodeMessage(message: string): Promise<Activity | null> {
		const context = this.#context()
		const uintArray = base64ToUint8Array(message)
		const content = decode(mlsMessageDecoder, uintArray)!

		// Require that the we have a valid decoded message before proceeding
		if (content == undefined) {
			console.error("Unable to decode MLS message", message)
			return null
		}

		switch (content.wireformat) {
			case wireformats.mls_group_info:
				return null

			case wireformats.mls_key_package:
				return null

			case wireformats.mls_private_message:
				return await this.#onMessage_PrivateMessage(content)

			case wireformats.mls_public_message:
				return null

			case wireformats.mls_welcome:
				return await this.#onMessage_Welcome(content)

			default:
				console.error("Unknown MLS message type:")
				return null
		}
	}

	// onMessage_Welcome processes MLS "Welcome" messages that add this user to a new group.
	async #onMessage_Welcome(message: MlsWelcomeMessage): Promise<null> {
		//

		// Join the new group
		const clientState = await joinGroup({
			context: this.#context(),
			welcome: message.welcome,
			keyPackage: this.#publicKeyPackage,
			privateKeys: this.#privateKeyPackage,
		})

		// Create a new group record
		const groupId = new TextDecoder().decode(clientState.groupContext.groupId)

		const group: EncryptedGroup = {
			id: groupId,
			members: [],
			name: "Received Group.",
			tags: [],
			lastMessage: "",
			clientState: clientState,
			createDate: Date.now(),
			updateDate: Date.now(),
			readDate: Date.now(),
		}

		// Compute members from the clientState
		group.members = await this.getGroupMembers(group)

		// Save the group to the database
		await this.#database.saveGroup(group)

		// Returning `null` means that the controller won't take any additional actions to process this message.
		return null
	}

	// onMessage_PrivateMessage processes incoming MLS "Private Messages" that contain encrypted
	// application messages for this user.  These messages are decrypted and then processes as
	// ActivityStreams messages.
	async #onMessage_PrivateMessage(mlsMessage: MlsPrivateMessage & MlsMessageProtocol): Promise<Activity | null> {
		// Load the group from the database so we can get the current client state for decryption
		const groupId = new TextDecoder().decode(mlsMessage.privateMessage.groupId)
		const group = await this.#database.loadGroup(groupId)

		if (!groupIsEncrypted(group)) {
			throw new Error("Group client state is undefined")
		}

		const decodedMessage = await processMessage({
			context: this.#context(),
			state: group.clientState,
			message: mlsMessage,
		})

		// Update the group state in the database
		decodedMessage.consumed.forEach(zeroOutUint8Array)
		group.clientState = decodedMessage.newState
		group.updateDate = Date.now()
		await this.#database.saveGroup(group)

		if (decodedMessage.kind != "applicationMessage") {
			return null
		}

		// Parse the plaintext message and return it as a new Activity
		const plaintext = new TextDecoder().decode(decodedMessage.message)

		// Create a result object and embed additional context data
		var result = new Activity().fromJSON(plaintext)
		var object = await result.object()

		if (object.context() == "") {
			object.setContext(groupId)
			result.setObject(object)
		}

		return result
	}

	/// Helper methods

	// Use arrow function to preserve "this" context when passing as a callback
	#context = (): MlsContext => {
		return {
			cipherSuite: this.#cipherSuite,
			authService: unsafeTestingAuthenticationService,
		}
	}
}
