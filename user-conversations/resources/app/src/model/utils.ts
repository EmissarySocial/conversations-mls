export function newId() {
	return "uri:uuid:" + crypto.randomUUID()
}

// uniqueStrings returns a copy of the given array with duplicate values removed,
// preserving first-seen order.
export function uniqueStrings(values: string[]): string[] {
	return [...new Set(values)]
}
