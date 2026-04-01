import { newId } from "./utils"

export type Message = {
	id: string
	groupId: string
	sender: string
	plaintext: string
	likes: string[]
	history: string[]
	received: string[] // List of actor IDs that have received this message
	createDate: number
	updateDate: number
}

export function NewMessage(): Message {
	return {
		id: newId(),
		groupId: "",
		sender: "",
		plaintext: "",
		likes: [],
		history: [],
		received: [],
		createDate: Date.now(),
		updateDate: Date.now(),
	}
}
