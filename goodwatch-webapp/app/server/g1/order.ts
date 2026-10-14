// Port of stage 1 request_order. B5 membership stays global; F3 franchise picks use this list.
export interface G1Components {
	pointIds: number[]
	b3Rank: number[]
	b5TopHalf: boolean[]
	movieSeriesId: number[]
	show: boolean[]
	animation: boolean[]
}
export type OwnShares = [number, number] | null

export function refill(
	order: number[],
	rank: number[],
	show: boolean[],
	animation: boolean[],
	own: OwnShares,
) {
	if (!own || !order.length) return { order, mixCount: 0 }
	const codes = show.map((s, i) => 2 * Number(s) + Number(animation[i]))
	const queues = [0, 1, 2, 3].map((code) =>
		order.filter((i) => codes[i] === code),
	)
	const heads = [0, 0, 0, 0],
		counts = [0, 0],
		placed: number[] = []
	for (let position = 0; position < Math.min(100, order.length); position++) {
		const eligible: number[] = [],
			available: number[] = []
		for (let code = 0; code < 4; code++) {
			if (heads[code] === queues[code].length) continue
			const i = queues[code][heads[code]]
			available.push(i)
			const kinds = [Number(show[i]), Number(animation[i])]
			if (
				kinds.every((kind, axis) => {
					const target = own[axis] * (position + 1)
					const distance = Math.abs(counts[axis] + kind - target)
					const other = Math.abs(counts[axis] + 1 - kind - target)
					return (
						distance <= 0.1 * (position + 1) + 1e-12 ||
						(position >= 10 && distance < other - 1e-12)
					)
				})
			)
				eligible.push(i)
		}
		const i = (eligible.length ? eligible : available).sort(
			(a, b) => rank[b] - rank[a] || a - b,
		)[0]
		heads[codes[i]]++
		placed.push(i)
		counts[0] += Number(show[i])
		counts[1] += Number(animation[i])
	}
	const used = new Set(placed)
	return {
		order: [...placed, ...order.filter((i) => !used.has(i))],
		mixCount: placed.length,
	}
}

export function requestOrder(c: G1Components, own: OwnShares) {
	const n = c.b3Rank.length
	if (
		[c.pointIds, c.b5TopHalf, c.movieSeriesId, c.show, c.animation].some(
			(a) => a.length !== n,
		)
	)
		throw new Error("Component columns have different lengths")
	const groups = c.b5TopHalf.map((bit) => Number(bit))
	const seen = new Set<number>()
	const indices = Array.from({ length: n }, (_, i) => i)
	for (const i of [...indices].sort((a, b) => c.b3Rank[b] - c.b3Rank[a])) {
		const series = c.movieSeriesId[i] > 0 ? c.movieSeriesId[i] : -1 - i
		if (c.b5TopHalf[i] && !seen.has(series)) {
			groups[i] = 2
			seen.add(series)
		}
	}
	const rank = groups.map((g, i) => 2 * g + c.b3Rank[i])
	const order = indices.sort((a, b) => rank[b] - rank[a])
	return { ...refill(order, rank, c.show, c.animation, own), groups, rank }
}
