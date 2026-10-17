// PROTOTYPE - throwaway. Round 5 filters chapter: real Discover counts for a visitor's evening, step by step.
// It starts where a person really starts: what is on their two services (a guest's are Netflix and Prime Video), not
// the whole catalog. Then the filters GoodWatch is good at: Not seen yet (for an example member who has seen the most
// watched titles), a mood, an age limit from the country's own ladder, the score, and a released era.
// Kept in memory and on disk: the lab reloads often.
import { filterStateFromParams, sortFromParams } from "~/domain/filter-state"
import { availabilityLoaded } from "~/server/availability-index.server"
import { discoverFilterDefaults, getDiscoverResults } from "~/server/discover-results.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import { getTitleCards } from "~/server/title-cards.server"
import { type ViewerContext, getViewerContext } from "~/server/viewer.server"
import { query } from "~/utils/crate"
import { viewerLadder } from "~/server/title-filter/index.server"
import { MOODS } from "~/domain/moods"
import { type TitleKey, titleKey } from "~/utils/title-key"

export type R5Title = { key: string; title: string; poster: string | null; score: number | null }
export type R5Step = {
	id: string
	/** The chip that switched on for this step. */
	chip: string
	/** What kind of filter it is, for the chip's icon. */
	kind: "services" | "seen" | "mood" | "age" | "score" | "released" | "type"
	total: number
	titles: R5Title[]
}
export type R5Path = { id: string; steps: R5Step[] }
export type R5FilterData = {
	country: string
	services: { id: number; name: string; logo: string | null }[]
	/** The example member's seen titles: how many, and a few of them. */
	seen: { count: number; titles: R5Title[] }
	/** Tonight: services → not seen → feel-good → age 12 → 70+. */
	tonight: R5Path
	/** Family night: services → not seen → age 6 → funny → 70+. */
	family: R5Path
	/** Date night: services → not seen → romance → 70+ → recent. */
	date: R5Path
	/** Each mood's count on the two services, for a mood wall, with its name and colour. */
	moods: { key: string; name: string; hue: string; total: number }[]
}

const SNAPSHOT =
	"/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/8a85384e-6a6e-4f4f-9bbd-023729f9c3f3/scratchpad/intro-r5filter.json"
const SERVICES = [8, 9]
const SEEN_COUNT = 150

