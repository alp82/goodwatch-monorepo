interface JsonObject {
	[key: string]:
		| string
		| number
		| boolean
		| null
		| undefined
		| JsonObject
		| Array<JsonObject>
}

export const jsonToUrlString = (json: JsonObject) => {
	const params: string[] = []

	for (const [key, value] of Object.entries(json)) {
		const stringValue =
			typeof value === "object" ? JSON.stringify(value) : String(value)
		// Replace spaces with + but don't encode other special characters
		const formattedValue = stringValue.replace(/ /g, "+")
		params.push(`${key}=${formattedValue}`)
	}

	return params.join("&")
}
