import {newId} from "./utils"

export type Message = {
	id: string
	group: string
	sender: string
	plaintext: string
	createDate: number
}

export function NewMessage(): Message {
	return {
		id: newId(),
		group: "",
		sender: "",
		plaintext: "",
		createDate: Date.now(),
	}
}
