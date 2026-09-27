// Trees lay titles out for zooming in: the first posters, then around each title its closest titles, generation by
// generation, never repeating a title (nor a name: a film and its series remake read as the same). Bridges pick the
// titles two islands share, then lay them out the same way.
import { type BridgeKind, firstPosters } from "~/domain/explorer"
import type { Layout } from "./groupings.server"
import { type ExplorerPool, cosineOf, cosineTo } from "./pool.server"

export interface TreeShape {
	/** Pool titles, breadth first. */
	titles: number[]
	parent: number[]
	generation: number[]
}

// Closest titles are looked for among this many of the candidates, best first, which keeps a tree of a large island
// (Drama holds thousands) well inside the endpoint's budget.
const MAX_CANDIDATES = 2000
// Children should be good titles: first among those with a GoodWatch score of at least 55, then among all.
const GOOD_SCORE = 55
const QUALITY_WEIGHT = 0.2
const MIN_BOTH = 6

/** A tree over `members` (pool titles, in the order the first posters are picked). */
export function buildTree(
	pool: ExplorerPool,
	members: readonly number[],
	branching: readonly number[],
): TreeShape {
	const candidates = members.slice(0, MAX_CANDIDATES)
	const first = firstPosters(members.length)
	const taken = new Set<number>()
	const names = new Set<string>()
	const titles: number[] = []
	const parent: number[] = []
	const generation: number[] = []
	const take = (i: number, from: number, g: number) => {
		taken.add(i)
		names.add(pool.display[i].title)
		titles.push(i)
		parent.push(from)
		generation.push(g)
	}
	for (const i of candidates) {
		if (titles.length >= first) break
		if (!names.has(pool.display[i].title)) take(i, -1, 1)
	}
	for (let at = 0; at < titles.length; at++) {
		const wanted = branching[generation[at] - 1]
		if (!wanted) continue
		const from = titles[at]
		// The best `wanted` candidates by closeness plus quality, kept sorted, best first.
		const best: [number, number][] = []
		for (const minScore of [GOOD_SCORE, 0]) {
			for (const i of candidates) {
				if (taken.has(i) || names.has(pool.display[i].title)) continue
				if ((pool.facts[i].score ?? 0) < minScore) continue
				const value = cosineOf(pool, from, i) + QUALITY_WEIGHT * pool.quality[i]
				if (best.length === wanted && value <= best[wanted - 1][1]) continue
				let k = best.length
				while (k > 0 && best[k - 1][1] < value) k--
				best.splice(k, 0, [i, value])
				if (best.length > wanted) best.pop()
			}
			if (best.length >= wanted) break
		}
		for (const [i] of best)
			if (!names.has(pool.display[i].title)) take(i, at, generation[at] + 1)
	}
	return { titles, parent, generation }
}

/** An island's titles that pass the filters, best quality first. */
export function visibleMembers(
	layout: Layout,
	island: number,
	visible: Uint8Array,
): number[] {
	const out: number[] = []
	for (const i of layout.members[island]) if (visible[i]) out.push(i)
	return out
}

// How many titles a "between" bridge takes from each island: 7.5% of both islands' titles, at least 20 and at most
// 200 from each.
const betweenShare = (total: number) =>
	Math.max(20, Math.min(200, Math.round(total * 0.075)))

/**
 * The titles a bridge between islands a and b holds, in the order its first posters are picked. Where titles sit on
 * several islands and at least 6 sit on both, those ("both"), best quality first. Otherwise ("between"), from each
 * island the titles closest to both islands' centers (by their smaller cosine), each side best quality first, taking
 * turns so the bridge leans to neither.
 */
export function bridgeMembers(
	pool: ExplorerPool,
	layout: Layout,
	a: number,
	b: number,
	visible: Uint8Array,
): { kind: BridgeKind; members: number[] } {
	const fromA = visibleMembers(layout, a, visible)
	const fromB = visibleMembers(layout, b, visible)
	if (layout.multi) {
		const bit = 1 << b
		const both = fromA.filter((i) => layout.mask[i] & bit)
		if (both.length >= MIN_BOTH) return { kind: "both", members: both }
	}
	const inB = new Set(fromB)
	const overlap = fromA.filter((i) => inB.has(i)).length
	const share = betweenShare(fromA.length + fromB.length - overlap)
	const closest = (list: number[]) =>
		list
			.map((i) => ({
				i,
				fit: Math.min(
					cosineTo(pool, i, layout.centers[a]),
					cosineTo(pool, i, layout.centers[b]),
				),
			}))
			.sort((x, y) => y.fit - x.fit || x.i - y.i)
			.slice(0, share)
			.map((x) => x.i)
			.sort((x, y) => pool.quality[y] - pool.quality[x] || x - y)
	const sideA = closest(fromA)
	const sideB = closest(fromB)
	const members: number[] = []
	const seen = new Set<number>()
	for (let k = 0; k < Math.max(sideA.length, sideB.length); k++)
		for (const side of [sideA, sideB]) {
			const i = side[k]
			if (i !== undefined && !seen.has(i)) {
				seen.add(i)
				members.push(i)
			}
		}
	return { kind: "between", members }
}

export interface PairCount {
	a: number
	b: number
	kind: BridgeKind
	count: number
	strength: number
}

/**
 * For every pair of islands, what a bridge would hold: for "both", the titles on both and their overlap against the
 * islands' sizes (Ochiai); for "between", the titles the bridge takes and the cosine between the islands' centers.
 */
export function pairCounts(layout: Layout, visible: Uint8Array): PairCount[] {
	const J = layout.islands.length
	const sizes = layout.members.map((list) =>
		list.reduce((sum, i) => sum + (visible[i] ? 1 : 0), 0),
	)
	const both = new Int32Array(J * J)
	if (layout.multi) {
		const bits: number[] = []
		for (let i = 0; i < layout.mask.length; i++) {
			const m = layout.mask[i]
			if (!visible[i] || (m & (m - 1)) === 0) continue
			bits.length = 0
			for (let j = 0; j < J; j++) if (m & (1 << j)) bits.push(j)
			for (let x = 0; x < bits.length; x++)
				for (let y = x + 1; y < bits.length; y++) both[bits[x] * J + bits[y]]++
		}
	}
	const pairs: PairCount[] = []
	for (let a = 0; a < J; a++)
		for (let b = a + 1; b < J; b++) {
			const shared = both[a * J + b]
			if (layout.multi && shared >= MIN_BOTH) {
				pairs.push({
					a,
					b,
					kind: "both",
					count: shared,
					strength: shared / Math.sqrt(Math.max(1, sizes[a] * sizes[b])),
				})
				continue
			}
			const share = betweenShare(sizes[a] + sizes[b] - shared)
			let cosine = 0
			const ca = layout.centers[a]
			const cb = layout.centers[b]
			for (let d = 0; d < ca.length; d++) cosine += ca[d] * cb[d]
			// Titles on both islands (fewer than 6) that both sides pick count once, as in the bridge.
			pairs.push({
				a,
				b,
				kind: "between",
				count:
					Math.min(share, sizes[a]) +
					Math.min(share, sizes[b]) -
					Math.min(shared, share),
				strength: Math.max(0, cosine),
			})
		}
	return pairs
}
