// PROTOTYPE - throwaway. Round 7 filters chapter: real Discover counts from no filters at all (every movie and show
// GoodWatch has) down to tonight, one switch at a time: a guest's two services, Not seen yet (an example member who
// has seen the best-known titles), Feel-good, the country's teen age step, then the score stepping 60 → 70 → 80.
// Each step's posters are the best-known titles that pass its filters. Kept in memory and on disk: the lab reloads
// often, and Discover over the whole catalog is not free.
import { filterStateFromParams, sortFromParams } from "~/domain/filter-state"
import { MOODS } from "~/domain/moods"
import { availabilityLoaded } from "~/server/availability-index.server"
import { discoverFilterDefaults, getDiscoverResults } from "~/server/discover-results.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import { getTitleCards } from "~/server/title-cards.server"
import { viewerLadder } from "~/server/title-filter/index.server"
import { type ViewerContext, getViewerContext } from "~/server/viewer.server"
import { query } from "~/utils/crate"
import { type TitleKey, titleKey } from "~/utils/title-key"

export type R7Title = { key: string; title: string; poster: string | null; score: number | null }
export type R7Kind = "all" | "services" | "seen" | "mood" | "age" | "score"
export type R7Step = {
	id: string
	kind: R7Kind
	/** The switch's words. */
	label: string
	/** For the score switch: the threshold this step sets. */
	score?: number
	total: number
	titles: R7Title[]
}
export type R7FilterData = {
	country: string
	/** Every title in the catalog, and the movie and show split, straight from Crate (for the record). */
	catalog: { movies: number; shows: number }
	services: { id: number; name: string; logo: string | null }[]
	mood: { key: string; name: string; hue: string }
	/** The example member's seen count. */
	seenCount: number
	steps: R7Step[]
}

const SNAPSHOT =
	"/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/8a85384e-6a6e-4f4f-9bbd-023729f9c3f3/scratchpad/intro-r7filter.json"
const SERVICES = [8, 9]
const SEEN_COUNT = 150
const SKIP = ["Talk", "News", "Reality", "Soap"]

