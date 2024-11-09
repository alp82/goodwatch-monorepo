import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

const LIMIT = 100

export interface CrewMember {
	id: number
	name: string
	profile_path: string
	known_for_department: string
}

export interface CrewResults {
	crewMembers: CrewMember[]
}

export interface CrewParams {
	text: string
	withCrew: string
	withoutCrew: string
}

export const getCrew = async (params: CrewParams) => {
	return await cached<CrewParams, CrewResults>({
		name: "crew",
		target: _getCrew,
		params,
		// ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	})
}

export async function _getCrew({
	text = "",
	withCrew,
	withoutCrew,
}: CrewParams): Promise<CrewResults> {
	const withCrewArray = withCrew ? withCrew.split(",") : []
	const query = `
		(
			SELECT id, name, profile_path, known_for_department, popularity, 1 as group_order
			FROM "crew"
			WHERE id = ANY($2) -- Always include the withCrew results
			ORDER BY name
		)
		UNION
		(
			SELECT id, name, profile_path, known_for_department, popularity, 2 as group_order
			FROM "crew"
			WHERE
				name ILIKE $1
				AND known_for_department != 'Acting'
				${withCrew ? "AND id != ALL($2)" : ""}
			ORDER BY popularity DESC
			LIMIT ${LIMIT - withCrewArray.length}
		)
		ORDER BY group_order ASC, popularity DESC
		LIMIT ${LIMIT};
	`
	const result = await executeQuery<CrewMember>(query, [
		`%${text}%`,
		withCrewArray,
	])
	return {
		crewMembers: result.rows,
	}
}
