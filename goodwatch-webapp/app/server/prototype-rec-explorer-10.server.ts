// PROTOTYPE - throwaway. Round 10 of the Explorer: one world with every grouping's islands, and combinations of up to
// three islands from any groupings. Reads the real Explorer's pool, layouts, and seat; writes nothing.
//
// What a combination holds:
// - Two islands of one grouping: today's bridge, unchanged (titles on both, or the titles between the two).
// - Otherwise, islands of different groupings must all hold the title. Islands of one grouping where a title sits on
//   one island only (Decade, Country, Your taste) count as either: 1980s + 1990s + Dark is Dark from both decades.
import {
	type BridgeKind,
	DEFAULT_BRANCHING,
	type ExplorerMap,
	type ExplorerTree,
	type Grouping,
	isGrouping,
} from "~/domain/explorer"
import {
	type ExplorerQuery,
	getExplorerMap,
	prototypeParts,
} from "~/server/explorer/index.server"
import {
	bridgeMembers,
	buildTree,
	visibleMembers,
} from "~/server/explorer/trees.server"
import type { ViewerContext } from "~/server/viewer.server"

const { seatFor, layoutFor, treeOf, offered } = prototypeParts
type Seat = Awaited<ReturnType<typeof seatFor>>

export const MAX_PICKS = 5

export interface Ref10 {
	grouping: Grouping
	id: string
}

/** "mood:dark,decade:1980s" */
export function refsOf(value: string | null): Ref10[] {
	const out: Ref10[] = []
	for (const part of (value ?? "").split(",")) {
		const at = part.indexOf(":")
		const grouping = part.slice(0, at)
		const id = part.slice(at + 1)
		if (at > 0 && id && isGrouping(grouping)) out.push({ grouping, id })
	}
	return out.slice(0, MAX_PICKS + 1)
}

export interface World10 {
	maps: ExplorerMap[]
}

/** Every grouping the viewer can choose, each with its islands as the real map returns them. */
export async function getWorld10(
	ctx: ViewerContext,
	query: ExplorerQuery,
): Promise<World10> {
	const seat = await seatFor(ctx, query, false)
	const maps = await Promise.all(
		offered(seat).map((grouping) => getExplorerMap(ctx, { ...query, grouping })),
	)
	return { maps }
}

export type MixKind = BridgeKind | "all"

function mixer(seat: Seat) {
	const lists = new Map<string, number[] | null>()
	const listOf = (ref: Ref10) => {
		const key = `${ref.grouping}:${ref.id}`
		let list = lists.get(key)
		if (list === undefined) {
			const layout = layoutFor(seat, ref.grouping)
			const j = layout.islands.findIndex((island) => island.id === ref.id)
			list = j < 0 ? null : visibleMembers(layout, j, seat.visible)
			lists.set(key, list)
		}
		return list
	}
	/** The titles a combination holds, in the order its first posters are picked; null when an island isn't there. */
	return (refs: Ref10[]): { kind: MixKind; members: number[] } | null => {
		if (refs.some((ref) => !listOf(ref))) return null
		if (refs.length === 2 && refs[0].grouping === refs[1].grouping) {
			const layout = layoutFor(seat, refs[0].grouping)
			const a = layout.islands.findIndex((i) => i.id === refs[0].id)
			const b = layout.islands.findIndex((i) => i.id === refs[1].id)
			if (a === b) return null
			return bridgeMembers(
				seat.pool,
				layout,
				Math.min(a, b),
				Math.max(a, b),
				seat.visible,
			)
		}
		// One set per condition: an island, or the islands of a one-island-per-title grouping together.
		const sets: Map<number, number>[] = []
		const either = new Map<Grouping, Map<number, number>>()
		for (const ref of refs) {
			const list = listOf(ref) as number[]
			const multi = layoutFor(seat, ref.grouping).multi
			let set = multi ? undefined : either.get(ref.grouping)
			if (!set) {
				set = new Map()
				sets.push(set)
				if (!multi) either.set(ref.grouping, set)
			}
			// Where a title stands on its island, 0 (first) to 1.
			for (let at = 0; at < list.length; at++)
				set.set(list[at], at / Math.max(1, list.length))
		}
		sets.sort((a, b) => a.size - b.size)
		const place = new Map<number, number>()
		for (const [i, at] of sets[0]) {
			let sum = at
			let all = true
			for (let k = 1; k < sets.length && all; k++) {
				const other = sets[k].get(i)
				if (other === undefined) all = false
				else sum += other
			}
			if (all) place.set(i, sum)
		}
		const members = [...place.keys()].sort(
			(x, y) => (place.get(x) ?? 0) - (place.get(y) ?? 0) || x - y,
		)
		return { kind: refs.length > 2 ? "all" : "both", members }
	}
}

export interface Mix10 extends ExplorerTree {
	of: string[]
	kind: MixKind
}

/** A combination of two or three islands, laid out as a tree. */
export async function getMix10(
	ctx: ViewerContext,
	query: ExplorerQuery,
	refs: Ref10[],
): Promise<Mix10 | null> {
	if (refs.length < 2 || refs.length > MAX_PICKS) return null
	const seat = await seatFor(ctx, query, false)
	const mix = mixer(seat)(refs)
	if (!mix) return null
	const shape = buildTree(seat.pool, mix.members, DEFAULT_BRANCHING)
	return {
		of: refs.map((ref) => `${ref.grouping}:${ref.id}`),
		kind: mix.kind,
		...treeOf(seat, shape, mix.members.length),
	}
}

export interface Shares10 {
	of: string[]
	/** Per island of the world not picked: what the combination would hold with it added. */
	shares: { id: string; count: number; kind: MixKind }[]
}

/** For every other island of the world: how many titles the picked islands would hold with it added. */
export async function getShares10(
	ctx: ViewerContext,
	query: ExplorerQuery,
	refs: Ref10[],
): Promise<Shares10 | null> {
	if (!refs.length || refs.length >= MAX_PICKS) return null
	const seat = await seatFor(ctx, query, false)
	const mix = mixer(seat)
	const picked = new Set(refs.map((ref) => `${ref.grouping}:${ref.id}`))
	const shares: Shares10["shares"] = []
	for (const grouping of offered(seat))
		for (const island of layoutFor(seat, grouping).islands) {
			const id = `${grouping}:${island.id}`
			if (picked.has(id)) continue
			const with_ = mix([...refs, { grouping, id: island.id }])
			if (with_)
				shares.push({ id, count: with_.members.length, kind: with_.kind })
		}
	return { of: [...picked], shares }
}
