// Where a grouping's islands sit: similar islands close together, on a plane from -1 to 1. Pure math over the islands'
// mean attribute vectors, with no imports, so it can be tested on its own.

export function normalize(v: Float64Array): Float64Array {
	let squares = 0
	for (let d = 0; d < v.length; d++) squares += v[d] * v[d]
	const length = Math.sqrt(squares) || 1
	for (let d = 0; d < v.length; d++) v[d] /= length
	return v
}

/** An island further from the middle than this many times the median island sits at that distance. */
const REACH = 1.5

const median = (values: number[]) => {
	const sorted = [...values].sort((a, b) => a - b)
	const half = sorted.length >> 1
	return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2
}

/**
 * Pulls islands unlike all the others (Japan among the countries) in to REACH times the median distance from the
 * middle, keeping their direction. Without it one such island takes a whole side of the map and squeezes the rest
 * into a point. The middle is the median on each axis, which an island far out doesn't move.
 */
function pullIn(points: [number, number][]): [number, number][] {
	const mx = median(points.map((p) => p[0]))
	const my = median(points.map((p) => p[1]))
	const centered = points.map(([a, b]) => [a - mx, b - my] as [number, number])
	const far = centered.map(([a, b]) => Math.hypot(a, b))
	const reach = median(far) * REACH
	if (reach <= 0) return centered
	return centered.map(([a, b], j) => {
		const k = far[j] > reach ? reach / far[j] : 1
		return [a * k, b * k]
	})
}

/** The top two principal components of the island means, scaled to -1..1, so similar islands sit close together. */
export function pca2(rows: Float64Array[]): [number, number][] {
	const m = rows.length
	if (m === 0) return []
	if (m < 3) return rows.map((_, j) => [m === 1 ? 0 : j ? 0.6 : -0.6, 0])
	const D = rows[0].length
	const mu = new Float64Array(D)
	for (const r of rows) for (let d = 0; d < D; d++) mu[d] += r[d] / m
	const X = rows.map((r) => r.map((v, d) => v - mu[d]))
	const components: Float64Array[] = []
	for (let c = 0; c < 2; c++) {
		// Power iteration from a fixed start, so the same islands always land in the same places.
		let v: Float64Array = new Float64Array(D).map(
			(_, d) => Math.sin(d * 1.7 + c * 3.1) + 0.01,
		)
		for (let step = 0; step < 60; step++) {
			const next = new Float64Array(D)
			for (const x of X) {
				let s = 0
				for (let d = 0; d < D; d++) s += x[d] * v[d]
				for (let d = 0; d < D; d++) next[d] += s * x[d]
			}
			for (const p of components) {
				let s = 0
				for (let d = 0; d < D; d++) s += next[d] * p[d]
				for (let d = 0; d < D; d++) next[d] -= s * p[d]
			}
			v = normalize(next)
		}
		components.push(v)
	}
	const points = pullIn(
		X.map((x) =>
			components.map((p) => {
				let s = 0
				for (let d = 0; d < D; d++) s += x[d] * p[d]
				return s
			}),
		) as [number, number][],
	)
	const scale = Math.max(
		1e-6,
		...points.map(([a, b]) => Math.max(Math.abs(a), Math.abs(b))),
	)
	return points.map(([a, b]) => [a / scale, b / scale])
}
