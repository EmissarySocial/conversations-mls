import * as vocab from "../as/vocab"
import { type Activity } from "../as/activity"
import { type Document } from "../as/document"
import { type Group } from "../model/group"
import { NewGroup } from "../model/group"
import type { IDatabase, IDelivery } from "./interfaces"

export class CodecPlaintext {

	#database: IDatabase
	#delivery: IDelivery
	#actorId: string

	constructor(database: IDatabase, delivery: IDelivery, actorId: string) {
		this.#database = database
		this.#delivery = delivery
		this.#actorId = actorId
	}

	async createGroup(): Promise<Group> {
		return NewGroup("PLAINTEXT")
	}

	async getGroup(groupId: string): Promise<Group> {

		var group = await this.#database.loadGroup(groupId)

		// If the group already exists, then validate and return
		if (group != undefined) {
			if (group.codec !== "PLAINTEXT") {
				throw new Error("Group with id " + groupId + " is not a PLAINTEXT group")
			}

			return group
		}

		// It's OK for the PLAINTEXT codec to create new groups
		group = NewGroup("PLAINTEXT")
		group.id = groupId
		group.members = [this.#actorId]
		await this.#database.saveGroup(group)
		return group
	}

	getGroupMembers(group: Group): string[] {
		return group.members
	}

	async addGroupMembers(group: Group, newMembers: string[]): Promise<Group> {
		group.members.push(...newMembers)
		return group
	}

	async leaveGroup(group: Group): Promise<void> {

	}

	async removeGroupMember(group: Group, actorId: string): Promise<void> {
		group.members = group.members.filter((member) => member !== actorId)
	}

	async receiveActivity(activity: Activity, object: Document): Promise<Activity | null> {

		var group: Group
		const groupId = activity.context()

		console.log("Receive Activity", activity.toObject(), object.toObject())

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

	#addMentions(activity: Activity, members: string[]): void {

		// Only add mentions to "Create" and "Update" activities
		const allowedActivities = [vocab.ActivityTypeCreate, vocab.ActivityTypeUpdate]

		if (!allowedActivities.includes(activity.type())) {
			return
		}

		// Get the "object" of the activity 
		var object = activity.objectAsMap()

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
