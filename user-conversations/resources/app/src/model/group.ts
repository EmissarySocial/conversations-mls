import { type ClientState } from "ts-mls"

// Group represents a group record in memory
export type Group = {
	id: string
	name: string
	tags: string[]
	lastMessage: string
	members: string[]
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
		id: "",
		name: "",
		tags: [],
		lastMessage: "",
		members: [],
		createDate: 0,
		updateDate: 0,
		readDate: 0,
	}
}

export function groupIsEncrypted(group: Group | EncryptedGroup): group is EncryptedGroup {
	return (group as EncryptedGroup).clientState !== undefined
}

export function groupNotEncrypted(group: Group | EncryptedGroup): group is Group {
	return (group as EncryptedGroup).clientState === undefined
}
