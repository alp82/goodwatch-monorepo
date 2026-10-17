// PROTOTYPE - throwaway. Extra data for the "searchfilter" intro clips; lands in IntroData.extra["searchfilter"].
// Real searches for a few fixed phrases (the site's own combined search, so its readings come from the Jev cache after
// the first run) and real Discover counts for a few filter steps. Kept in memory for an hour: the lab reloads often.
import { filterStateFromParams, sortFromParams } from "~/domain/filter-state"
import { MOODS } from "~/domain/moods"
import { availabilityLoaded } from "~/server/availability-index.server"
import { combinedSearch } from "~/server/combined-search/search.server"
import { discoverFilterDefaults, getDiscoverResults } from "~/server/discover-results.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import { getTitleCards } from "~/server/title-cards.server"
import { type ViewerContext, getViewerContext } from "~/server/viewer.server"
import { type TitleKey, titleKey } from "~/utils/title-key"

export type SfTitle = {
	key: string
	title: string
	type: "movie" | "show"
	year: string
	poster: string | null
	backdrop: string | null
	score: number | null
	services: { id: number; name: string; logo: string | null }[]
}
export type SfSearch = {
	q: string
	/** The reading the search used, as its chips show it. */
	reading: { text: string; kind: string; key?: string }[]
	people: { id: number; name: string; department: string; profile: string | null }[]
	/** The first person's own titles (their known-for credits), best scored first. */
	credits: SfTitle[]
	titles: SfTitle[]
}
export type SfStep = { label: string; total: number; titles: SfTitle[] }
export type SfData = {
	country: string
	searches: Record<string, SfSearch>
	/** All → a mood → on Netflix → score 70+: what is left at each step. */
	narrow: SfStep[]
	/** Everything, then only the guest's two services. */
	services: { all: SfStep; mine: SfStep; names: string[]; logos: { id: number; name: string; logo: string }[] }
	/** How many titles each mood holds, with its colour. */
	moods: { key: string; name: string; hue: string; total: number }[]
}

export const SF_QUERIES = {
	cozy: "cozy mystery in a small town",
	hug: "something like a warm hug",
	person: "Denis Villeneuve",
	mind: "mind-bending sci-fi",
	heist: "heist with a twist",
}

const TTL_MS = 60 * 60 * 1000
// v7: 20 per step. v6: service logos. v5: Villeneuve. v4: person credits. v3: popular for the wide steps, top once narrowed, reading keys.
let cached: { at: number; data: Promise<SfData> } | null = null

// The site's search records each run in its history, so the prototype runs it once and keeps the answers on
// disk: delete this file to fetch them again.
const SNAPSHOT = "/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/8a85384e-6a6e-4f4f-9bbd-023729f9c3f3/scratchpad/intro-searchfilter.json"

async function fromDiskOrBuild(request: Request): Promise<SfData> {
	const fs = await import("node:fs/promises")
	try {
		return JSON.parse(await fs.readFile(SNAPSHOT, "utf8")) as SfData
	} catch {}
	const data = await build(request)
	await fs.writeFile(SNAPSHOT, JSON.stringify(data)).catch(() => {})
	return data
}

export async function load(request: Request, _landing: LandingCard[]): Promise<SfData> {
	if (!cached || Date.now() - cached.at > TTL_MS) {
		cached = { at: Date.now(), data: fromDiskOrBuild(request) }
		cached.data.catch(() => {
			cached = null
		})
	}
	return cached.data
}

async function build(request: Request): Promise<SfData> {
	let viewer = await getViewerContext(request)
	// Locally the US availability read can time out over the tunnel; then Germany's, as the landing cards do.
	if (!(await availabilityLoaded(viewer.country, 15000))) viewer = { ...viewer, country: "DE" }
	const [searches, narrow, services, moods] = await Promise.all([
		searchAll(viewer),
		narrowSteps(viewer),
		serviceSteps(viewer),
		moodCounts(viewer),
	])
	return { country: viewer.country, searches, narrow, services, moods }
}

async function cardsFor(keys: TitleKey[], viewer: ViewerContext): Promise<SfTitle[]> {
	if (!keys.length) return []
	const cards = await getTitleCards(keys.slice(0, 60), viewer, NO_TASTE)
	return cards.map((c) => ({
		key: String(c.key),
		title: c.title,
		type: c.media_type,
		year: c.release_year ? String(c.release_year) : "",
		poster: c.poster_path,
		backdrop: c.backdrop_path,
		score: c.goodwatch_overall_score_normalized_percent == null ? null : Math.round(c.goodwatch_overall_score_normalized_percent),
		services: (c.services ?? []).map((s) => ({ id: s.id, name: s.name, logo: s.logo_path })),
	}))
}

