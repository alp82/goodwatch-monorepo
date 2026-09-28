// The display fields of the titles a portrait shows (name, year, poster, backdrop), which the title snapshot doesn't
// carry: one primary-key read per media type for the titles not already known, kept in process memory for 6 hours.
// The title cards module (#204) will own this read; the portrait can switch to it then.
import type { TitleKey } from "~/server/title-snapshot/index.server"
import { query } from "~/utils/crate"
import { parseTitleKey, titleKey } from "~/utils/title-key"

export interface TitleDisplay {
	title: string
	year: number | null
	poster: string | null
	backdrop: string | null
}

const KEEP_MS = 6 * 60 * 60_000
const MAX_KEPT = 50_000
// One statement per media type and batch, far below Crate's timeout: primary-key lookups.
const BATCH = 400

const kept = new Map<
	TitleKey,
	{ until: number; display: TitleDisplay | null }
>()

async function read(
	mediaType: "movie" | "show",
	ids: number[],
): Promise<Map<TitleKey, TitleDisplay>> {
	const found = new Map<TitleKey, TitleDisplay>()
	const batches: number[][] = []
	for (let i = 0; i < ids.length; i += BATCH)
		batches.push(ids.slice(i, i + BATCH))
	await Promise.all(
		batches.map(async (batch) => {
			const rows = await query<{
				tmdb_id: number
				title: string | null
				release_year: number | null
				poster_path: string | null
				backdrop_path: string | null
			}>(
				`SELECT tmdb_id, title, release_year, poster_path, backdrop_path FROM ${mediaType}
				 WHERE tmdb_id IN (${batch.map(() => "?").join(",")}) LIMIT ${batch.length}`,
				batch,
			)
			for (const row of rows)
				found.set(titleKey(mediaType, Number(row.tmdb_id)), {
					title: row.title ?? "",
					year: row.release_year ?? null,
					poster: row.poster_path ?? null,
					backdrop: row.backdrop_path ?? null,
				})
		}),
	)
	return found
}

/** Display fields by title key; a title Crate doesn't know is missing from the result. */
export async function titleDisplays(
	keys: Iterable<TitleKey>,
): Promise<Map<TitleKey, TitleDisplay>> {
	const now = Date.now()
	const result = new Map<TitleKey, TitleDisplay>()
	const missing = { movie: [] as number[], show: [] as number[] }
	for (const key of new Set(keys)) {
		const hit = kept.get(key)
		if (hit && hit.until > now) {
			if (hit.display) result.set(key, hit.display)
			continue
		}
		const { mediaType, tmdbId } = parseTitleKey(key)
		missing[mediaType].push(tmdbId)
	}
	const [movies, shows] = await Promise.all([
		missing.movie.length ? read("movie", missing.movie) : new Map(),
		missing.show.length ? read("show", missing.show) : new Map(),
	])
	const until = now + KEEP_MS
	for (const [mediaType, ids, found] of [
		["movie", missing.movie, movies],
		["show", missing.show, shows],
	] as const)
		for (const tmdbId of ids) {
			const key = titleKey(mediaType, tmdbId)
			const display = found.get(key) ?? null
			kept.delete(key)
			kept.set(key, { until, display })
			if (display) result.set(key, display)
		}
	// Drop the oldest beyond the cap (a Map iterates in insertion order).
	for (const key of kept.keys()) {
		if (kept.size <= MAX_KEPT) break
		kept.delete(key)
	}
	return result
}
