export function toString(value: any): string {
	if (value == undefined) {
		return ""
	}

	switch (typeof value) {
		//

		case "bigint":
			return value.toString()

		case "boolean":
			return value ? "true" : "false"

		case "number":
			return value.toString()

		case "object":
			if (Array.isArray(value)) {
				if (value.length == 0) {
					return ""
				}

				return toString(value[0])
			}

			if (value instanceof Object) {
				if (typeof value.id === "string") {
					return value.id
				}

				if (typeof value.url === "string") {
					return value.url
				}

				if (typeof value.href === "string") {
					return value.href
				}
			}

		case "string":
			return value

		case "symbol":
			return value.toString()
	}

	return ""
}


export function isString(value: any): value is string {
	return typeof value === "string"
}

export function isInteger(value: any): value is number {
	if (typeof value === "number") {
		return Number.isInteger(value)
	}
	return false
}

export function isArray(value: any): value is any[] {
	return Array.isArray(value)
}

export function isObject(value: any): value is object {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}