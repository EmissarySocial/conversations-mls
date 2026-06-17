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
}

export function NewFilter(): Filter {
	return {
		id: newId(),
		name: "",
		sort: 0,
		states: [],
		tags: [],
	}
}

// normalizeFilter fills in any fields that may be missing from filter records
// stored before those fields were added to the model.
export function normalizeFilter(filter: Filter): Filter {
	return {
		...filter,
		states: filter.states ?? [],
		tags: filter.tags ?? [],
	}
}
