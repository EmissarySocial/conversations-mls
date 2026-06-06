import { Activity } from "../as/activity"
import { Document } from "../as/document"
import * as vocab from "../as/vocab"

import { type Group, NewGroup } from "../model/group"
import { type Message } from "../model/message"
import type { IDatabase, IDelivery } from "./interfaces"
import { newId } from "./utils"

export class CodecPlaintext {

	readonly #database: IDatabase
	readonly #delivery: IDelivery
	readonly #actorId: string

	constructor(database: IDatabase, delivery: IDelivery, actorId: string) {
		this.#database = database
		this.#delivery = delivery
		this.#actorId = actorId
	}

	// createGroup creates a new group on the server and returns a local Group record
	async createGroup(newMembers: string[]): Promise<Group> {

		// Activity to create a new group on the server
		const createGroupActivity = new Activity({
			"@context": "https://www.w3.org/ns/activitystreams",
			type: vocab.ActivityTypeCreate,
			actor: this.#actorId,
			to: [this.#actorId],
			object: {
				type: vocab.CoreTypeOrderedCollection,
				attributedTo: this.#actorId,
				to: [this.#actorId],
				name: "Conversation",
			}
		})

		// Send the activity and receive the group's ID
		const groupId = await this.#delivery.sendActivity(createGroupActivity)

		// Create a new plaintext group
		return this.#createGroup(groupId, newMembers)
	}

	// getGroup loads a group from the database or creates a new one if it doesn't exist
	async getGroup(groupId: string): Promise<Group> {

		let group = await this.#database.loadGroup(groupId)

		// If the group already exists, then validate and return
		if (group != undefined) {
			if (group.codec !== "PLAINTEXT") {
				throw new Error("Group with id " + groupId + " is not a PLAINTEXT group")
			}

			return group
		}

		// Otherwise, create a new plaintext group
		return this.#createGroup(groupId, [])
	}

	// getGroupMembers returns the list of member IDs for the given group
	getGroupMembers(group: Group): string[] {
		return group.members
	}

	// addGroupMembers adds new members to the group and saves it to the database
	async addGroupMembers(group: Group, newMembers: string[]): Promise<Group> {
		group.members.push(...newMembers)
		return group
	}

	// leaveGroup removes the current actor from the group and saves it to the database
	async leaveGroup(group: Group): Promise<void> {
		return undefined
	}

	async removeGroupMember(group: Group, actorId: string): Promise<void> {
		group.members = group.members.filter((member) => member !== actorId)
	}

	async receiveActivity(activity: Activity, object: Document): Promise<Activity | null> {

		let group: Group
		await this.#calculateContext(activity, object)
		const groupId = activity.context()

		// Special case for "Leave" activities.  If we've already left the group, then don't add it to the database
		if (activity.type() == vocab.ActivityTypeLeave) {

			// Load only
			const dbGroup = await this.#database.loadGroup(groupId)

			// If the group doesn't exist, then we're done
			if (dbGroup == undefined) {
				return null
			}

			group = dbGroup

		} else {

			// Load/Create the group based on the Activity context
			group = await this.getGroup(groupId)
		}

		// RULE: DO NOT allow this activity if the codec does not match this group
		if (group.codec != "PLAINTEXT") {
			throw new Error("Group with id " + groupId + " is not a PLAINTEXT group")
		}

		// Find recipients (to/cc addressess) of the activity
		const recipients = activity.recipients()

		// Filter recipients that are NOT already members of the group
		const newRecipients = recipients.filter((recipient) => !group.members.includes(recipient))

		// Add new recipients to the group and save it to the database
		if (newRecipients.length > 0) {
			group.members.push(...newRecipients)
			await this.#database.saveGroup(group)
		}

		// Done.
		return activity
	}

	async #calculateContext(activity: Activity, object: Document): Promise<void> {

		console.log("#calculateContext....")

		// If this is a "reply" then use the same group as the parent message
		let inReplyToId = object.inReplyToId()

		if (inReplyToId != "") {
			console.log("Loading parent message: ", inReplyToId)

			try {
				let parentMessage = await this.#database.loadMessage(inReplyToId)

				if (parentMessage != undefined) {
					activity.setContext(parentMessage.groupId)
					return
				}
			} catch (error) {
				console.log("Failed to load parent message from database:", inReplyToId, error)
			}
		}

		// If the message already has a context, then use that as the group ID
		let groupId = activity.context()

		if (groupId != "") {
			console.log("Activity already has context:", groupId)
			return
		}

		// Otherwise, generate a new group ID
		activity.setContext(newId())
	}

	// encodeMessage encrypts the provided message and returns the encrypted ActivityPub object.
	async encodeMessage(group: Group, message: Message): Promise<{}> {

		return {
			attributedTo: message.sender,
			type: vocab.ObjectTypeNote,
			inReplyTo: message.inReplyTo || group.firstMessageId,
			to: group.members,
			context: group.id,
			content: message.content,
			attachment: message.attachments,
			published: new Date().toISOString(),
		}
	}


	async sendActivity(group: Group, activity: Activity): Promise<void> {

		// RULE: add addressing to all activities ecept "Acknowledge"
		if (activity.type() != vocab.ActivityTypeAcknowledge) {

			// Set group members as "to" recipients of the activity
			activity.set("to", group.members)

			// Add "Mention" tags so that Mastodon will notify users properly.
			this.#addMentions(activity, group.members)
		}

		// Send the activity via the delivery service
		await this.#delivery.sendActivity(activity)
	}

	// createGroup creates/returns a new PLAINTEXT group with the given ID
	async #createGroup(groupId: string, newMembers: string[]): Promise<Group> {

		// Create a group record for this device
		let plaintextGroup = NewGroup("PLAINTEXT")
		plaintextGroup.id = groupId
		plaintextGroup.members = newMembers

		// Save the group to the local database
		await this.#database.saveGroup(plaintextGroup)

		// Success
		return plaintextGroup
	}

	#addMentions(activity: Activity, members: string[]): void {

		// Only add mentions to "Create" and "Update" activities
		const allowedActivities = [vocab.ActivityTypeCreate, vocab.ActivityTypeUpdate]

		if (!allowedActivities.includes(activity.type())) {
			return
		}

		// Get the "object" of the activity 
		let object = activity.objectAsMap()

		if (object[vocab.PropertyType] != vocab.ObjectTypeNote) {
			return
		}

		// Add Mentions for each of the group members
		object[vocab.PropertyTag] = members.map(member => ({
			type: "Mention",
			href: member,
		}))

		// Put the "object" back into the activity for the caller to use
		activity.set(vocab.PropertyObject, object)
	}
}
