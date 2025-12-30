import { cached } from "~/utils/cache"
import { query as crateQuery } from "~/utils/crate"
import { DISTINCT_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"

interface RatedItem {
	tmdb_id: number
	media_type: "movie" | "show"
	score: number
}

export interface GenreStat {
	name: string
	count: number
	avgScore: number
	likedCount: number
}

export interface DecadeStat {
	decade: string
	count: number
	avgScore: number
	likedCount: number
}

export interface CreatorStat {
	id: number
	name: string
	profilePath: string | null
	count: number
	avgScore: number
	role: "director" | "actor"
}

export interface TasteProfileStats {
	genres: GenreStat[]
	decades: DecadeStat[]
	directors: CreatorStat[]
	actors: CreatorStat[]
}

export interface FingerprintStat {
	key: string
	label: string
	description: string
	emoji: string
	score: number
	normalizedScore: number
}

export interface TasteFingerprintStats {
	topKeys: FingerprintStat[]
	allKeys: FingerprintStat[]
}

interface GetTasteStatsParams {
	userId: string
}

export const getTasteGenreStats = async (params: GetTasteStatsParams) => {
	return await cached({
		name: "taste-genres",
		target: _getTasteGenreStats as any,
		params,
		ttlMinutes: 60,
	}) as unknown as GenreStat[]
}

export const getTasteDecadeStats = async (params: GetTasteStatsParams) => {
	return await cached({
		name: "taste-decades",
		target: _getTasteDecadeStats as any,
		params,
		ttlMinutes: 60,
	}) as unknown as DecadeStat[]
}

export const getTasteCreatorStats = async (params: GetTasteStatsParams) => {
	return await cached({
		name: "taste-creators",
		target: _getTasteCreatorStats as any,
		params,
		ttlMinutes: 60,
	}) as unknown as { directors: CreatorStat[]; actors: CreatorStat[] }
}

export const getTasteFingerprintStats = async (params: GetTasteStatsParams) => {
	return await cached({
		name: "taste-fingerprint",
		target: _getTasteFingerprintStats as any,
		params,
		ttlMinutes: 60,
	}) as unknown as TasteFingerprintStats
}

async function _getTasteGenreStats({ userId }: GetTasteStatsParams): Promise<GenreStat[]> {
	const ratedItems = await getRatedItems(userId)
	if (ratedItems.length === 0) return []
	return getGenreStats(ratedItems)
}

async function _getTasteDecadeStats({ userId }: GetTasteStatsParams): Promise<DecadeStat[]> {
	const ratedItems = await getRatedItems(userId)
	if (ratedItems.length === 0) return []
	return getDecadeStats(ratedItems)
}

async function _getTasteCreatorStats({ userId }: GetTasteStatsParams): Promise<{ directors: CreatorStat[]; actors: CreatorStat[] }> {
	const ratedItems = await getRatedItems(userId)
	if (ratedItems.length === 0) return { directors: [], actors: [] }
	const [directors, actors] = await Promise.all([
		getDirectorStats(ratedItems),
		getActorStats(ratedItems),
	])
	return { directors, actors }
}

async function _getTasteFingerprintStats({ userId }: GetTasteStatsParams): Promise<TasteFingerprintStats> {
	const likedItems = await crateQuery<{ tmdb_id: number; media_type: "movie" | "show" }>(`
		SELECT tmdb_id, media_type
		FROM user_score
		WHERE user_id = ? AND score >= 6
	`, [userId])

	if (likedItems.length === 0) {
		return { topKeys: [], allKeys: [] }
	}

	return getFingerprintStats(likedItems)
}

async function getRatedItems(userId: string): Promise<RatedItem[]> {
	return crateQuery<RatedItem>(`
		SELECT tmdb_id, media_type, score
		FROM user_score
		WHERE user_id = ?
	`, [userId])
}

async function getFingerprintStats(likedItems: { tmdb_id: number; media_type: "movie" | "show" }[]): Promise<TasteFingerprintStats> {
	const movieIds = likedItems.filter(i => i.media_type === "movie").map(i => i.tmdb_id)
	const showIds = likedItems.filter(i => i.media_type === "show").map(i => i.tmdb_id)

	const sumColumns = DISTINCT_FINGERPRINT_KEYS.map(key => 
		`SUM(fingerprint_scores['${key}']) as "${key}"`
	).join(", ")

	const results: Record<string, number> = {}
	DISTINCT_FINGERPRINT_KEYS.forEach(key => { results[key] = 0 })

	if (movieIds.length > 0) {
		const placeholders = movieIds.map(() => "?").join(", ")
		const movieResult = await crateQuery<Record<string, number>>(`
			SELECT ${sumColumns}
			FROM movie
			WHERE tmdb_id IN (${placeholders})
		`, movieIds)
		if (movieResult.length > 0) {
			DISTINCT_FINGERPRINT_KEYS.forEach(key => {
				results[key] += movieResult[0][key] ?? 0
			})
		}
	}

	if (showIds.length > 0) {
		const placeholders = showIds.map(() => "?").join(", ")
		const showResult = await crateQuery<Record<string, number>>(`
			SELECT ${sumColumns}
			FROM show
			WHERE tmdb_id IN (${placeholders})
		`, showIds)
		if (showResult.length > 0) {
			DISTINCT_FINGERPRINT_KEYS.forEach(key => {
				results[key] += showResult[0][key] ?? 0
			})
		}
	}

	const maxScore = Math.max(...Object.values(results), 1)
	
	const allKeys: FingerprintStat[] = Object.entries(results)
		.filter(([_, score]) => score > 0)
		.map(([key, score]) => {
			const meta = FINGERPRINT_META[key]
			return {
				key,
				label: meta?.label ?? key,
				description: meta?.description ?? "",
				emoji: meta?.emoji ?? "🏷️",
				score,
				normalizedScore: Math.round((score / maxScore) * 100),
			}
		})
		.sort((a, b) => b.score - a.score)

	return {
		topKeys: allKeys.slice(0, 4),
		allKeys,
	}
}

export async function getTasteProfileStats(userId: string): Promise<TasteProfileStats> {
	const ratedItems = await getRatedItems(userId)

	if (ratedItems.length === 0) {
		return { genres: [], decades: [], directors: [], actors: [] }
	}

	const [genres, decades, directors, actors] = await Promise.all([
		getGenreStats(ratedItems),
		getDecadeStats(ratedItems),
		getDirectorStats(ratedItems),
		getActorStats(ratedItems),
	])

	return { genres, decades, directors, actors }
}

async function getGenreStats(ratedItems: RatedItem[]): Promise<GenreStat[]> {
	const movieIds = ratedItems.filter(i => i.media_type === "movie").map(i => i.tmdb_id)
	const showIds = ratedItems.filter(i => i.media_type === "show").map(i => i.tmdb_id)
	
	const scoreMap = new Map(ratedItems.map(i => [`${i.media_type}-${i.tmdb_id}`, i.score]))
	
	const genreAggregates: Record<string, number[]> = {}

	if (movieIds.length > 0) {
		const placeholders = movieIds.map(() => "?").join(", ")
		const movies = await crateQuery<{ tmdb_id: number; genres: string[] }>(`
			SELECT tmdb_id, genres
			FROM movie
			WHERE tmdb_id IN (${placeholders})
		`, movieIds)

		for (const movie of movies) {
			const score = scoreMap.get(`movie-${movie.tmdb_id}`) ?? 0
			for (const genre of movie.genres || []) {
				if (!genreAggregates[genre]) {
					genreAggregates[genre] = []
				}
				genreAggregates[genre].push(score)
			}
		}
	}

	if (showIds.length > 0) {
		const placeholders = showIds.map(() => "?").join(", ")
		const shows = await crateQuery<{ tmdb_id: number; genres: string[] }>(`
			SELECT tmdb_id, genres
			FROM show
			WHERE tmdb_id IN (${placeholders})
		`, showIds)

		for (const show of shows) {
			const score = scoreMap.get(`show-${show.tmdb_id}`) ?? 0
			for (const genre of show.genres || []) {
				if (!genreAggregates[genre]) {
					genreAggregates[genre] = []
				}
				genreAggregates[genre].push(score)
			}
		}
	}

	return Object.entries(genreAggregates)
		.map(([name, scores]) => ({
			name,
			count: scores.length,
			avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
			likedCount: scores.filter(s => s >= 7).length,
		}))
		.sort((a, b) => b.likedCount - a.likedCount || b.avgScore - a.avgScore)
		.slice(0, 20)
}

async function getDecadeStats(ratedItems: RatedItem[]): Promise<DecadeStat[]> {
	const movieIds = ratedItems.filter(i => i.media_type === "movie").map(i => i.tmdb_id)
	const showIds = ratedItems.filter(i => i.media_type === "show").map(i => i.tmdb_id)
	
	const scoreMap = new Map(ratedItems.map(i => [`${i.media_type}-${i.tmdb_id}`, i.score]))
	
	const decadeAggregates: Record<string, number[]> = {}

	if (movieIds.length > 0) {
		const placeholders = movieIds.map(() => "?").join(", ")
		const movies = await crateQuery<{ tmdb_id: number; release_year: number }>(`
			SELECT tmdb_id, release_year
			FROM movie
			WHERE tmdb_id IN (${placeholders})
		`, movieIds)

		for (const movie of movies) {
			if (!movie.release_year) continue
			const decade = `${Math.floor(movie.release_year / 10) * 10}s`
			const score = scoreMap.get(`movie-${movie.tmdb_id}`) ?? 0
			if (!decadeAggregates[decade]) {
				decadeAggregates[decade] = []
			}
			decadeAggregates[decade].push(score)
		}
	}

	if (showIds.length > 0) {
		const placeholders = showIds.map(() => "?").join(", ")
		const shows = await crateQuery<{ tmdb_id: number; release_year: number }>(`
			SELECT tmdb_id, release_year
			FROM show
			WHERE tmdb_id IN (${placeholders})
		`, showIds)

		for (const show of shows) {
			if (!show.release_year) continue
			const decade = `${Math.floor(show.release_year / 10) * 10}s`
			const score = scoreMap.get(`show-${show.tmdb_id}`) ?? 0
			if (!decadeAggregates[decade]) {
				decadeAggregates[decade] = []
			}
			decadeAggregates[decade].push(score)
		}
	}

	return Object.entries(decadeAggregates)
		.map(([decade, scores]) => ({
			decade,
			count: scores.length,
			avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
			likedCount: scores.filter(s => s >= 7).length,
		}))
		.sort((a, b) => b.likedCount - a.likedCount || b.avgScore - a.avgScore)
}

async function getDirectorStats(ratedItems: RatedItem[]): Promise<CreatorStat[]> {
	const movieItems = ratedItems.filter(i => i.media_type === "movie")
	const showItems = ratedItems.filter(i => i.media_type === "show")
	
	if (movieItems.length === 0 && showItems.length === 0) return []
	
	const scoreMap = new Map(ratedItems.map(i => [`${i.media_type}-${i.tmdb_id}`, i.score]))
	const directorAggregates: Record<number, { name: string; profilePath: string | null; scores: number[] }> = {}

	const processDirectors = async (items: RatedItem[], mediaType: string) => {
		if (items.length === 0) return
		
		const mediaIds = items.map(i => i.tmdb_id)
		const placeholders = mediaIds.map(() => "?").join(", ")
		
		const directors = await crateQuery<{
			media_tmdb_id: number
			person_tmdb_id: number
			name: string
			profile_path: string | null
		}>(`
			SELECT pw.media_tmdb_id, pw.person_tmdb_id, p.name, p.profile_path
			FROM person_worked_on pw
			JOIN person p ON p.tmdb_id = pw.person_tmdb_id
			WHERE pw.media_tmdb_id IN (${placeholders})
				AND pw.media_type = ?
				AND pw.job = 'Director'
		`, [...mediaIds, mediaType])

		for (const director of directors) {
			const score = scoreMap.get(`${mediaType}-${director.media_tmdb_id}`) ?? 0
			if (!directorAggregates[director.person_tmdb_id]) {
				directorAggregates[director.person_tmdb_id] = {
					name: director.name,
					profilePath: director.profile_path,
					scores: []
				}
			}
			directorAggregates[director.person_tmdb_id].scores.push(score)
		}
	}

	await Promise.all([
		processDirectors(movieItems, "movie"),
		processDirectors(showItems, "show"),
	])

	return Object.entries(directorAggregates)
		.filter(([_, { scores }]) => scores.length >= 2)
		.map(([id, { name, profilePath, scores }]) => ({
			id: Number(id),
			name,
			profilePath,
			count: scores.length,
			avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
			role: "director" as const,
		}))
		.sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)
		.slice(0, 10)
}

