import {
	type MediaType,
	type Population,
	type PopulationTitle,
	buildPopulation,
} from "~/domain/fingerprint-effects/population"
import type { CoreScores } from "~/server/utils/fingerprint"

// Each type keeps serving its last successful load while the next load runs.
const DAY_MS = 24 * 60 * 60 * 1000
const states = new Map<
	MediaType,
	{
		value?: Population
		pending?: Promise<Population>
		timer?: ReturnType<typeof setTimeout>
	}
>()

type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
	fingerprint_scores: CoreScores | null
}
function toTitle(row: Row): PopulationTitle {
	return {
		tmdbId: row.tmdb_id,
		title: row.title,
		year: row.release_year,
		poster: row.poster_path,
		goodwatch: row.goodwatch_overall_score_normalized_percent,
		scores: row.fingerprint_scores ?? ({} as CoreScores),
	}
}

/** Population size per type: the most popular released titles that have a fingerprint. */
const SIZE: Record<MediaType, number> = { movie: 3000, show: 2000 }
/**
 * How many popular titles to read for SIZE fingerprinted ones. A `fingerprint_scores IS NOT NULL` filter makes Crate
 * scan the object column (about 14 s), so the query reads a little more and drops the unfingerprinted ones here
 * (about 1% of popular movies and 4% of popular shows lack a fingerprint).
 */
const READ: Record<MediaType, number> = { movie: 3600, show: 2600 }

export function populationSql(type: MediaType) {
	return `SELECT tmdb_id, title, release_year, poster_path, goodwatch_overall_score_normalized_percent, fingerprint_scores
 FROM ${type}
 WHERE release_year <= ?
 ORDER BY popularity DESC LIMIT ${READ[type]}`
}
export async function loadPopulationTitles(
	type: MediaType,
): Promise<PopulationTitle[]> {
	const { query } = await import("~/utils/crate")
	const rows = await query<Row>(populationSql(type), [
		new Date().getUTCFullYear(),
	])
	return rows
		.filter((row) => row.fingerprint_scores)
		.slice(0, SIZE[type])
		.map(toTitle)
}

export function titleFingerprintSql(type: MediaType) {
	return `SELECT tmdb_id, title, release_year, poster_path, goodwatch_overall_score_normalized_percent, fingerprint_scores FROM ${type} WHERE tmdb_id = ? LIMIT 1`
}
export async function loadFingerprintTitle(type: MediaType, id: number) {
	const { query } = await import("~/utils/crate")
	const rows = await query<Row>(titleFingerprintSql(type), [id])
	return rows[0] ? toTitle(rows[0]) : null
}

export function getFingerprintPopulation(type: MediaType): Promise<Population> {
	let state = states.get(type)
	if (!state) {
		state = {}
		states.set(type, state)
	}
	const current = state
	const load = (): Promise<Population> => {
		if (current.pending) return current.pending
		if (current.timer) clearTimeout(current.timer)
		current.pending = loadPopulationTitles(type)
			.then(buildPopulation)
			.then((value) => {
				current.value = value
				return value
			})
			.finally(() => {
				current.pending = undefined
				current.timer = setTimeout(() => {
					void load().catch((error) =>
						console.error("Fingerprint population refresh failed", error),
					)
				}, DAY_MS)
				current.timer.unref()
			})
		return current.pending
	}
	return current.value ? Promise.resolve(current.value) : load()
}

export const FINGERPRINT_CACHE_CONTROL =
	"public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
