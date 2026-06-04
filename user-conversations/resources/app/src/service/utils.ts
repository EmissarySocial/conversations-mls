import type { Group } from "../model/group"
import type { Message } from "../model/message"
import * as vocab from "../as/vocab"

// rangeToArray consumes all values from a generator and returns them as an array
export function rangeToArray<T>(generator: Generator<T>): T[] {
	let result = []
	for (let value of generator) {
		result.push(value)
	}
	return result
}

// rangeFirst returns the first value from a generator
// or throws an error if the generator is empty
export function rangeFirst<T>(generator: Generator<T>): T {
	for (const value of generator) { // NOSONAR: typescript:S1751 - Yes, I want to just get the first value from the generator
		return value
	}
	throw new Error("Generator is empty.")
}

// Helper to strip trailing null nodes per RFC 9420
export function stripTrailingNulls(tree: any[]): any[] {
	let lastNonNull = tree.length - 1
	while (lastNonNull >= 0 && tree[lastNonNull] === null) {
		lastNonNull--
	}
	return tree.slice(0, lastNonNull + 1)
}

// base64ToUint8Array converts a base64-encoded string to a Uint8Array.
// Normalizes URL-safe base64 (- and _) to standard base64 (+ and /),
// strips whitespace, and adds padding if missing — all common in interop scenarios.
export function base64ToUint8Array(base64: string): Uint8Array {

	// Normalize URL-safe base64 to standard base64 and remove whitespace
	const normalized = base64
		.replaceAll('-', '+')
		.replaceAll('_', '/')
		.replaceAll(/\s+/g, '')

	// Add base64 padding (if missing)
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')

	// Convert base64 string to binary string
	const binaryString = globalThis.atob(padded)

	// Convert binary string to Uint8Array
	return Uint8Array.from(binaryString, c => c.codePointAt(0)!)
}

// newId generates a new unique identifier in the form of a URI with a UUID
export function newId(): string {
	return "uri:uuid:" + crypto.randomUUID()
}

// uint8ArrayEqual returns TRUE if two Uint8Arrays contain the same values.
export function uint8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {

	if (a.length != b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i] != b[i]) {
			return false
		}
	}

	return true
}

// uint8ArraysContain returns TRUE if the target Uint8Array is found within the array of Uint8Arrays.
export function uint8ArraysContain(arrays: Uint8Array[], target: Uint8Array): boolean {

	for (const array of arrays) {
		if (uint8ArrayEqual(array, target)) {
			return true
		}
	}

	return false
}

// messageToActivityStream converts a Message to an ActivityStream object for sending via ActivityPub
export function messageToActivityStream(group: Group, message: Message): { [key: string]: any } {
	return {
		id: message.id,
		attributedTo: message.sender,
		type: vocab.ObjectTypeNote,
		to: group.members,
		context: group.id,
		content: message.content,
		attachment: message.attachments,
		published: new Date().toISOString(),
	}
}

// diffArrays compares two arrays and returns the added and removed items
export function diffArrays<T>(before: T[], after: T[]) {
	const beforeSet = new Set(before);
	const afterSet = new Set(after);

	return {
		added: after.filter(item => !beforeSet.has(item)),
		removed: before.filter(item => !afterSet.has(item)),
	};
}