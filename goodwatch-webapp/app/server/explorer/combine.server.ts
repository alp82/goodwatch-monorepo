// What a combination of islands from different groupings holds, and in what order.

/** One condition of a combination: the titles that meet it, each with where it stands there, 0 (first) to 1. */
export type MemberSet = Map<number, number>

/**
 * The titles in every set, ordered by where they stand in the sets together (the title that is near the top of each
 * comes first), then by index so the order is stable.
 */
export function combine(sets: MemberSet[]): number[] {
	if (!sets.length) return []
	const bySize = [...sets].sort((a, b) => a.size - b.size)
	const place = new Map<number, number>()
	for (const [i, at] of bySize[0]) {
		let sum = at
		let all = true
		for (let k = 1; k < bySize.length && all; k++) {
			const other = bySize[k].get(i)
			if (other === undefined) all = false
			else sum += other
		}
		if (all) place.set(i, sum)
	}
	return [...place.keys()].sort(
		(x, y) => (place.get(x) ?? 0) - (place.get(y) ?? 0) || x - y,
	)
}
