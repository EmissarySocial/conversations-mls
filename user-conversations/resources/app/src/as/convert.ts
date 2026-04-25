
export function toArray(value: any): any[] {
	if (value == undefined) {
		return []
	}

	if (Array.isArray(value)) {
		return value
	}

	return [value]
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

		case "string":
			const parsed = parseInt(value)
			if (!isNaN(parsed)) {
				return parsed
			}
		case "object":

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

