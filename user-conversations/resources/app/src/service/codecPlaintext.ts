import { Activity } from "../as/activity"
import { Document } from "../as/document"
import * as vocab from "../as/vocab"

import { type Group, NewGroup } from "../model/group"
import { type Message } from "../model/message"
import type { IDatabase, IDelivery } from "./interfaces"

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

	// receiveActivity processes an incoming activity and creates/finds the correct group for it.
	async receiveActivity(activity: Activity, object: Document): Promise<Activity | undefined> {

		let group = await this.#findGroupForActivity(activity, object)

		if (group == undefined) {
			return undefined
		}

		// RULE: DO NOT allow this activity if the codec does not match this group
		if (group.codec != "PLAINTEXT") {
			throw new Error("Group with id " + group.id + " is not a PLAINTEXT group")
		}

		// If we need to add new members to the group, then save the changes
		let newMembers = this.#findNewGroupMembers(group, activity)
		if (newMembers.length > 0) {
			group.members.push(...newMembers)
			await this.#database.saveGroup(group)
		}

		// Guarantee that the Activity now uses the "correct" Group
		activity.setContext(group.id)

		// Done.
		return activity
	}

	async #findGroupForActivity(activity: Activity, object: Document): Promise<Group | undefined> {

		switch (activity.type()) {

			// "Leave" activities use the "object" of the activity as the group ID.
			case vocab.ActivityTypeLeave: {
				return await this.#database.loadGroup(activity.objectId())
			}

			// "Like" activities use the group of the message being liked.
			case vocab.ActivityTypeLike: {
				let message = await this.#database.loadMessage(activity.objectId())
				return this.#database.loadGroup(message.groupId)
			}

			// "Create" and "Update" activities use the group from message being replied to, or the activity context directly.
			case vocab.ActivityTypeCreate:
			case vocab.ActivityTypeUpdate: {

				// If this is a "reply" then use the same group as the parent message
				if (object.inReplyToId() != "") {
					let message = await this.#database.loadMessage(object.inReplyToId())
					return this.#database.loadGroup(message.groupId)
				}

				// Otherwise, use the context provided in the message
				if (activity.context() != "") {
					return this.#database.loadGroup(activity.context())
				}

				// If none is found, then create a new group for this message.
				return this.createGroup([])
			}
		}

		throw new Error("Unrecognized activity type " + activity.type())
	}

	// findNewGroupMembers returns the actors involved in this activity who are not already members of the group.
	#findNewGroupMembers(group: Group, activity: Activity): string[] {

		// Find members (from/to/cc addressess) of the activity
		let members = activity.recipients()
		members.push(activity.actorId())

		// Filter members that are NOT already members of the group
		return members.filter(member => !group.members.includes(member))
	}

	// encodeMessage encrypts the provided message and returns the encrypted ActivityPub object.
	async encodeMessage(group: Group, message: Message): Promise<{}> {

		return {
			attributedTo: message.sender,
			type: vocab.ObjectTypeNote,
			inReplyTo: message.inReplyTo || group.lastMessageId,
			to: group.members,
			context: group.id,
			content: message.content,
			attachment: message.attachments,
			published: new Date().toISOString(),
		}
	}

	// sendActivity sends the provided activity to the group via the delivery service.
	// Returns the server-assigned URL for the created object, or "" if none was returned.
	async sendActivity(group: Group, activity: Activity): Promise<string> {

		// Add "Mention" tags so that Mastodon will notify users properly (except for "Acknowledge" activities)
		if (activity.type() != vocab.ActivityTypeAcknowledge) {
			this.#addMentions(activity, group.members)
		}

		// Set recipients to be the members of this group
		activity.set("to", group.members)

		// Send the activity via the delivery service and return the server-assigned ID
		return await this.#delivery.sendActivity(activity)
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
