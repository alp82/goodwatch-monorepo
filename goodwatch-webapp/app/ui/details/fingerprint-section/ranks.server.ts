// Where a title's feelings rank among popular titles, for the fingerprint sub-page's detail ("Stronger than 9 in 10
// popular movies"). It reads the population the server already keeps warm (server/fingerprint-population.server.ts:
// the 3000 most popular released movies, 2000 shows, refreshed daily), so it costs no query: per effect and per
// section (an axis, as strong as its strongest member), the share of those titles below and above this title's
// strength. A population that isn't ready within the budget leaves the ranks out; the page shows none then.
import { EFFECTS, readEffects } from "~/domain/fingerprint-effects/effects"
import type { Population } from "~/domain/fingerprint-effects/population"
import { getFingerprintPopulation } from "~/server/fingerprint-population.server"
import type { CoreScores } from "~/server/utils/fingerprint"
import { AXES } from "~/ui/details/fingerprint-section/reading"
import { type FpRanks, sectionRankKey } from "./print-model"

const sortedCache = new WeakMap<Population, Map<string, number[]>>()

/** Every effect's and every axis's strengths across the population, ascending (once per population load). */
function sorted(pop: Population) {
	let m = sortedCache.get(pop)
	if (m) return m
	m = new Map()
	for (const e of EFFECTS)
		m.set(
			e.id,
			[...(pop.strengths.get(e.id) ?? [])].sort((a, b) => a - b),
		)
	for (const ax of AXES) {
		const per = pop.titles.map((_, i) =>
			Math.max(...ax.members.map((id) => pop.strengths.get(id)?.[i] ?? 0)),
		)
		m.set(
			sectionRankKey(ax.id),
			per.sort((a, b) => a - b),
		)
	}
	sortedCache.set(pop, m)
	return m
}

/** How many of the ascending `xs` are below `v` (strictly) and above it (strictly). */
function split(xs: number[], v: number): [number, number] {
	const eps = 1e-9
	let lo = 0
	let hi = xs.length
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (xs[mid] < v - eps) lo = mid + 1
		else hi = mid
	}
	const below = lo
	hi = xs.length
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (xs[mid] <= v + eps) lo = mid + 1
		else hi = mid
	}
	return [below, xs.length - lo]
}

const round = (x: number) => Math.round(x * 1000) / 1000

/** The title's ranks, or null when the population isn't ready within `budgetMs` or the read fails. */
export async function fingerprintRanks(
	type: "movie" | "show",
	scores: CoreScores | null | undefined,
	budgetMs = 1500,
): Promise<FpRanks | null> {
	if (!scores || !Object.keys(scores).length) return null
	try {
		const work = getFingerprintPopulation(type)
		work.catch(() => {})
		const pop = await Promise.race([
			work,
			new Promise<null>((r) => setTimeout(() => r(null), budgetMs).unref?.()),
		])
		if (!pop || !pop.titles.length) return null
		const dist = sorted(pop)
		const n = pop.titles.length
		const mine = new Map(
			readEffects(scores).map((r) => [r.effect.id, r.strength]),
		)
		const ranks: FpRanks["ranks"] = {}
		const put = (id: string, v: number) => {
			const xs = dist.get(id)
			if (!xs?.length) return
			const [b, a] = split(xs, v)
			ranks[id] = [round(b / n), round(a / n)]
		}
		for (const [id, v] of mine) put(id, v)
		for (const ax of AXES)
			put(
				sectionRankKey(ax.id),
				Math.max(...ax.members.map((id) => mine.get(id) ?? 0)),
			)
		return { of: n, ranks }
	} catch {
		return null
	}
}
