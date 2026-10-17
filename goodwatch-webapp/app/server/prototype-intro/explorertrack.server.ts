// PROTOTYPE - throwaway. Extra data for the "explorertrack" intro clips; lands in IntroData.extra["explorertrack"].
// The Explorer's mood map as a guest sees it (every service), a real bridge between two of its islands, and a title
// that sits on several islands at once.
import type { ExplorerIsland, ExplorerTitle } from "~/domain/explorer"
import { getExplorerMap } from "~/server/explorer/index.server"
import { getCombination } from "~/server/explorer/world.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { getViewerContext } from "~/server/viewer.server"

export type EtTitle = { key: string; title: string; poster: string; backdrop: string | null; year: number | null; score: number | null }
export type EtIsland = { id: string; name: string; color: string; count: number; x: number; y: number; apart: string; titles: EtTitle[] }
export type ExplorerTrackData = {
	islands: EtIsland[]
	/** Two islands next to each other and the titles on both. */
	bridge: { a: string; b: string; count: number; titles: EtTitle[] } | null
	/** A title on several islands, and those islands' ids. */
	placed: { title: EtTitle; on: string[] } | null
}

const slim = (t: ExplorerTitle): EtTitle => ({
	key: String(t.key),
	title: t.title,
	poster: t.poster,
	backdrop: t.backdrop,
	year: t.year,
	score: t.score,
})
const island = (i: ExplorerIsland): EtIsland => ({
	id: i.id,
	name: i.name,
	color: i.color,
	count: i.count,
	x: i.x,
	y: i.y,
	apart: i.apart,
	titles: i.titles.slice(0, 6).map(slim),
})

export async function load(request: Request, _landing: LandingCard[]): Promise<ExplorerTrackData> {
	const ctx = await getViewerContext(request)
	const query = { grouping: "mood", services: "all", unseen: "0" }
	const map = await getExplorerMap(ctx, query)
	const islands = map.islands.map(island)

	// The bridge: two islands close on the map whose shared titles are many.
	const pairs: [ExplorerIsland, ExplorerIsland, number][] = []
	for (const a of map.islands)
		for (const b of map.islands)
			if (a.id < b.id) pairs.push([a, b, Math.hypot(a.x - b.x, a.y - b.y)])
	pairs.sort((p, q) => p[2] - q[2])
	// An intro wants a friendly pair first: these, in order, then the closest pairs.
	const FRIENDLY = [["cozy", "magical"], ["funny", "romantic"], ["funny", "cozy"], ["magical", "thrilling"], ["romantic", "sad"]]
	const byId = new Map(map.islands.map((i) => [i.id, i]))
	const tries: [ExplorerIsland, ExplorerIsland][] = [
		...FRIENDLY.flatMap(([a, b]) => (byId.get(a) && byId.get(b) ? [[byId.get(a)!, byId.get(b)!] as [ExplorerIsland, ExplorerIsland]] : [])),
		...pairs.slice(0, 6).map(([a, b]) => [a, b] as [ExplorerIsland, ExplorerIsland]),
	]
	let bridge: ExplorerTrackData["bridge"] = null
	for (const [a, b] of tries) {
		const combo = await getCombination(ctx, query, [
			{ grouping: "mood", id: a.id },
			{ grouping: "mood", id: b.id },
		]).catch(() => null)
		if (combo && combo.titles.length >= 4) {
			bridge = { a: a.id, b: b.id, count: combo.count, titles: combo.titles.slice(0, 8).map(slim) }
			break
		}
	}

	// A well-known title that sits on the most islands.
	const where = new Map<string, { t: ExplorerTitle; on: string[] }>()
	for (const i of map.islands)
		for (const t of i.titles) {
			const k = String(t.key)
			const row = where.get(k) ?? { t, on: [] }
			row.on.push(i.id)
			where.set(k, row)
		}
	const warm = new Set(["funny", "cozy", "magical", "thrilling", "romantic", "quirky"])
	const rows = [...where.values()].filter((r) => r.on.length >= 2 && r.t.backdrop)
	const best = (rows.some((r) => r.on.some((id) => warm.has(id))) ? rows.filter((r) => r.on.some((id) => warm.has(id))) : rows).sort(
		(p, q) => q.on.length - p.on.length || (q.t.score ?? 0) - (p.t.score ?? 0),
	)[0]
	return { islands, bridge, placed: best ? { title: slim(best.t), on: best.on } : null }
}
