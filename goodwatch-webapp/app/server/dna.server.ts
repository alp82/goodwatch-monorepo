import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

const LIMIT = 100

export interface DNAResult {
	id: number
	category: string
	label: string
	count_all: number
	is_primary: boolean
	aliases?: number[]
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

	const conditions = words.map(
		(_, i) => `(category ILIKE ? OR label ILIKE ?)`,
	)
	const labelConditions = words.map((_, i) => `label ILIKE ?`)
	const conditionsAll = conditions.join(" AND ")
	const labelConditionsAll = labelConditions.join(" AND ")

	const dnaQuery = `
    WITH matching_primaries AS (
      SELECT DISTINCT ON (d.id)
        d.id,
        d.category,
        d.label,
        d.count_all,
        true as is_primary,
        CASE 
          WHEN ${conditionsAll} THEN 1
          ELSE 2
        END as match_type
      FROM dna d
      WHERE d.cluster_id IS NULL
        AND (
          (${conditionsAll})
          OR EXISTS (
            SELECT 1 FROM dna a
            WHERE a.cluster_id = d.id
            AND (${labelConditionsAll})
          )
        )
    )
    SELECT
			m.id,
      m.category,
      m.label,
      m.count_all,
      m.is_primary,
      CASE 
        WHEN ${conditionsAll} THEN NULL
        ELSE (
          SELECT array_agg(a.label)
          FROM dna a
          WHERE a.cluster_id = m.id
          AND (${labelConditionsAll})
        )
      END as aliases
    FROM matching_primaries m
    ORDER BY m.count_all DESC
    LIMIT ${LIMIT};
  `

	// CrateDB requires flattened parameters for ILIKE conditions
	const params = words.flatMap(word => [word, word, word]) // For each word: category ILIKE, label ILIKE, label ILIKE
	const result = await query<DNAResult>(dnaQuery, params)
	return {
		result: result,
	}
}
