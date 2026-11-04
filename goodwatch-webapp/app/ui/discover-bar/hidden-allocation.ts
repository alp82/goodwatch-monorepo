// How the Matches meter shares the titles the results hide (`hidden`) among the filters that hide them. Each filter
// group gets what it alone hides (its recovery), plus a share of the titles two or more filters hide, weighted by
// (recovery + 1). A group the search applies itself has no count of its own here (weight 0). The whole of `hidden`
// is shared out in integers (largest remainders), so the rows add up to the header.
//
// A group can have several members: the person's own filter row and filters read from the words that the results
// apply themselves (runtime, scores). The group's titles are split among its members, so two members never both
// claim the group's whole count. Read counts the results can't see (the search's estimates, its scope) aren't part of
// `hidden`; the meter adds them once, beside this.
//
// Pure, so the rules are tested without React (hidden-allocation.test.ts).

export interface AllocationGroup {
	group: string
	/** What this group alone hides; 0 when unknown. */
	sole: number
	/** The search applies it itself: no share. */
	inSearch?: boolean
	/** The rows that show this group, in their stable order. */
	members: readonly string[]
}

/** Splits `total` into integers in proportion to `weights` (largest remainders, ties in order). */
export function apportion(total: number, weights: readonly number[]): number[] {
	const sum = weights.reduce((s, w) => s + w, 0)
	if (total <= 0 || sum <= 0) return weights.map(() => 0)
	const exact = weights.map((w) => (total * w) / sum)
	const out = exact.map(Math.floor)
	let left = total - out.reduce((s, n) => s + n, 0)
	const order = exact
		.map((value, i) => ({ i, rest: value - Math.floor(value) }))
		.sort((a, b) => b.rest - a.rest || a.i - b.i)
	for (const { i } of order) {
		if (left <= 0) break
		out[i]++
		left--
	}
	return out
}

/** Each member's share of `hidden`, by member key. The shares add up to `hidden` whenever a group can take one. */
export function allocateHidden(hidden: number, groups: readonly AllocationGroup[]): Map<string, number> {
	const out = new Map<string, number>()
	const total = Math.max(0, Math.floor(hidden))
	const sole = groups.map((g) => (g.inSearch ? 0 : Math.max(0, Math.floor(g.sole))))
	// What each group alone hides comes first; never more than the whole.
	const soleShare = apportion(Math.min(total, sole.reduce((s, n) => s + n, 0)), sole)
	const shared = total - soleShare.reduce((s, n) => s + n, 0)
	const extra = apportion(
		shared,
		groups.map((g, i) => (g.inSearch ? 0 : sole[i] + 1)),
	)
	groups.forEach((g, i) => {
		const split = apportion(
			soleShare[i] + extra[i],
			g.members.map(() => 1),
		)
		g.members.forEach((member, m) => out.set(member, (out.get(member) ?? 0) + split[m]))
	})
	return out
}
