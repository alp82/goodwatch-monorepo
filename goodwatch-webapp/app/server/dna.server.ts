import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

const LIMIT = 100

export interface DNAResult {
	dna_name: string
	dna_value: string
	dna_count: number
}

export interface DNAResults {
	result: DNAResult[]
}

export interface DNAParams {
	text: string
	similarDNA: string
}

export const getDNA = async (params: DNAParams) => {
	return await cached<DNAParams, DNAResults>({
		name: "dna",
		target: _getDNA,
		params,
		// ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	})
}

export async function _getDNA({
	text = "",
	similarDNA,
}: DNAParams): Promise<DNAResults> {
	const similarDNAArray = similarDNA ? similarDNA.split(",") : []
	const query = `
		WITH expanded_dna AS (
			SELECT m.tmdb_id, dna_name, dna_value
			FROM movies m
			CROSS JOIN LATERAL jsonb_each(m.dna) AS each_field(dna_name, dna_values)
			CROSS JOIN LATERAL jsonb_array_elements_text(dna_values) AS dna_value
			WHERE dna_value ILIKE $1
			
			UNION ALL
			
			SELECT t.tmdb_id, dna_name, dna_value
			FROM tv t
			CROSS JOIN LATERAL jsonb_each(t.dna) AS each_field(dna_name, dna_values)
			CROSS JOIN LATERAL jsonb_array_elements_text(dna_values) AS dna_value
			WHERE dna_value ILIKE $1
		),
		ranked_dna AS (
			SELECT dna_name, dna_value, COUNT(*) AS dna_count
			FROM expanded_dna
			GROUP BY dna_name, dna_value
		)
		SELECT dna_name, dna_value, dna_count
		FROM ranked_dna
		ORDER BY dna_count DESC
		LIMIT ${LIMIT};
	`
	const result = await executeQuery<DNAResult>(query, [
		`%${text}%`,
		// similarDNAArray,
	])
	return {
		result: result.rows,
	}
}
