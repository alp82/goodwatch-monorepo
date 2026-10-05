// PROTOTYPE - throwaway. Small numeric helpers for /prototype/rec-explorer layouts.
// Pure functions, safe on the server and in the browser. Deterministic (seeded) so SSR and
// hydration agree.

export type Vec = number[]
export type Pt = { x: number; y: number }

export function seeded(seed = 7) {
	let s = seed >>> 0
	return () => {
		s = (s + 0x6d2b79f5) >>> 0
		let t = s
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export const dot = (a: Vec, b: Vec) => {
	let d = 0
	for (let k = 0; k < a.length; k++) d += a[k] * b[k]
	return d
}
export const norm = (a: Vec) => Math.sqrt(dot(a, a))
export const cos = (a: Vec, b: Vec) => {
	const n = norm(a) * norm(b)
	return n ? dot(a, b) / n : 0
}

/** Top principal components by power iteration with deflation. Rows are already centered (z-scores). */
export function pca(rows: Vec[], comps = 2, dims?: number[]): Vec[] {
	const n = rows[0]?.length ?? 0
	const use = dims ?? Array.from({ length: n }, (_, i) => i)
	const cov = Array.from({ length: n }, () => new Array(n).fill(0))
	for (const r of rows)
		for (const i of use) {
			const ri = r[i]
			if (!ri) continue
			for (const j of use) cov[i][j] += ri * r[j]
		}
	const out: Vec[] = []
	const rand = seeded(11)
	for (let c = 0; c < comps; c++) {
		let v = Array.from({ length: n }, (_, i) => (use.includes(i) ? rand() - 0.5 : 0))
		for (let it = 0; it < 80; it++) {
			const nv = new Array(n).fill(0)
			for (const i of use) {
				let s = 0
				for (const j of use) s += cov[i][j] * v[j]
				nv[i] = s
			}
			const l = norm(nv) || 1
			v = nv.map((x) => x / l)
		}
		// Deflate.
		const lambda = use.reduce((a, i) => a + v[i] * use.reduce((b, j) => b + cov[i][j] * v[j], 0), 0)
		for (const i of use) for (const j of use) cov[i][j] -= lambda * v[i] * v[j]
		// Stable sign: largest loading positive.
		let big = 0
		for (let i = 0; i < n; i++) if (Math.abs(v[i]) > Math.abs(v[big])) big = i
		out.push(v[big] < 0 ? v.map((x) => -x) : v)
	}
	return out
}

/** k-means++ with a fixed seed. Returns assignments and centroids. */
export function kmeans(rows: Vec[], k: number, iters = 25) {
	const rand = seeded(5)
	const n = rows.length
	const d2 = (a: Vec, b: Vec) => {
		let s = 0
		for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
		return s
	}
	const cents: Vec[] = [rows[Math.floor(rand() * n)].slice()]
	const best = new Array(n).fill(Number.POSITIVE_INFINITY)
	while (cents.length < k) {
		let total = 0
		for (let i = 0; i < n; i++) {
			best[i] = Math.min(best[i], d2(rows[i], cents[cents.length - 1]))
			total += best[i]
		}
		let r = rand() * total
		let pick = 0
		for (; pick < n - 1; pick++) {
			r -= best[pick]
			if (r <= 0) break
		}
		cents.push(rows[pick].slice())
	}
	const assign = new Array(n).fill(0)
	for (let it = 0; it < iters; it++) {
		for (let i = 0; i < n; i++) {
			let bi = 0
			let bd = Number.POSITIVE_INFINITY
			for (let c = 0; c < k; c++) {
				const d = d2(rows[i], cents[c])
				if (d < bd) {
					bd = d
					bi = c
				}
			}
			assign[i] = bi
		}
		const sums = cents.map((c) => new Array(c.length).fill(0))
		const counts = new Array(k).fill(0)
		for (let i = 0; i < n; i++) {
			counts[assign[i]]++
			const s = sums[assign[i]]
			for (let j = 0; j < s.length; j++) s[j] += rows[i][j]
		}
		for (let c = 0; c < k; c++) if (counts[c]) cents[c] = sums[c].map((x) => x / counts[c])
	}
	return { assign, cents }
}

/** Push points apart until no two are closer than minDist. Grid-hashed, O(n) per pass. */
export function relax(pts: Pt[], minDist: number, passes = 30, pinned?: (i: number) => boolean) {
	const cell = minDist
	for (let p = 0; p < passes; p++) {
		const grid = new Map<string, number[]>()
		pts.forEach((q, i) => {
			const key = `${Math.floor(q.x / cell)},${Math.floor(q.y / cell)}`
			const list = grid.get(key)
			if (list) list.push(i)
			else grid.set(key, [i])
		})
		let moved = 0
		for (let i = 0; i < pts.length; i++) {
			const a = pts[i]
			const gx = Math.floor(a.x / cell)
			const gy = Math.floor(a.y / cell)
			for (let dx = -1; dx <= 1; dx++)
				for (let dy = -1; dy <= 1; dy++) {
					const list = grid.get(`${gx + dx},${gy + dy}`)
					if (!list) continue
					for (const j of list) {
						if (j <= i) continue
						const b = pts[j]
						let ddx = b.x - a.x
						let ddy = b.y - a.y
						let d = Math.sqrt(ddx * ddx + ddy * ddy)
						if (d >= minDist) continue
						if (d < 1e-6) {
							ddx = Math.cos(i * 2.4)
							ddy = Math.sin(i * 2.4)
							d = 1
						}
						const push = (minDist - d) / 2 / d
						const ai = pinned?.(i) ? 0 : 1
						const bj = pinned?.(j) ? 0 : 1
						a.x -= ddx * push * ai
						a.y -= ddy * push * ai
						b.x += ddx * push * bj
						b.y += ddy * push * bj
						moved++
					}
				}
		}
		if (!moved) break
	}
	return pts
}

/** Map values to evenly spaced ranks in [lo, hi]; blends in the raw value so clumps still read. */
export function spread(values: number[], lo: number, hi: number, rawShare = 0.35) {
	const idx = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
	const out = new Array(values.length).fill(0)
	const min = idx[0]?.[0] ?? 0
	const max = idx[idx.length - 1]?.[0] ?? 1
	idx.forEach(([v, i], r) => {
		const rank = lo + (r / Math.max(1, idx.length - 1)) * (hi - lo)
		const raw = lo + ((v - min) / (max - min || 1)) * (hi - lo)
		out[i] = rank * (1 - rawShare) + raw * rawShare
	})
	return out
}

/** Percentile of each value within the list, 0-100. */
export function percentiles(values: Float32Array | number[]) {
	const idx = Array.from(values, (v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
	const out = new Float32Array(values.length)
	idx.forEach(([, i], r) => {
		out[i] = (r / Math.max(1, idx.length - 1)) * 100
	})
	return out
}