/** A search row's key as a title key: numeric already, or "movie-123" / "show-123". */
function keyOf(row: { key: string; type: string }): TitleKey | null {
	const n = Number(row.key)
	if (Number.isSafeInteger(n) && n > 1e12) return n as TitleKey
	const m = /(\d+)$/.exec(row.key)
	if (!m) return null
	return titleKey(row.type === "show" || row.type === "tv" ? "show" : "movie", Number(m[1]))
}

async function searchAll(viewer: ViewerContext): Promise<Record<string, SfSearch>> {
	const out: Record<string, SfSearch> = {}
	// One after another: the search admits a few at a time, and these are five.
	for (const [id, q] of Object.entries(SF_QUERIES)) {
		try {
			const batch = await combinedSearch(
				q,
				{ includeAdult: false, lesserKnown: false, filters: {} as never },
				{ accountId: Promise.resolve(null), networkIdentity: "prototype-intro-lab" } as never,
				new AbortController().signal,
			)
			const keys = batch.rows.flatMap((r) => keyOf(r) ?? []).slice(0, 12)
			const person = batch.people[0]
			const creditKeys = (person?.knownFor ?? []).map((t) => titleKey(t.type, t.id))
			const credits = (await cardsFor(creditKeys, viewer)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
			out[id] = {
				credits,
				q,
				reading: batch.reading.map((r) => ({ text: r.text, kind: r.kind, ...(r.key && { key: r.key }) })),
				people: batch.people.slice(0, 3).map((p) => ({ id: p.id, name: p.name, department: p.department, profile: p.profile })),
				titles: await cardsFor(keys, viewer),
			}
		} catch (e) {
			console.error(`intro search "${q}"`, e)
		}
	}
	return out
}

async function step(viewer: ViewerContext, label: string, query: string): Promise<SfStep & { optionCounts?: Record<string, Record<string, number>> }> {
	const params = new URLSearchParams(query)
	const result = await getDiscoverResults(viewer, {
		state: filterStateFromParams(params, discoverFilterDefaults(viewer)),
		sort: sortFromParams(params, false),
		forYou: false,
		page: 1,
	})
	return { label, total: result.total, titles: await cardsFor(result.keys.slice(0, 20), viewer), optionCounts: result.optionCounts as never }
}

async function narrowSteps(viewer: ViewerContext): Promise<SfStep[]> {
	const steps = await Promise.all([
		step(viewer, "Everything", "services=all&unseen=0"),
		step(viewer, "Feel-good", "services=all&unseen=0&moods=feelgood"),
		step(viewer, "On Netflix", "services=8&unseen=0&moods=feelgood&sort=top"),
		step(viewer, "Score 70+", "services=8&unseen=0&moods=feelgood&score=70&sort=top"),
	])
	return steps.map(({ optionCounts: _o, ...s }) => s)
}

async function serviceSteps(viewer: ViewerContext) {
	const [all, mine] = await Promise.all([
		step(viewer, "Every service", "services=all&unseen=0"),
		step(viewer, "Netflix and Prime Video", "services=8,9&unseen=0&sort=top"),
	])
	const strip = ({ optionCounts: _o, ...s }: typeof all) => s
	// The two services' logos, as the titles on them carry them.
	const logos = new Map<number, { id: number; name: string; logo: string }>()
	for (const t of [...mine.titles, ...all.titles])
		for (const s of t.services) if ((s.id === 8 || s.id === 9) && s.logo && !logos.has(s.id)) logos.set(s.id, { id: s.id, name: s.name, logo: s.logo })
	return { all: strip(all), mine: strip(mine), names: ["Netflix", "Prime Video"], logos: [8, 9].flatMap((id) => logos.get(id) ?? []) }
}

async function moodCounts(viewer: ViewerContext) {
	const all = await step(viewer, "Everything", "services=all&unseen=0")
	const counts = all.optionCounts?.moods ?? {}
	return MOODS.map((m) => ({ key: m.key, name: m.name, hue: m.hue, total: counts[m.key] ?? 0 }))
}
