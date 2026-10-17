// PROTOTYPE - throwaway. Round 14: franchise keys for the search results and the Explorer's shared titles, so each row
// shows at most one title per franchise. A movie's franchise is its TMDB collection (movie.movie_series_id); a show
// or a movie without one is its own. Read-only, once; kept in memory for the dev server's life.
import type { LandingCard } from "~/server/prototype-landing.server"
import { query } from "~/utils/crate"
import { parseTitleKey } from "~/utils/title-key"

export type R14BData = { series: Record<string, number> }

let cached: Promise<R14BData> | null = null

const keysOf = async (): Promise<string[]> => {
	const fs = await import("node:fs/promises")
	const dir = "/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/8a85384e-6a6e-4f4f-9bbd-023729f9c3f3/scratchpad"
	const keys: string[] = []
	try {
		const s = JSON.parse(await fs.readFile(`${dir}/intro-r5feel-search.json`, "utf8"))
		for (const q of Object.values(s) as { titles?: { key: string }[] }[]) for (const t of q.titles ?? []) keys.push(String(t.key))
	} catch {}
	try {
		const m = JSON.parse(await fs.readFile(`${dir}/intro-r6map.json`, "utf8"))
		for (const c of [m.two, m.three]) for (const t of c?.titles ?? []) keys.push(String(t.key))
	} catch {}
	return [...new Set(keys)]
}

async function build(): Promise<R14BData> {
	const ids = (await keysOf())
		.map((k) => parseTitleKey(Number(k)))
		.filter((p) => p.mediaType === "movie")
		.map((p) => p.tmdbId)
	if (!ids.length) return { series: {} }
	const rows = (await query(
		`SELECT tmdb_id, movie_series_id FROM movie WHERE tmdb_id IN (${ids.map(() => "?").join(",")}) AND movie_series_id IS NOT NULL`,
		ids,
	)) as { tmdb_id: number; movie_series_id: number }[]
	return { series: Object.fromEntries(rows.map((r) => [String(r.tmdb_id), r.movie_series_id])) }
}

export async function load(_request: Request, _landing: LandingCard[]): Promise<R14BData> {
	if (!cached) {
		cached = build()
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}
