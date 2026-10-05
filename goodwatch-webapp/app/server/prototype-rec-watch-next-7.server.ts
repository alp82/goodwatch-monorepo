// PROTOTYPE - throwaway. Read-only data for /prototype/rec-watch-next-7 (issue #176, round 7).
// Round 3's loader, plus two things per title it already loaded: the reworked moods (classified from the
// fingerprint and genres) and a release date for the "Newest release" view (films: release date; shows:
// the date the latest episode aired). Simulated fields are dropped: round 3 marks about one title in twelve
// as "leaving soon" from a hash, and its "new on your services" date comes from offer rows whose first-seen
// time is mostly a backfill or republication stamp, so both are cleared here.
import { getWatchNext3 } from "~/server/prototype-rec-watch-next-3.server"
import type { LoaderData } from "~/ui/prototype-rec-watch-next-2/model"
import { type MoodKey, classify } from "~/ui/prototype-rec-watch-next-7/moods"
import { query } from "~/utils/crate"

export type Extra = { m: MoodKey[]; rel: number | null }
export type LoaderData7 = LoaderData & { extra: Record<string, Extra> }

type Row = { tmdb_id: number; fp: Record<string, number> | null; genres: string[] | null; rel: number | string | Date | null }

// Crate dates can arrive as epoch milliseconds or as Date objects; the page wants milliseconds.
const ms = (v: Row["rel"]) => (v == null ? null : typeof v === "number" ? v : new Date(v).getTime() || null)

// Per title for the life of the process: fingerprints and dates change rarely, and this keeps Crate quiet.
const cache = new Map<string, Extra>()

async function load(type: "movie" | "show", ids: number[]) {
	for (let i = 0; i < ids.length; i += 500) {
		const chunk = ids.slice(i, i + 500)
		const rows = await query<Row>(
			`SELECT tmdb_id, fingerprint_scores AS fp, genres, ${type === "movie" ? "release_date" : "last_air_date"} AS rel
			 FROM ${type} WHERE tmdb_id IN (${chunk.map(() => "?").join(",")}) LIMIT ${chunk.length}`,
			chunk,
		)
		const seen = new Set<number>()
		for (const r of rows) {
			seen.add(r.tmdb_id)
			cache.set(`${type}:${r.tmdb_id}`, { m: classify(r.fp, r.genres), rel: ms(r.rel) })
		}
		for (const id of chunk) if (!seen.has(id)) cache.set(`${type}:${id}`, { m: [], rel: null })
	}
}

export async function getWatchNext7(request: Request): Promise<LoaderData7> {
	const base = await getWatchNext3(request)
	const missing = base.titles.filter((t) => !cache.has(t.key))
	await Promise.all((["movie", "show"] as const).map((type) => load(type, missing.filter((t) => t.type === type).map((t) => t.id))))
	const extra: Record<string, Extra> = {}
	for (const t of base.titles) {
		const e = cache.get(t.key)
		extra[t.key] = e ? { m: e.m, rel: ms(e.rel) } : { m: [], rel: null }
	}
	return {
		...base,
		titles: base.titles.map((t) => ({ ...t, leavingInDays: null, newOnMine: null })),
		extra,
	}
}
