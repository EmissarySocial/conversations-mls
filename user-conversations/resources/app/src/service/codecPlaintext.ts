import { type Activity } from "../as/activity"
import { type Document } from "../as/document"
import { type Group } from "../model/group"
import { NewGroup } from "../model/group"
import type { IDelivery } from "./interfaces"

export class CodecPlaintext {

	#delivery: IDelivery

	constructor(delivery: IDelivery) {
		this.#delivery = delivery
	}

	async createGroup(): Promise<Group> {
		return NewGroup("PLAINTEXT")
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
		return activity
	}

	async sendActivity(group: Group, activity: Activity): Promise<void> {
		this.#delivery.sendActivity(activity)
	}

}