let cached: Promise<R5FilterData> | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R5FilterData> {
	if (!cached) {
		cached = fromDiskOrBuild(request)
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}

async function fromDiskOrBuild(request: Request): Promise<R5FilterData> {
	const fs = await import("node:fs/promises")
	try {
		return JSON.parse(await fs.readFile(SNAPSHOT, "utf8")) as R5FilterData
	} catch {}
	const data = await build(request)
	await fs.writeFile(SNAPSHOT, JSON.stringify(data)).catch(() => {})
	return data
}

const SKIP = ["Talk", "News", "Reality", "Soap"]

/** The best-known titles, most votes first, movies and shows mixed two to one; no talk shows, news or reality. */
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

async function cardsFor(keys: TitleKey[], viewer: ViewerContext): Promise<R5Title[]> {
	if (!keys.length) return []
	const cards = await getTitleCards(keys.slice(0, 60), viewer, NO_TASTE)
	return cards.map((c) => ({
		key: String(c.key),
		title: c.title,
		poster: c.poster_path,
		score: c.goodwatch_overall_score_normalized_percent == null ? null : Math.round(c.goodwatch_overall_score_normalized_percent),
	}))
}

/** The best-known titles, set by `build`: each step's posters are the famous ones that pass its filters. */
let FAMOUS: TitleKey[] = []

async function count(viewer: ViewerContext, q: string, n = 24) {
	const params = new URLSearchParams(q)
	const state = filterStateFromParams(params, discoverFilterDefaults(viewer))
	const [result, ranked] = await Promise.all([
		// The real count: Discover's, over the whole catalog.
		getDiscoverResults(viewer, { state, sort: sortFromParams(params, false), forYou: false, page: 1 }),
		// The posters: the best-known titles that pass the same filters, most votes first.
		n ? getDiscoverResults(viewer, { state, sort: "relevance", forYou: false, page: 1, ranked: FAMOUS }) : null,
	])
	return { total: result.total, titles: ranked ? await cardsFor(ranked.keys.slice(0, n), viewer) : [], optionCounts: result.optionCounts }
}

async function path(
	id: string,
	viewer: ViewerContext,
	member: ViewerContext,
	steps: { id: string; chip: string; kind: R5Step["kind"]; q: string; member?: boolean }[],
): Promise<R5Path> {
	const out = await Promise.all(
		steps.map(async (s) => {
			const r = await count(s.member ? member : viewer, s.q)
			return { id: s.id, chip: s.chip, kind: s.kind, total: r.total, titles: r.titles }
		}),
	)
	return { id, steps: out }
}

async function build(request: Request): Promise<R5FilterData> {
	let viewer = await getViewerContext(request)
	if (!(await availabilityLoaded(viewer.country, 15000))) viewer = { ...viewer, country: "DE" }
	FAMOUS = await famous(700, 350)
	// The example member has seen the best-known titles: their posters leave the grid when Not seen yet turns on.
	const seenKeys = FAMOUS.slice(0, SEEN_COUNT)
	// The example member: the same guest, with the most watched titles seen.
	const member: ViewerContext = { ...viewer, seen: new Set(seenKeys) }
	// The age steps by the country's own ladder: the teen step (PG-13, FSK 12) and the family step (PG, FSK 6).
	const steps = viewerLadder(viewer)?.steps ?? [
		{ age: 6, label: "6+" },
		{ age: 12, label: "12+" },
	]
	const nearest = (age: number) => steps.reduce((m, s) => (Math.abs(s.age - age) < Math.abs(m.age - age) ? s : m), steps[0])
	const teen = nearest(12)
	const kids = nearest(8)
	const label = (s: { label: string; show?: string }) => (s.show ? `${s.label} / ${s.show}` : s.label)
	const svc = `services=${SERVICES.join(",")}`
	const base = { id: "services", chip: "Netflix + Prime Video", kind: "services" as const, q: `${svc}&unseen=0` }
	const unseen = { id: "unseen", chip: "Not seen yet", kind: "seen" as const, q: `${svc}&unseen=1`, member: true }
	const [tonight, family, date, all, seen] = await Promise.all([
		path("tonight", viewer, member, [
			base,
			unseen,
			{ id: "mood", chip: "Feel-good", kind: "mood", q: `${svc}&unseen=1&moods=feelgood`, member: true },
			{ id: "age", chip: `Up to ${label(teen)}`, kind: "age", q: `${svc}&unseen=1&moods=feelgood&age=${teen.age}`, member: true },
			{ id: "score", chip: "Score 70+", kind: "score", q: `${svc}&unseen=1&moods=feelgood&age=${teen.age}&score=70`, member: true },
		]),
		path("family", viewer, member, [
			base,
			unseen,
			{ id: "age", chip: `Up to ${label(kids)}`, kind: "age", q: `${svc}&unseen=1&age=${kids.age}`, member: true },
			{ id: "mood", chip: "Funny", kind: "mood", q: `${svc}&unseen=1&age=${kids.age}&moods=funny`, member: true },
			{ id: "score", chip: "Score 70+", kind: "score", q: `${svc}&unseen=1&age=${kids.age}&moods=funny&score=70`, member: true },
		]),
		path("date", viewer, member, [
			base,
			unseen,
			{ id: "mood", chip: "Romance", kind: "mood", q: `${svc}&unseen=1&moods=romance`, member: true },
			{ id: "score", chip: "Score 70+", kind: "score", q: `${svc}&unseen=1&moods=romance&score=70`, member: true },
			{ id: "released", chip: "Recent", kind: "released", q: `${svc}&unseen=1&moods=romance&score=70&released=recent`, member: true },
		]),
		count(viewer, `${svc}&unseen=0`, 0),
		cardsFor(seenKeys.slice(0, 12), viewer),
	])
	const moodCounts = (all.optionCounts as { moods?: Record<string, number> } | undefined)?.moods ?? {}
	// The two services' logos, from the pool's cards.
	const svcCards = await getTitleCards(
		[titleKey("show", 66732), titleKey("movie", 157336), titleKey("show", 1399), titleKey("show", 1396)],
		viewer,
		NO_TASTE,
	)
	const logos = new Map<number, { id: number; name: string; logo: string | null }>()
	for (const c of svcCards) for (const s of c.services ?? []) if (SERVICES.includes(s.id) && !logos.has(s.id)) logos.set(s.id, { id: s.id, name: s.name, logo: s.logo_path })
	return {
		country: viewer.country,
		services: SERVICES.map((id) => logos.get(id) ?? { id, name: id === 8 ? "Netflix" : "Prime Video", logo: null }),
		seen: { count: SEEN_COUNT, titles: seen },
		tonight,
		family,
		date,
		moods: MOODS.map((m) => ({ key: m.key, name: m.name, hue: m.hue, total: (moodCounts[m.key] as number) ?? 0 })),
	}
}
