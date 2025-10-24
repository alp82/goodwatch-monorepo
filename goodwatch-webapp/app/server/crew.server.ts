import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

const LIMIT = 100

export interface CrewMember {
	tmdb_id: number
	name: string
	profile_path: string
	known_for_department: string
	popularity: number
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
		//ttlMinutes: 0,
	})
}

export async function _getCrew({
	text = "",
	withCrew,
	withoutCrew,
}: CrewParams): Promise<CrewResults> {
	// CrateDB-compatible approach: separate queries and merge results
	let crewMembers: CrewMember[] = []
	
	// First get withCrew results if specified
	if (withCrew) {
		const withCrewArray = withCrew.split(",").map(id => parseInt(id.trim()))
		if (withCrewArray.length > 0) {
			const withCrewQuery = `
				SELECT tmdb_id, name, profile_path, known_for_department, popularity
				FROM person
				WHERE tmdb_id IN (${withCrewArray.map(() => '?').join(', ')})
				ORDER BY popularity DESC
			`
			const withCrewResult = await query<CrewMember>(withCrewQuery, withCrewArray)
			crewMembers.push(...withCrewResult)
		}
	}
	
	// Then get search results using MATCH with phrase_prefix, excluding withCrew if specified
	if (text) {
		const withCrewArray = withCrew ? withCrew.split(",").map(id => parseInt(id.trim())) : []
		
		const searchQuery = withCrewArray.length > 0 
			? `
				SELECT tmdb_id, name, profile_path, known_for_department, popularity
				FROM person
				WHERE MATCH(name, ?) using phrase_prefix AND known_for_department != 'Acting' AND tmdb_id NOT IN (${withCrewArray.map(() => '?').join(', ')})
				ORDER BY popularity DESC
				LIMIT ?
			`
			: `
				SELECT tmdb_id, name, profile_path, known_for_department, popularity
				FROM person
				WHERE MATCH(name, ?) using phrase_prefix AND known_for_department != 'Acting'
				ORDER BY popularity DESC
				LIMIT ?
			`
		
		const searchParams = withCrewArray.length > 0 
			? [text, ...withCrewArray, LIMIT - crewMembers.length]
			: [text, LIMIT - crewMembers.length]
		
		const searchResult = await query<CrewMember>(searchQuery, searchParams)
		crewMembers.push(...searchResult)
	}
	
	return {
		crewMembers: crewMembers.slice(0, LIMIT),
	}
}
