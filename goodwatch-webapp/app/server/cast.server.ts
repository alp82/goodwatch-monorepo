import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

const LIMIT = 100

export interface CastMember {
	tmdb_id: number
	name: string
	profile_path: string
	known_for_department: string
	popularity: number
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
		ttlMinutes: 60 * 24,
		//ttlMinutes: 0,
	})
}

export async function _getCast({
	text = "",
	withCast,
	withoutCast,
}: CastParams): Promise<CastResults> {
	// CrateDB-compatible approach: separate queries and merge results
	let castMembers: CastMember[] = []
	
	// First get withCast results if specified
	if (withCast) {
		const withCastArray = withCast.split(",").map(id => parseInt(id.trim()))
		if (withCastArray.length > 0) {
			const withCastQuery = `
				SELECT tmdb_id, name, profile_path, known_for_department, popularity
				FROM person
				WHERE tmdb_id IN (${withCastArray.map(() => '?').join(', ')})
				ORDER BY popularity DESC
			`
			const withCastResult = await query<CastMember>(withCastQuery, withCastArray)
			castMembers.push(...withCastResult)
		}
	}
	
	// Then get search results using hybrid search (MATCH + ILIKE), excluding withCast if specified
	if (text) {
		const withCastArray = withCast ? withCast.split(",").map(id => parseInt(id.trim())) : []
		
		const searchQuery = withCastArray.length > 0 
			? `
				SELECT tmdb_id, name, profile_path, known_for_department, popularity
				FROM person
				WHERE MATCH(name, ?) using phrase_prefix AND tmdb_id NOT IN (${withCastArray.map(() => '?').join(', ')})
				ORDER BY popularity DESC
				LIMIT ?
			`
			: `
				SELECT tmdb_id, name, profile_path, known_for_department, popularity
				FROM person
				WHERE MATCH(name, ?) using phrase_prefix
				ORDER BY popularity DESC
				LIMIT ?
			`
		
		const searchParams = withCastArray.length > 0 
			? [text, ...withCastArray, LIMIT - castMembers.length]
			: [text, LIMIT - castMembers.length]
		
		const searchResult = await query<CastMember>(searchQuery, searchParams)
		castMembers.push(...searchResult)
	}
	
	return {
		castMembers: castMembers.slice(0, LIMIT),
	}
}
