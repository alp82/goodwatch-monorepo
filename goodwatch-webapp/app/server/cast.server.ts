import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

const LIMIT = 100

export interface CastMember {
	id: number
	name: string
	profile_path: string
	known_for_department: string
}

export interface CastResults {
	castMembers: CastMember[]
}

export interface CastParams {
	text: string
	withCast: string
	withoutCast: string
}

export const getCast = async (params: CastParams) => {
	return await cached<CastParams, CastResults>({
		name: "cast",
		target: _getCast,
		params,
		// ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	})
}

export async function _getCast({
	text = "",
	withCast,
	withoutCast,
}: CastParams): Promise<CastResults> {
	const withCastArray = withCast ? withCast.split(",") : []
	const query = `
		(
			SELECT id, name, profile_path, known_for_department, popularity, 1 as group_order
			FROM "cast"
			WHERE id = ANY($2) -- Always include the withCast results
			ORDER BY name
		)
		UNION
		(
			SELECT id, name, profile_path, known_for_department, popularity, 2 as group_order
			FROM "cast"
			WHERE
				name ILIKE $1
				${withCast ? "AND id != ALL($2)" : ""}
			ORDER BY popularity DESC
			LIMIT ${LIMIT - withCastArray.length}
		)
		ORDER BY group_order ASC, popularity DESC
		LIMIT ${LIMIT};
	`
	const result = await executeQuery<CastMember>(query, [
		`%${text}%`,
		withCastArray,
	])
	return {
		castMembers: result.rows,
	}
}
