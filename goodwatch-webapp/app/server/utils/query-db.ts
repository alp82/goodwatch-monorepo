export const mediaTypes = ["movie", "show"] as const
export type MediaType = (typeof mediaTypes)[number]

export const filterMediaTypes = ["all", "movies", "movie", "show", "shows"] as const
export type FilterMediaType = (typeof filterMediaTypes)[number]

export interface FingerprintCondition {
	field?: string
	operator?: ">" | ">=" | "<" | "<=" | "=" | "!="
	value?: number
	logic?: "AND" | "OR"
	conditions?: FingerprintCondition[]
}

// Function to generate SQL from fingerprint conditions
export const generateFingerprintSQL = (conditions: FingerprintCondition[]): string => {
	if (!conditions || conditions.length === 0) return ""

	const processCondition = (condition: FingerprintCondition): string => {
		if (
			condition.field &&
			condition.operator &&
			condition.value !== undefined
		) {
			// Single condition: fingerprint_scores['field'] >= value
			return `fingerprint_scores['${condition.field}'] ${condition.operator} ${condition.value}`
		} else if (condition.conditions && condition.conditions.length > 0) {
			// Nested conditions with logic
			const nestedSQL = condition.conditions
				.map(processCondition)
				.filter((sql) => sql.length > 0)
				.join(` ${condition.logic || "AND"} `)
			return nestedSQL ? `(${nestedSQL})` : ""
		}
		return ""
	}

	const sql = conditions
		.map(processCondition)
		.filter((sql) => sql.length > 0)
		.join(" AND ")

	return sql ? `AND ${sql}` : ""
}
