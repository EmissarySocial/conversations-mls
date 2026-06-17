import { newId } from "./utils"

// Filter represents a saved conversation filter that the user can apply to
// their conversation list.
export type Filter = {
	id: string
	name: string
	sort: number // Sort order used to arrange filters in the UI (ascending)
}

export function NewFilter(): Filter {
	return {
		id: newId(),
		name: "",
		sort: 0,
	}
}
