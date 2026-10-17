// PROTOTYPE - throwaway. Extra data for the "r5feel" intro clips (chapter 4, how it feels; chapter 5, search by
// feeling); lands in IntroData.extra["r5feel"]. All real: the hero's title analysis scores, and three mainstream
// searches by feeling run once through the site's own search and kept on disk (each run writes search history).
import { availabilityLoaded } from "~/server/availability-index.server"
import { combinedSearch } from "~/server/combined-search/search.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { loadPool } from "~/server/prototype-intro/pool.server"
import { adjective, isWorded } from "~/server/taste-portrait/words.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import { getTitleCards } from "~/server/title-cards.server"
import { type CoreScores, type PillarTiers, computePillarScores } from "~/server/utils/fingerprint"
import { getViewerContext } from "~/server/viewer.server"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { query } from "~/utils/crate"
import { type TitleKey, titleKey } from "~/utils/title-key"

export type R5Attr = { key: string; label: string; adjective: string; emoji: string; color: string; value: number }
export type R5Hero = {
	title: string
	poster_path: string | null
	backdrop_path: string | null
	year: number | null
	score: number | null
	pillars: PillarTiers
	/** The strongest worded attributes (no craft), strongest first; values 0-10. */
	top: R5Attr[]
}
export type R5Result = { key: string; title: string; year: number | null; poster: string | null; score: number | null; votes: number }
export type R5Search = {
	q: string
	/** The reading the search used, as its chips show it. */
	reading: { text: string; kind: string; key?: string }[]
	/** The search's own results (its first 24), best known first. */
	titles: R5Result[]
}
export type R5FeelData = {
	hero: R5Hero | null
	/** The next two pool titles (The Dark Knight, Game of Thrones), the same way: for the feel-card exploration. */
	others: R5Hero[]
	searches: Record<string, R5Search>
}

export const R5_QUERIES = {
	space: "a mind-blowing space adventure",
	date: "something funny for date night",
	epic: "an epic fantasy adventure",
}

const SNAPSHOT =
	"/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/8a85384e-6a6e-4f4f-9bbd-023729f9c3f3/scratchpad/intro-r5feel-search.json"

let cached: Promise<R5FeelData> | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R5FeelData> {
	if (!cached) {
		cached = (async () => {
			const [hero, others, searches] = await Promise.all([
				loadHero(request, 0),
				Promise.all([loadHero(request, 1), loadHero(request, 2)]),
				searchesFromDisk(request),
			])
			return { hero, others: others.flatMap((o) => o ?? []), searches }
		})()
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}

async function loadHero(request: Request, index: number): Promise<R5Hero | null> {
	const pool = await loadPool(request)
	const h = pool[index]
	if (!h) return null
	const rows = await query<{ fingerprint_scores: Record<string, number> | null }>(
		`SELECT fingerprint_scores FROM ${h.media_type} WHERE tmdb_id = ?`,
		[h.tmdb_id],
	)
	const fp = rows[0]?.fingerprint_scores ?? {}
	const top = Object.entries(fp)
		.filter(([k, v]) => isWorded(k) && typeof v === "number")
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([key, value]) => {
			const meta = FINGERPRINT_META[key]
			return {
				key,
				label: meta?.label ?? key,
				adjective: adjective(key),
				emoji: meta?.emoji ?? "",
				color: meta?.color ?? "rgba(251,191,36,.6)",
				value,
			}
		})
	return {
		title: h.title,
		poster_path: h.poster_path,
		backdrop_path: h.backdrop_path,
		year: h.release_year,
		score: h.goodwatch_overall_score_normalized_percent == null ? null : Math.round(h.goodwatch_overall_score_normalized_percent),
		pillars: computePillarScores(fp as CoreScores),
		top,
	}
}

async function searchesFromDisk(request: Request): Promise<Record<string, R5Search>> {
	const fs = await import("node:fs/promises")
	try {
		return JSON.parse(await fs.readFile(SNAPSHOT, "utf8"))
	} catch {}
	const out = await runSearches(request)
	if (Object.keys(out).length) await fs.writeFile(SNAPSHOT, JSON.stringify(out)).catch(() => {})
	return out
}

/** A search row's key as a title key: numeric already, or "movie-123" / "show-123". */
function keyOf(row: { key: string; type: string }): TitleKey | null {
	const n = Number(row.key)
	if (Number.isSafeInteger(n) && n > 1e12) return n as TitleKey
	const m = /(\d+)$/.exec(row.key)
	if (!m) return null
	return titleKey(row.type === "show" || row.type === "tv" ? "show" : "movie", Number(m[1]))
}

async function runSearches(request: Request): Promise<Record<string, R5Search>> {
	let viewer = await getViewerContext(request)
	if (!(await availabilityLoaded(viewer.country, 15000))) viewer = { ...viewer, country: "DE" }
	const out: Record<string, R5Search> = {}
	for (const [id, q] of Object.entries(R5_QUERIES)) {
		try {
			const batch = await combinedSearch(
				q,
				{ includeAdult: false, lesserKnown: false, filters: {} as never },
				{ accountId: Promise.resolve(null), networkIdentity: "prototype-intro-lab" } as never,
				new AbortController().signal,
			)
			const keys = batch.rows.flatMap((r) => keyOf(r) ?? []).slice(0, 24)
			const cards = keys.length ? await getTitleCards(keys, viewer, NO_TASTE) : []
			out[id] = {
				q,
				reading: batch.reading.map((r) => ({ text: r.text, kind: r.kind, ...(r.key && { key: r.key }) })),
				titles: cards
					.map((c) => ({
						key: String(c.key),
						title: c.title,
						year: c.release_year,
						poster: c.poster_path,
						score: c.goodwatch_overall_score_normalized_percent == null ? null : Math.round(c.goodwatch_overall_score_normalized_percent),
						votes: c.goodwatch_overall_score_voting_count ?? 0,
					}))
					.sort((a, b) => b.votes - a.votes),
			}
		} catch (e) {
			console.error(`intro r5 search "${q}"`, e)
		}
	}
	return out
}
