// The Explorer's one map: every grouping's islands are laid out as a map of their own (layWorld), each grouping in a
// region; the regions sit on an ellipse around the middle, which is kept free for the combination and the islands it
// joins.
import type { ExplorerMap, Grouping } from "~/domain/explorer"
import { GROUPING_NAMES } from "~/domain/explorer"
import { type World, type WorldIsland, layWorld } from "./world"

export interface Region {
	id: Grouping
	name: string
	/** "#rrggbb", for the region's land and label. */
	color: string
	cx: number
	cy: number
	r: number
	seed: number
	/** Ids of its islands in the world ("mood:dark"). */
	islands: string[]
	titles: number
}

export interface RegionWorld extends World {
	regions: Region[]
	/** The middle: where a combination rises (radius rMix), with room around it for the islands it joins (radius r). */
	hub: { x: number; y: number; r: number; rMix: number }
}

export const REGION_COLORS: Record<Grouping, string> = {
	mood: "#e0607e",
	theme: "#5b7fa8",
	style: "#b46ad6",
	occasion: "#e9a23b",
	decade: "#37b3a4",
	country: "#8ccf4d",
	taste: "#f5a524",
}

/** An island's id in the world: its grouping and its id there. */
export const worldId = (grouping: Grouping, id: string) => `${grouping}:${id}`
export const groupingOf = (id: string) =>
	id.slice(0, id.indexOf(":")) as Grouping
export const localId = (id: string) => id.slice(id.indexOf(":") + 1)

const R_MIX = 300
const R_HUB = 690
const GAP = 90

export function layRegions(maps: ExplorerMap[], aspect: number): RegionWorld {
	const mass = maps.map((map) =>
		map.islands.reduce((sum, island) => sum + island.count ** 0.85, 0),
	)
	const most = Math.max(...mass, 1)
	// Each region: today's layout in a square, scaled a little by how much it holds, and the circle around it.
	const local = maps.map((map, m) => {
		const laid = layWorld(map.islands, 1)
		const k = Math.max(0.74, Math.min(1, Math.sqrt(mass[m] / most)))
		const r =
			Math.max(
				200,
				...laid.islands.map(
					(i) => Math.hypot(i.cx - 500, i.cy - 500) + i.r * 1.1,
				),
			) * k
		return { laid, k, r }
	})
	const n = maps.length
	const wide = aspect >= 1 ? Math.min(aspect, 2.2) : 1
	const tall = aspect >= 1 ? 1 : Math.min(1 / aspect, 2.2)
	// The smallest ellipse on which no region touches its neighbors or the middle.
	let best: { x: number; y: number }[] = []
	search: for (let size = 500; size < 6000; size += 20)
		for (const turn of [0, 0.5, 0.25, 0.75]) {
			const at = local.map((_, m) => {
				const a = -Math.PI / 2 + ((m + turn) / n) * Math.PI * 2
				return { x: Math.cos(a) * size * wide, y: Math.sin(a) * size * tall }
			})
			let clear = true
			for (let a = 0; a < n && clear; a++) {
				if (Math.hypot(at[a].x, at[a].y) < local[a].r + R_HUB + GAP)
					clear = false
				for (let b = a + 1; b < n && clear; b++)
					if (
						Math.hypot(at[a].x - at[b].x, at[a].y - at[b].y) <
						local[a].r + local[b].r + GAP
					)
						clear = false
			}
			if (clear) {
				best = at
				break search
			}
		}
	const m = 50
	const x0 = Math.min(-R_HUB, ...best.map((p, a) => p.x - local[a].r)) - m
	// Room above the topmost region for its name.
	const y0 = Math.min(-R_HUB, ...best.map((p, a) => p.y - local[a].r)) - m - 150
	const x1 = Math.max(R_HUB, ...best.map((p, a) => p.x + local[a].r)) + m
	const y1 = Math.max(R_HUB, ...best.map((p, a) => p.y + local[a].r)) + m
	const islands: WorldIsland[] = []
	const regions: Region[] = maps.map((map, a) => {
		const { laid, k, r } = local[a]
		const cx = best[a].x - x0
		const cy = best[a].y - y0
		const ids: string[] = []
		for (const island of laid.islands) {
			const id = worldId(map.grouping, island.id)
			ids.push(id)
			islands.push({
				id,
				cx: cx + (island.cx - 500) * k,
				cy: cy + (island.cy - 500) * k,
				r: island.r * k,
				seed: island.seed,
			})
		}
		return {
			id: map.grouping,
			name: GROUPING_NAMES[map.grouping],
			color: REGION_COLORS[map.grouping],
			cx,
			cy,
			r,
			seed: a * 1.7 + 0.4,
			islands: ids,
			titles: map.total,
		}
	})
	return {
		w: x1 - x0,
		h: y1 - y0,
		islands,
		regions,
		hub: { x: -x0, y: -y0, r: R_HUB, rMix: R_MIX },
	}
}
