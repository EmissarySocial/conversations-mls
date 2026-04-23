import { newId } from "./utils"

// MessageData represents the raw data structure of a Message
export type MessageData = {
	id: string
	groupId: string
	type: "" | "SENT" | "RECEIVED" | "ADD-ACTOR" | "REMOVE-ACTOR" | "ADD-DEVICE" | "REMOVE-DEVICE"
	sender: string
	inReplyTo: string
	content: string
	attachments: string[]
	reactions: { [key: string]: string[] }
	history: string[]
	received: string[] // List of actor IDs that have received this message
	createDate: number
	updateDate: number
}


// Message represents a single message that has been sent or received in the group conversation.
export class Message {

	// Properties
	id: string = newId()
	groupId: string = ""
	type: "" | "SENT" | "RECEIVED" | "ADD-ACTOR" | "REMOVE-ACTOR" | "ADD-DEVICE" | "REMOVE-DEVICE" = ""
	sender: string = ""
	inReplyTo: string = ""
	content: string = ""
	attachments: string[] = []
	reactions: { [key: string]: string[] } = {}
	history: string[] = []
	received: string[] = [] // List of actor IDs that have received this message
	createDate: number = Date.now()
	updateDate: number = Date.now()

	constructor(data?: Partial<MessageData>) {
		Object.assign(this, data)
	}

	// setReaction adds a unique reaction from the specified actor
	setReaction(actorId: string, reaction: string): boolean {

		this.removeReaction(actorId)

		if (this.reactions[reaction] == undefined) {
			this.reactions[reaction] = []
		}

		this.reactions[reaction].push(actorId)
		return true
	}

	// removeReaction removes a reaction from the specified actor, regardless of the reaction type.
	// Returns TRUE if a reaction was removed, or FALSE if no reaction was found for this actor.
	removeReaction(actorId: string): boolean {

		for (const [existingReaction, actors] of Object.entries(this.reactions)) {

			if (actors.includes(actorId)) {
				this.reactions[existingReaction] = actors.filter(a => a != actorId)

				if (this.reactions[existingReaction].length == 0) {
					delete this.reactions[existingReaction]
				}

				// TRUE means that the message object was changed.
				return true
			}
		}

		// FALSE means that we did not make any changes
		return false
	}
}

export function NewMessage(data?: Partial<MessageData>) {
	return new Message(data)
}