let cached: Promise<R7FilterData> | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R7FilterData> {
	if (!cached) {
		cached = fromDiskOrBuild(request)
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}

async function fromDiskOrBuild(request: Request): Promise<R7FilterData> {
	const fs = await import("node:fs/promises")
	try {
		return JSON.parse(await fs.readFile(SNAPSHOT, "utf8")) as R7FilterData
	} catch {}
	const data = await build(request)
	await fs.writeFile(SNAPSHOT, JSON.stringify(data)).catch(() => {})
	return data
}

/** The best-known titles, most votes first, two movies to one show; no talk shows, news or reality. */
async function famous(movies: number, shows: number): Promise<TitleKey[]> {
	const top = async (table: "movie" | "show", n: number) =>
		((await query(
			`SELECT tmdb_id, genres FROM ${table} WHERE goodwatch_overall_score_voting_count IS NOT NULL
			   AND goodwatch_overall_score_normalized_percent >= 50 AND release_year >= 1960
			 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT ${Math.round(n * 1.3)}`,
		)) as { tmdb_id: number; genres: string[] | null }[])
			.filter((r) => !(r.genres ?? []).some((g) => SKIP.some((k) => g.includes(k))))
			.slice(0, n)
			.map((r) => titleKey(table, r.tmdb_id))
	const [m, s] = await Promise.all([top("movie", movies), top("show", shows)])
	const out: TitleKey[] = []
	for (let i = 0; out.length < m.length + s.length; i++) {
		if (m[2 * i]) out.push(m[2 * i])
		if (m[2 * i + 1]) out.push(m[2 * i + 1])
		if (s[i]) out.push(s[i])
		if (!m[2 * i] && !s[i]) break
	}
	return out
}

async function cardsFor(keys: TitleKey[], viewer: ViewerContext): Promise<R7Title[]> {
	if (!keys.length) return []
	const cards = await getTitleCards(keys.slice(0, 60), viewer, NO_TASTE)
	return cards.map((c) => ({
		key: String(c.key),
		title: c.title,
		poster: c.poster_path,
		score: c.goodwatch_overall_score_normalized_percent == null ? null : Math.round(c.goodwatch_overall_score_normalized_percent),
	}))
}

async function build(request: Request): Promise<R7FilterData> {
	let viewer = await getViewerContext(request)
	if (!(await availabilityLoaded(viewer.country, 15000))) viewer = { ...viewer, country: "DE" }
	// A guest with no saved services: "no filters" really is everything.
	viewer = { ...viewer, services: [] }
	const FAMOUS = await famous(700, 350)
	const member: ViewerContext = { ...viewer, seen: new Set(FAMOUS.slice(0, SEEN_COUNT)) }

	const count = async (ctx: ViewerContext, q: string) => {
		const params = new URLSearchParams(q)
		const state = filterStateFromParams(params, discoverFilterDefaults(ctx))
		const [result, ranked] = await Promise.all([
			getDiscoverResults(ctx, { state, sort: sortFromParams(params, false), forYou: false, page: 1 }),
			getDiscoverResults(ctx, { state, sort: "relevance", forYou: false, page: 1, ranked: FAMOUS }),
		])
		return { total: result.total, titles: await cardsFor(ranked.keys.slice(0, 60), ctx) }
	}

	const ladder = viewerLadder(viewer)?.steps ?? [{ age: 12, label: "12+" }]
	const teen = ladder.reduce((m, s) => (Math.abs(s.age - 12) < Math.abs(m.age - 12) ? s : m), ladder[0])
	const feelgood = MOODS.find((m) => m.key === "feelgood") ?? MOODS[0]
	const svc = `services=${SERVICES.join(",")}`
	const base = `${svc}&unseen=1&moods=${feelgood.key}&age=${teen.age}`
	const plan: { id: string; kind: R7Kind; label: string; q: string; member?: boolean; score?: number }[] = [
		{ id: "all", kind: "all", label: "No filters", q: "services=all&unseen=0" },
		{ id: "services", kind: "services", label: "On my services", q: `${svc}&unseen=0` },
		{ id: "unseen", kind: "seen", label: "Not seen yet", q: `${svc}&unseen=1`, member: true },
		{ id: "mood", kind: "mood", label: feelgood.name, q: `${svc}&unseen=1&moods=${feelgood.key}`, member: true },
		{ id: "age", kind: "age", label: `Up to ${teen.label}`, q: base, member: true },
		{ id: "score60", kind: "score", label: "Score", score: 60, q: `${base}&score=60`, member: true },
		{ id: "score70", kind: "score", label: "Score", score: 70, q: `${base}&score=70`, member: true },
		{ id: "score80", kind: "score", label: "Score", score: 80, q: `${base}&score=80`, member: true },
	]
	const [steps, movies, shows, svcCards] = await Promise.all([
		Promise.all(
			plan.map(async (p) => {
				const r = await count(p.member ? member : viewer, p.q)
				return { id: p.id, kind: p.kind, label: p.label, score: p.score, total: r.total, titles: r.titles } as R7Step
			}),
		),
		query("SELECT count(*) AS n FROM movie") as Promise<{ n: number }[]>,
		query("SELECT count(*) AS n FROM show") as Promise<{ n: number }[]>,
		getTitleCards([titleKey("show", 66732), titleKey("movie", 157336), titleKey("show", 1399), titleKey("show", 1396)], viewer, NO_TASTE),
	])
	const logos = new Map<number, { id: number; name: string; logo: string | null }>()
	for (const c of svcCards) for (const s of c.services ?? []) if (SERVICES.includes(s.id) && !logos.has(s.id)) logos.set(s.id, { id: s.id, name: s.name, logo: s.logo_path })
	return {
		country: viewer.country,
		catalog: { movies: movies[0]?.n ?? 0, shows: shows[0]?.n ?? 0 },
		services: SERVICES.map((id) => logos.get(id) ?? { id, name: id === 8 ? "Netflix" : "Prime Video", logo: null }),
		mood: { key: feelgood.key, name: feelgood.name, hue: feelgood.hue },
		seenCount: SEEN_COUNT,
		steps,
	}
}
