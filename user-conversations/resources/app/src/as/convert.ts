
export function toArray(value: any): any[] {
	if (value == undefined) {
		return []
	}

	if (Array.isArray(value)) {
		return value
	}

	return [value]
}

export function toArrayOfString(value: any): string[] {
	return toArray(value).map(item => toString(item))
}

export function toBoolean(value: any): boolean {

	switch (typeof value) {
		case "boolean":
			return value

		case "string":
			return value.toLowerCase() === "true"

		case "number":
			return value != 0
	}

	return false
}

export function toInteger(value: any): number {

	switch (typeof value) {
		case "number":
			return Math.floor(value)

		case "string": {
			const parsed = Number.parseInt(value)
			if (!Number.isNaN(parsed)) {
				return parsed
			}
			return 0
		}

		case "object":

			// typeof null is "object"; guard against the null deref below
			if (value == null) {
				return 0
			}

			if (Array.isArray(value)) {
				if (value.length == 0) {
					return 0
				}
				return toInteger(value[0])
			}

			return toInteger(value["id"])
	}

	return 0
}

export function toMap(value: any): { [key: string]: any } {

	switch (typeof value) {
		case "object":

			// typeof null is "object"; treat null as an empty map
			if (value == null) {
				return {}
			}

			if (Array.isArray(value)) {
				if (value.length == 0) {
					return {}
				}
				return toMap(value[0])
			}

			return value

		case "string":
			return { "id": value }
	}

	return {}
}


export function toString(value: any): string {

	switch (typeof value) {
		case "string":
			return value

		case "number":
		case "boolean":
			return value.toString()

		case "object":

			// typeof null is "object"; guard against the null deref below
			if (value == null) {
				return ""
			}

			if (Array.isArray(value)) {
				if (value.length == 0) {
					return ""
				}
				return toString(value[0])
			}

			return value["id"] || ""
	}

	return ""
}

