import { newId } from "./utils"
import type { GroupState } from "./group"

// Filter represents a saved conversation filter that the user can apply to
// their conversation list.
export type Filter = {
	id: string
	name: string
	sort: number // Sort order used to arrange filters in the UI (ascending)
	states: GroupState[] // Conversation states this filter includes (empty = any)
	tags: string[] // Tags this filter matches (empty = any)
	locked: boolean // When true, the filter is built-in and cannot be deleted by the user
}

export function NewFilter(): Filter {
	return {
		id: newId(),
		name: "",
		sort: 0,
		states: [],
		tags: [],
		locked: false,
	}
}
