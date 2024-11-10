import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

const LIMIT = 100

export interface DNAResult {
	category: string
	label: string
	count_all: number
}

export interface DNAResults {
	result: DNAResult[]
}

export interface DNAParams {
	text: string
}

export const getDNA = async (params: DNAParams) => {
	return await cached<DNAParams, DNAResults>({
		name: "dna",
		target: _getDNA,
		params,
		ttlMinutes: 60 * 24,
		// ttlMinutes: 0,
	})
}

export async function _getDNA({ text = "" }: DNAParams): Promise<DNAResults> {
	const words = text.includes(" ")
		? text
				.split(" ")
				.filter(Boolean)
				.map((word) => `%${word}%`)
		: [`%${text}%`]
	const conditions = words
		.map((_, i) => `(category ILIKE $${i + 1} OR label ILIKE $${i + 1})`)
		.join(" AND ")

	const query = `
		SELECT category, label, count_all
		FROM dna
		WHERE 
			${conditions}
		ORDER BY count_all DESC
		LIMIT ${LIMIT};
	`
	const params = [...words]
	const result = await executeQuery<DNAResult>(query, params)
	return {
		result: result.rows,
	}
}
