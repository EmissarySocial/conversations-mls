import { type ClientState } from "ts-mls"
import type { Contact } from "./contact"

// Group represents a group record in memory
export type Group = {
	id: string
	stateId: "IMPORTANT" | "ACTIVE" | "ARCHIVED" | "CLOSED"
	name: string
	description: string
	tags: string[]
	lastMessage: string
	members: string[]
	contacts: Contact[]
	createDate: number
	updateDate: number
	readDate: number
}

// EncryptedGroup extends Group with additional properties related to encryption state
export type EncryptedGroup = Group & {
	clientState: ClientState
}

export function NewGroup(): Group {
	return {
		id: "uri:uuid:" + crypto.randomUUID(),
		stateId: "ACTIVE",
		name: "",
		description: "",
		tags: [],
		lastMessage: "",
		members: [],
		contacts: [],
		createDate: Date.now(),
		updateDate: Date.now(),
		readDate: 0,
	}
}

export function groupIsEncrypted(group: Group | EncryptedGroup): group is EncryptedGroup {
	return (group as EncryptedGroup).clientState !== undefined
}

export function groupNotEncrypted(group: Group | EncryptedGroup): group is Group {
	return (group as EncryptedGroup).clientState === undefined
}
