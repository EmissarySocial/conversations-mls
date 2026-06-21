import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"

import { type Group, NewGroup } from "../model/group"
import { type Message, attachmentToDocument } from "../model/message"
import { newId, uniqueStrings } from "../model/utils"
import type { ICodec, IDatabase, IDelivery } from "./interfaces"

export class CodecPlaintext implements ICodec {

	readonly #database: IDatabase
	readonly #delivery: IDelivery
	readonly #actorId: string

	constructor(database: IDatabase, delivery: IDelivery, actorId: string) {
		this.#database = database
		this.#delivery = delivery
		this.#actorId = actorId
	}

	//////////////////////////////////////////
	// Group Management
	//////////////////////////////////////////

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

	// addGroupMembers adds new members to the group, skipping any who are already
	// members (and de-duplicating the incoming list itself), then returns the group.
	async addGroupMembers(group: Group, newMembers: string[]): Promise<Group> {
		group.members = uniqueStrings([...group.members, ...newMembers])
		return group
	}

	// leaveGroup removes the current actor from the group and saves it to the database
	async leaveGroup(group: Group): Promise<void> {
		return undefined
	}

	async removeGroupMember(group: Group, actorId: string): Promise<void> {
		group.members = group.members.filter((member) => member !== actorId)
	}


	//////////////////////////////////////////
	// Sending Messages
	//////////////////////////////////////////

	// encodeMessage encrypts the provided message and returns the encrypted ActivityPub object.
	async encodeMessage(group: Group, message: Message): Promise<{}> {

		return {
			attributedTo: message.sender,
			type: vocab.ObjectTypeNote,
			inReplyTo: message.inReplyTo || group.lastMessageId,
			to: group.members,
			context: group.id,
			content: message.content,
			attachment: message.attachments.map(attachment => attachmentToDocument(attachment)),
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

		// If the activity does not already have a "to" value, then set recipients to be ALL members of this group
		if (activity.recipients().length == 0) {
			activity.set("to", group.members)
		}

		// Send the activity via the delivery service and return the server-assigned ID
		return await this.#delivery.sendActivity(activity)
	}

	// addMentions formats an Activity to include a "Mention" tag for each group member.
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


	//////////////////////////////////////////
	// Receiving Messages
	//////////////////////////////////////////

	// receiveActivity processes an incoming activity and creates/finds the correct group for it.
	async receiveActivity(activity: Activity): Promise<Activity | undefined> {

		switch (activity.type()) {

			// These activities are ignored by this codec. Return NO-OP.
			case vocab.ActivityTypeAcknowledge:
			case vocab.ActivityTypeFailure:
				return undefined

			// These activities reference a message by id.
			// verify we have this message defined already.
			case vocab.ActivityTypeDelete:
			case vocab.ActivityTypeLike:
				return this.#receiveActivity_ValidateMessage(activity)

			// These activities reference a group by id.
			// verify we have this group defined already.
			case vocab.ActivityTypeLeave:
				return this.#receiveActivity_ValidateGroup(activity)

			// These activities may create or update groups.
			case vocab.ActivityTypeCreate:
			case vocab.ActivityTypeUpdate: {
				return this.#receiveActivity_CreateOrUpdateGroup(activity)
			}

			// All other activity types (including "implicit Create") pass through to be handled by the controller
			case vocab.ActivityTypeUndo:
			default:
				return activity
		}
	}

	// receiveActivity_ValidateMessage passes through the activity IF its referenced message exists in our database.
	async #receiveActivity_ValidateMessage(activity: Activity): Promise<Activity | undefined> {

		// Try to find the referenced message. If not defined, then NO-OP.
		const messageId = activity.objectId()
		const message = await this.#database.loadMessage(messageId)

		// If not found, then NO-OP
		if (message == undefined) {
			return undefined
		}

		// If the group is undefined or invalid, then NO-OP
		if (await this.#notGroupValid(message.groupId)) {
			return undefined
		}

		// Pass through the activity
		return activity
	}

	// receiveActivity_ValidateGroup passes through the activity IF its referenced group exists in our database.
	async #receiveActivity_ValidateGroup(activity: Activity): Promise<Activity | undefined> {

