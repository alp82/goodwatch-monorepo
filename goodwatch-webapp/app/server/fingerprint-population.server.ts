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
	const rows = await query<Row>(
		populationSql(type),
		[new Date().getUTCFullYear()],
		{ timeoutMs: 60_000 },
	)
	return rows
		.filter((row) => row.fingerprint_scores)
		.slice(0, SIZE[type])
		.map(toTitle)
}

export function titleFingerprintSql(type: MediaType) {
	return `SELECT tmdb_id, title, release_year, poster_path, goodwatch_overall_score_normalized_percent, fingerprint_scores FROM ${type} WHERE tmdb_id = ? LIMIT 1`
}
type FingerprintTitle = Omit<PopulationTitle, "scores"> & {
	scores: CoreScores | null
}
const TITLE_TTL_MS = 60 * 60 * 1000
const TITLE_CACHE_SIZE = 2000
const titleCache = new Map<
	string,
	{ value: FingerprintTitle | null; expires: number }
>()
const titleLoads = new Map<string, Promise<FingerprintTitle | null>>()

export function loadFingerprintTitle(
	type: MediaType,
	id: number,
): Promise<FingerprintTitle | null> {
	const key = `${type}:${id}`
	const cached = titleCache.get(key)
	if (cached) {
		titleCache.delete(key)
		if (cached.expires > Date.now()) {
			titleCache.set(key, cached)
			return Promise.resolve(cached.value)
		}
	}
	const pending = titleLoads.get(key)
	if (pending) return pending
	const load = import("~/utils/crate")
		.then(({ query }) => query<Row>(titleFingerprintSql(type), [id]))
		.then((rows) => {
			const row = rows[0]
			const value = row
				? { ...toTitle(row), scores: row.fingerprint_scores }
				: null
			titleCache.set(key, { value, expires: Date.now() + TITLE_TTL_MS })
			while (titleCache.size > TITLE_CACHE_SIZE) {
				const oldest = titleCache.keys().next().value
				if (oldest !== undefined) titleCache.delete(oldest)
			}
			return value
		})
		.finally(() => titleLoads.delete(key))
	titleLoads.set(key, load)
	return load
}

/** Start both loads without holding up server startup; requests share the same work. */
export function startFingerprintPopulation() {
	for (const type of ["movie", "show"] as const) {
		void getFingerprintPopulation(type).catch((error) =>
			console.error("Fingerprint population warm-up failed", type, error),
		)
	}
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
			.then((titles) => {
				if (titles.length < SIZE[type] * 0.9) {
					throw new Error(
						`Fingerprint population ${type} too short: ${titles.length}/${SIZE[type]}`,
					)
				}
				return buildPopulation(titles)
			})
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
