import { newId } from "./utils"

// Filter represents a saved conversation filter that the user can apply to
// their conversation list.
export type Filter = {
	id: string
	name: string
}

export function NewFilter(): Filter {
	return {
		id: newId(),
		name: "",
	}
}
