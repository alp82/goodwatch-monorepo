// The Explorer's one map and its combinations. Every grouping's islands sit on the same map (the world), and up to
// five islands from any groupings combine.
//
// What a combination holds:
// - Two islands of one grouping: the bridge (titles on both, or the titles between the two).
// - Otherwise, islands of different groupings must all hold the title. Islands of one grouping where a title sits on
//   one island only (Decade, Country, Your taste) count as either: 1980s + 1990s + Dark is Dark from both decades.
import {
	type CombinationKind,
	DEFAULT_BRANCHING,
	type ExplorerCombination,
	type ExplorerParts,
	type ExplorerShares,
	type ExplorerWorld,
	type Grouping,
	MAX_PICKS,
	isGrouping,
} from "~/domain/explorer"
import type { ViewerContext } from "~/server/viewer.server"
import { type MemberSet, combine } from "./combine.server"
import {
	type ExplorerQuery,
	getExplorerMap,
	layoutFor,
	offered,
	seatFor,
	treeOf,
} from "./index.server"
import { bridgeMembers, buildTree, visibleMembers } from "./trees.server"

type Seat = Awaited<ReturnType<typeof seatFor>>

/** An island of the world: its grouping and its id there. */
export interface IslandRef {
	grouping: Grouping
	id: string
}

/** "mood:dark,decade:1980s" */
export function refsOf(value: string | null): IslandRef[] {
	const out: IslandRef[] = []
	for (const part of (value ?? "").split(",")) {
		const at = part.indexOf(":")
		const grouping = part.slice(0, at)
		const id = part.slice(at + 1)
		if (at > 0 && id && isGrouping(grouping)) out.push({ grouping, id })
	}
	return out.slice(0, MAX_PICKS + 1)
}

/** Every grouping the viewer can choose, each with its islands. */
export async function getExplorerWorld(
	ctx: ViewerContext,
	query: ExplorerQuery,
): Promise<ExplorerWorld> {
	const seat = await seatFor(ctx, query, false)
	const maps = await Promise.all(
		offered(seat).map((grouping) =>
			getExplorerMap(ctx, { ...query, grouping }),
		),
	)
	return { maps }
}

function mixer(seat: Seat) {
	const lists = new Map<string, number[] | null>()
	const listOf = (ref: IslandRef) => {
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
	return (
		refs: IslandRef[],
	): { kind: CombinationKind; members: number[] } | null => {
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
		const sets: MemberSet[] = []
		const either = new Map<Grouping, MemberSet>()
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
		const members = combine(sets)
		return { kind: refs.length > 2 ? "all" : "both", members }
	}
}

/** A combination of two to five islands, laid out as a tree. */
export async function getCombination(
	ctx: ViewerContext,
	query: ExplorerQuery,
	refs: IslandRef[],
): Promise<ExplorerCombination | null> {
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

/** For every other island of the world: how many titles the picked islands would hold with it added. */
export async function getShares(
	ctx: ViewerContext,
	query: ExplorerQuery,
	refs: IslandRef[],
): Promise<ExplorerShares | null> {
	if (!refs.length || refs.length >= MAX_PICKS) return null
	const seat = await seatFor(ctx, query, false)
	const mix = mixer(seat)
	const picked = new Set(refs.map((ref) => `${ref.grouping}:${ref.id}`))
	const shares: ExplorerShares["shares"] = []
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

/** What each picked island does to the combination: the count the others would hold without it. */
export async function getParts(
	ctx: ViewerContext,
	query: ExplorerQuery,
	refs: IslandRef[],
): Promise<ExplorerParts | null> {
	if (refs.length < 2 || refs.length > MAX_PICKS) return null
	const seat = await seatFor(ctx, query, false)
	const mix = mixer(seat)
	const without = refs.map(
		(_, k) => mix(refs.filter((_, j) => j !== k))?.members.length ?? 0,
	)
	return { of: refs.map((ref) => `${ref.grouping}:${ref.id}`), without }
}
