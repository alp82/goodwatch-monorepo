// PROTOTYPE - throwaway. Round 6 data for the "r6map" Explorer clips (chapter 7); lands in IntroData.extra["r6map"].
// Real islands from three of the Explorer's groupings (moods, themes, styles), and the best combinations across them:
// two islands from different groupings, and three (one from each), chosen by how many of their shared titles are
// famous (in the intro's pool). Grim islands stay out. Saved to a scratchpad file, so the search runs once.
// The streaming clips (chapter 8) read data.extra.r5map.
import type { ExplorerIsland, ExplorerTitle, Grouping } from "~/domain/explorer"
import { getExplorerMap } from "~/server/explorer/index.server"
import { getCombination, getShares } from "~/server/explorer/world.server"
import { loadPool } from "~/server/prototype-intro/pool.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { getViewerContext } from "~/server/viewer.server"

export type R6Title = { key: number; title: string; poster: string; backdrop: string | null; score: number | null }
export type R6Island = {
	id: string
	grouping: Grouping
	name: string
	color: string
	count: number
	x: number
	y: number
	picture: string | null
}
export type R6Combo = {
	/** The picked islands, in the order they are picked. */
	of: { grouping: Grouping; id: string }[]
	/** Titles after each pick: the first island's, then the first two's, then all three's. */
	counts: number[]
	/** Famous shared titles first. */
	titles: R6Title[]
	famous: number
}
export type R6MapData = { islands: R6Island[]; two: R6Combo | null; three: R6Combo | null }

const GROUPS: Grouping[] = ["mood", "theme", "style"]
// Grim islands, and styles that read oddly in a combination ("Magical + Music").
const GRIM = /scar|dark|sad|disturb|bleak|horror|grief|death|war|crime|violen|abuse|trauma|tense|music|documentary|talky|slow/i
const SNAPSHOT =
	"/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/8a85384e-6a6e-4f4f-9bbd-023729f9c3f3/scratchpad/intro-r6map.json"

let kept: Promise<R6MapData> | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R6MapData> {
	if (!kept) {
		kept = fromDiskOrBuild(request)
		kept.catch(() => {
			kept = null
		})
	}
	return kept
}

async function fromDiskOrBuild(request: Request): Promise<R6MapData> {
	const fs = await import("node:fs/promises")
	try {
		return JSON.parse(await fs.readFile(SNAPSHOT, "utf8")) as R6MapData
	} catch {}
	const data = await build(request)
	await fs.writeFile(SNAPSHOT, JSON.stringify(data)).catch(() => {})
	return data
}

const slim = (t: ExplorerTitle): R6Title => ({ key: Number(t.key), title: t.title, poster: t.poster, backdrop: t.backdrop, score: t.score })

async function build(request: Request): Promise<R6MapData> {
	const [ctx, pool] = await Promise.all([getViewerContext(request), loadPool(request).catch(() => [] as LandingCard[])])
	const famous = new Map(pool.map((c, i) => [Number(c.key), i]))
	const rank = (ts: ExplorerTitle[]) =>
		[...ts].sort((p, q) => (famous.get(Number(p.key)) ?? 999) - (famous.get(Number(q.key)) ?? 999) || (q.score ?? 0) - (p.score ?? 0))
	const query = { grouping: "mood", services: "all", unseen: "0" }

	const maps = await Promise.all(GROUPS.map((grouping) => getExplorerMap(ctx, { ...query, grouping })))
	const islands: R6Island[] = maps.flatMap((m, g) =>
		m.islands.map((i: ExplorerIsland) => ({
			id: i.id,
			grouping: GROUPS[g],
			name: i.name,
			color: i.color,
			count: i.count,
			x: i.x,
			y: i.y,
			picture: rank(i.titles).find((t) => t.backdrop)?.backdrop ?? null,
		})),
	)
	const friendly = islands.filter((i) => !GRIM.test(i.id) && !GRIM.test(i.name))
	const ref = (i: { grouping: Grouping; id: string }) => ({ grouping: i.grouping, id: i.id })
	const key = (i: { grouping: Grouping; id: string }) => `${i.grouping}:${i.id}`
	const byKey = new Map(islands.map((i) => [key(i), i]))

	/** The combination of `refs`, scored by its famous titles. */
	const combine = async (refs: { grouping: Grouping; id: string }[], counts: number[]): Promise<R6Combo | null> => {
		const c = await getCombination(ctx, query, refs).catch(() => null)
		if (!c || c.count < 12) return null
		const titles = rank(c.titles)
		return {
			of: refs,
			counts: [...counts, c.count],
			titles: titles.slice(0, 10).map(slim),
			famous: titles.filter((t) => famous.has(Number(t.key))).length,
		}
	}
	const better = (p: R6Combo | null, q: R6Combo | null) =>
		!p ? q : !q ? p : q.famous > p.famous || (q.famous === p.famous && q.counts.at(-1)! > p.counts.at(-1)!) ? q : p

	const SAME: Record<string, string[]> = { magical: ["fantasy"], thrilling: ["fast"], funny: ["comedy"], cozy: ["family"], deep: ["mind"] }
	const repeats = (picked: { id: string }[], id: string) => picked.some((r) => SAME[r.id]?.includes(id) || SAME[id]?.includes(r.id))
	// Two islands from different groupings: a mood first, then its best theme or style.
	let two: R6Combo | null = null
	const pairs: R6Combo[] = []
	for (const a of friendly.filter((i) => i.grouping === "mood")) {
		const shares = await getShares(ctx, query, [ref(a)]).catch(() => null)
		const options = (shares?.shares ?? [])
			.map((s) => ({ s, i: byKey.get(s.id) ?? islands.find((x) => x.id === s.id && x.grouping !== "mood") }))
			.filter(({ s, i }) => i && i.grouping !== "mood" && !GRIM.test(i.id) && !GRIM.test(i.name) && !repeats([a], i.id) && s.count >= 40)
			.sort((p, q) => q.s.count - p.s.count)
			.slice(0, 4)
		for (const { i } of options) {
			const c = await combine([ref(a), ref(i!)], [a.count])
			if (c) {
				pairs.push(c)
				two = better(two, c)
			}
		}
	}

	// Three: extend the best pairs with an island from the grouping they don't have yet, never one that only repeats
	// a pick ("Magical + Fantasy").
	let three: R6Combo | null = null
	for (const p of pairs.sort((x, y) => y.famous - x.famous).slice(0, 5)) {
		const have = new Set(p.of.map((r) => r.grouping))
		const shares = await getShares(ctx, query, p.of).catch(() => null)
		const options = (shares?.shares ?? [])
			.map((s) => ({ s, i: byKey.get(s.id) ?? islands.find((x) => x.id === s.id && !have.has(x.grouping)) }))
			.filter(({ s, i }) => i && !have.has(i.grouping) && !GRIM.test(i.id) && !GRIM.test(i.name) && !repeats(p.of, i.id) && s.count >= 15)
			.sort((x, y) => y.s.count - x.s.count)
			.slice(0, 4)
		for (const { i } of options) three = better(three, await combine([...p.of, ref(i!)], p.counts))
	}
	return { islands, two, three }
}