		// If this group is undefined or invalid, then NO-OP
		if (await this.#notGroupValid(activity.objectId())) {
			return undefined
		}

		// Pass through the activity.
		return activity
	}

	// #receiveActivity_CreateOrUpdateGroup processes an activity, guaranteeing that:
	// 1) the referenced group exists (creating it if necessary)
	// 2) all receivers are members of the group (adding them if necessary)
	async #receiveActivity_CreateOrUpdateGroup(activity: Activity): Promise<Activity | undefined> {

		// Locate the group: a reply inherits the group of the message it replies to;
		// otherwise fall back to the context (activity, then object).
		const groupId = await this.#calcGroupId(activity)
		let group = await this.#database.loadGroup(groupId)

		// If the group was not found, then just create a new one.
		if (group == undefined) {
			group = await this.#createGroup(groupId, [])
		}

		// RULE: DO NOT allow this activity if the codec does not match this group
		if (group.codec != "PLAINTEXT") {
			throw new Error("Group with id " + group.id + " is not a PLAINTEXT group")
		}

		// If we don't have a createdById for this group, then set it to the Actor who sent this Activity
		if (group.createdById == "") {
			group.createdById = activity.actorId()
		}

		// If we need to add new members to the group, then save the changes. Skip this
		// for Like/Delete/Undo: those act on an existing message and must not change
		// who belongs to the group (the liker/deleter is not necessarily a member).
		const newMembers = this.#findNewGroupMembers(group, activity)
		if (newMembers.length > 0) {
			group.members = uniqueStrings([...group.members, ...newMembers])
		}

		// Save the group if any changes were made
		await this.#database.saveGroup(group)

		// Guarantee that the Activity now uses the "correct" Group
		activity.setContext(group.id)

		// Done.
		console.log("Plaintext.receiveActivity_CreateOrUpdateGroup:", group, activity)
		return activity
	}

	// #calcGroupId determines which group an incoming Create/Update belongs to.
	// Unlike the shared Activity.calcGroupId(), a reply (object.inReplyTo) inherits the
	// group of the message it replies to. This lookup is intentionally plaintext-only.
	async #calcGroupId(activity: Activity): Promise<string> {

		// A reply inherits the group of the message it replies to, IF we have that message locally.
		const object = await activity.object()
		const inReplyToId = object.inReplyToId()

		if (inReplyToId != "") {
			const parent = await this.#database.loadMessage(inReplyToId)
			if (parent != undefined) {
				return parent.groupId
			}
		}

		// Otherwise, fall back to the context (activity, then object).
		const groupId = await activity.calcGroupId()

		if (groupId != "") {
			return groupId
		}

		// If no group could be determined, then start a new group.
		return newId()
	}

	// #isGroupValid returns TRUE if the given groupId references a valid PLAINTEXT group in our database.
	async #isGroupValid(groupId: string): Promise<boolean> {

		// Locate the group in the database
		const group = await this.#database.loadGroup(groupId)

		// If not found, then NO-OP
		if (group == undefined) {
			return false
		}

		// Confirm that the group is a PLAINTEXT group.
		if (group.codec != "PLAINTEXT") {
			console.error("Modification attempted on group that is not a PLAINTEXT group.", group)
			return false
		}

		// Otherwise, group is valid
		return true
	}

	// #notGroupValid returns TRUE if the group is undefined, or is not a PLAINTEXT group
	async #notGroupValid(groupId: string): Promise<boolean> {
		return !(await this.#isGroupValid(groupId))
	}

	// findNewGroupMembers returns the actors involved in this activity who are not
	// already members of the group. The result is de-duplicated, because the
	// activity's recipient list (to/cc) and actor can name the same actor more
	// than once.
	#findNewGroupMembers(group: Group, activity: Activity): string[] {

		// Find members (from/to/cc addressess) of the activity, plus its actor
		const members = uniqueStrings([...activity.recipients(), activity.actorId()])

		// Keep only those who are NOT already members of the group
		return members.filter(member => !group.members.includes(member))
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
}
