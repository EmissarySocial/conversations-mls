import { newId } from "./utils"

export type Message = {
	id: string
	groupId: string
	sender: string
	plaintext: string
	likes: string[]
	createDate: number
}

export function NewMessage(): Message {
	return {
		id: newId(),
		groupId: "",
		sender: "",
		plaintext: "",
		likes: [],
		createDate: Date.now(),
	}
}
