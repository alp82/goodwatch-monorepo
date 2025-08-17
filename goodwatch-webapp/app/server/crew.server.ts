import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

const LIMIT = 100

export interface CrewMember {
	id: number
	name: string
	profile_path: string
	known_for_department: string
}

export interface CrewResults {
	crewMembers: CrewMember[]
	[key: string]: any
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
		ttlMinutes: 60 * 24,
		// ttlMinutes: 0,
	})
}

export async function _getCrew({
	text = "",
	withCrew,
	withoutCrew,
}: CrewParams): Promise<CrewResults> {
	const withCrewArray = withCrew ? withCrew.split(",").map(id => parseInt(id.trim())) : []
	
	// CrateDB-compatible approach: separate queries and merge results
	let crewMembers: CrewMember[] = []
	
	// First: get the withCrew results (priority crew members)
	if (withCrewArray.length > 0) {
		const withCrewQuery = `
			SELECT id, name, profile_path, known_for_department, popularity
			FROM crew
			WHERE id IN (${withCrewArray.map(() => '?').join(', ')})
			ORDER BY name
		`
		const withCrewResult = await query<CrewMember>(withCrewQuery, withCrewArray)
		crewMembers.push(...withCrewResult)
	}
	
	// Second: get search results (excluding already included crew)
	if (text && crewMembers.length < LIMIT) {
		const remainingLimit = LIMIT - crewMembers.length
		let searchQuery = `
			SELECT id, name, profile_path, known_for_department, popularity
			FROM crew
			WHERE name LIKE ?
			AND known_for_department != 'Acting'
		`
		
		const params: any[] = [`%${text}%`]
		
		// Exclude already included crew members
		if (withCrewArray.length > 0) {
			searchQuery += ` AND id NOT IN (${withCrewArray.map(() => '?').join(', ')})`
			params.push(...withCrewArray)
		}
		
		searchQuery += ` ORDER BY popularity DESC LIMIT ?`
		params.push(remainingLimit)
		
		const searchResult = await query<CrewMember>(searchQuery, params)
		crewMembers.push(...searchResult)
	}
	
	return {
		crewMembers,
	}
}
