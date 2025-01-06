import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

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
		// ttlMinutes: 60 * 24,
		ttlMinutes: 0,
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
		(_, i) => `(category ILIKE $${i + 1} OR label ILIKE $${i + 1})`,
	)
	const labelConditions = words.map((_, i) => `label ILIKE $${i + 1}`)
	const conditionsAll = conditions.join(" AND ")
	const labelConditionsAll = labelConditions.join(" AND ")

	const query = `
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

	const params = [...words]
	const result = await executeQuery<DNAResult>(query, params)
	return {
		result: result.rows,
	}
}
