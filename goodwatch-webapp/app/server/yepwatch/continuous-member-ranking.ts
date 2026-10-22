/** Equal-weight rank blend of already eligible personal lists; private inputs never leave the server. */
export function blendPrivateRanks(
	base: readonly number[],
	lists: readonly (readonly number[])[],
): number[] {
	if (!lists.length) return [...base]
	const ranks = lists.map(
		(list) =>
			new Map(
				list.map((key, index) => [key, index / Math.max(1, list.length - 1)]),
			),
	)
	const original = new Map(base.map((key, index) => [key, index]))
	return base
		.filter((key) => ranks.every((rank) => rank.has(key)))
		.sort(
			(a, b) =>
				ranks.reduce((sum, r) => sum + r.get(a)! - r.get(b)!, 0) ||
				original.get(a)! - original.get(b)!,
		)
}
