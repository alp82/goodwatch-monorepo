// PROTOTYPE - throwaway. Extra data for the "r6feel" intro clips; lands in IntroData.extra["r6feel"].
// Chapter 4 shows each of the hero's feelings over a backdrop that fits it: the backdrop of the famous pool title
// whose title analysis scores highest on that same attribute (Interstellar's own image set isn't stored, only one
// backdrop per title). Each feeling gets a different title. Chapter 5 reuses round 5's search snapshot (r5feel).
import type { LandingCard } from "~/server/prototype-landing.server"
import { loadPool } from "~/server/prototype-intro/pool.server"
import { adjective, isWorded } from "~/server/taste-portrait/words.server"
import { query } from "~/utils/crate"

/** The feelings the clips can say out loud: the same rule as r5feel's `sayable` (plain one-word adjectives). */
const sayable = (key: string) => {
	if (!isWorded(key) || /centrality/.test(key)) return false
	const a = adjective(key)
	return !/-(focused|led)$/.test(a) && !a.includes(" ")
}

export type R6Fit = {
	/** The fingerprint key of the feeling. */
	key: string
	/** The pool title whose backdrop fits it, and how strongly that title has it (0-10). */
	title: string
	backdrop: string
	value: number
}
export type R6FeelData = { fits: Record<string, R6Fit> }

let cached: Promise<R6FeelData> | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R6FeelData> {
	if (!cached) {
		cached = build(request)
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}

async function build(request: Request): Promise<R6FeelData> {
	const pool = await loadPool(request)
	const hero = pool[0]
	if (!hero) return { fits: {} }
	const others = pool.slice(1).filter((c) => c.backdrop_path)
	const scores = new Map<string, Record<string, number>>()
	for (const table of ["movie", "show"] as const) {
		const ids = others.filter((c) => c.media_type === table).map((c) => c.tmdb_id)
		if (!ids.length) continue
		const rows = await query<{ tmdb_id: number; fingerprint_scores: Record<string, number> | null }>(
			`SELECT tmdb_id, fingerprint_scores FROM ${table} WHERE tmdb_id IN (${ids.map(() => "?").join(", ")})`,
			ids,
		)
		for (const r of rows) scores.set(`${table}-${r.tmdb_id}`, r.fingerprint_scores ?? {})
	}
	const heroRows = await query<{ fingerprint_scores: Record<string, number> | null }>(
		`SELECT fingerprint_scores FROM ${hero.media_type} WHERE tmdb_id = ?`,
		[hero.tmdb_id],
	)
	// The hero's strongest attributes, the same order the clips' `sayable` reads them in.
	const heroKeys = Object.entries(heroRows[0]?.fingerprint_scores ?? {})
		.filter(([k, v]) => typeof v === "number" && sayable(k))
		.sort((a, b) => b[1] - a[1])
		.slice(0, 6)
		.map(([k]) => k)
	const used = new Set<string>()
	const fits: Record<string, R6Fit> = {}
	for (const key of heroKeys) {
		const best = others
			.filter((c) => !used.has(`${c.media_type}-${c.tmdb_id}`))
			.map((c) => ({ c, v: scores.get(`${c.media_type}-${c.tmdb_id}`)?.[key] ?? 0 }))
			.sort((a, b) => b.v - a.v)[0]
		if (!best || best.v <= 0 || !best.c.backdrop_path) continue
		used.add(`${best.c.media_type}-${best.c.tmdb_id}`)
		fits[key] = { key, title: best.c.title, backdrop: best.c.backdrop_path, value: best.v }
	}
	return { fits }
}
