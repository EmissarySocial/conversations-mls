import { newId } from "./utils"

export type Message = {
	id: string
	groupId: string
	sender: string
	plaintext: string
	likes: string[]
	history: string[]
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
		createDate: Date.now(),
		updateDate: Date.now(),
	}
}
