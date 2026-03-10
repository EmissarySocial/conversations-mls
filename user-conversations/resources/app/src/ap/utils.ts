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