async function getActorStats(ratedItems: RatedItem[]): Promise<CreatorStat[]> {
	const movieItems = ratedItems.filter(i => i.media_type === "movie")
	const showItems = ratedItems.filter(i => i.media_type === "show")
	
	if (movieItems.length === 0 && showItems.length === 0) return []
	
	const scoreMap = new Map(ratedItems.map(i => [`${i.media_type}-${i.tmdb_id}`, i.score]))
	const actorAggregates: Record<number, { name: string; profilePath: string | null; scores: number[] }> = {}

	const processActors = async (items: RatedItem[], mediaType: string) => {
		if (items.length === 0) return
		
		const mediaIds = items.map(i => i.tmdb_id)
		const placeholders = mediaIds.map(() => "?").join(", ")
		
		const actors = await crateQuery<{
			media_tmdb_id: number
			person_tmdb_id: number
			name: string
			profile_path: string | null
			order_default: number
		}>(`
			SELECT pa.media_tmdb_id, pa.person_tmdb_id, p.name, p.profile_path, pa.order_default
			FROM person_appeared_in pa
			JOIN person p ON p.tmdb_id = pa.person_tmdb_id
			WHERE pa.media_tmdb_id IN (${placeholders})
				AND pa.media_type = ?
				AND pa.order_default <= 5
		`, [...mediaIds, mediaType])

		for (const actor of actors) {
			const score = scoreMap.get(`${mediaType}-${actor.media_tmdb_id}`) ?? 0
			if (!actorAggregates[actor.person_tmdb_id]) {
				actorAggregates[actor.person_tmdb_id] = {
					name: actor.name,
					profilePath: actor.profile_path,
					scores: []
				}
			}
			actorAggregates[actor.person_tmdb_id].scores.push(score)
		}
	}

	await Promise.all([
		processActors(movieItems, "movie"),
		processActors(showItems, "show"),
	])

	return Object.entries(actorAggregates)
		.filter(([_, { scores }]) => scores.length >= 3)
		.map(([id, { name, profilePath, scores }]) => ({
			id: Number(id),
			name,
			profilePath,
			count: scores.length,
			avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
			role: "actor" as const,
		}))
		.sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)
		.slice(0, 10)
}
