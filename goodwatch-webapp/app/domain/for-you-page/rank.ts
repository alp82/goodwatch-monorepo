import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import {
	type DecodedPool,
	FP_KEYS,
	type FamilyId,
	type FingerprintKey,
	type ForYouTaste,
} from "./contract"

const N = FP_KEYS.length
export const STEER_CAP = 5
export const ADVENTURE = 0.25
export const QUALITY = 0.3
export interface Steer {
	attrs: Partial<Record<FingerprintKey, number>>
	recipeLean: MoodKey[]
}
export interface Reason {
	key: string
	family: FamilyId
	weight: number
	steered: boolean
}
export interface Ranked {
	index: number
	score: number
	steerFit: number
	reasons: Reason[]
}
export interface PoolStats {
	mean: Float64Array
	sd: Float64Array
	z: Float32Array
}

export function poolStats(fp: Uint8Array, n: number): PoolStats {
	if (fp.length !== n * N) throw new RangeError("Invalid title analysis length")
	const mean = new Float64Array(N)
	const sd = new Float64Array(N)
	const count = new Float64Array(N)
	for (let i = 0; i < n; i++)
		for (let k = 0; k < N; k++)
			if (fp[i * N + k] !== 255) {
				mean[k] += fp[i * N + k]
				count[k]++
			}
	for (let k = 0; k < N; k++) mean[k] = count[k] ? mean[k] / count[k] : 0
	for (let i = 0; i < n; i++)
		for (let k = 0; k < N; k++)
			if (fp[i * N + k] !== 255) sd[k] += (fp[i * N + k] - mean[k]) ** 2
	for (let k = 0; k < N; k++)
		sd[k] = Math.sqrt(count[k] ? sd[k] / count[k] : 1) || 1
	const z = new Float32Array(fp.length)
	for (let i = 0; i < n; i++)
		for (let k = 0; k < N; k++)
			z[i * N + k] =
				fp[i * N + k] === 255 ? 0 : (fp[i * N + k] - mean[k]) / sd[k]
	return { mean, sd, z }
}

export function steerVector(steer: Steer, taste: ForYouTaste) {
	const v = new Float64Array(N)
	const byKey = new Map(taste.attributes.map((a) => [a.key, a]))
	const maxEdge = Math.max(
		...taste.attributes.map((a) => Math.abs(a.edge)),
		0.01,
	)
	let any = false
	for (const [key, weight] of Object.entries(steer.attrs)) {
		const k = FP_KEYS.indexOf(key as FingerprintKey)
		if (!weight || k < 0) continue
		any = true
		v[k] += 1.6 * weight
	}
	return { v, any, byKey, maxEdge }
}

export function rankPool(
	pool: DecodedPool,
	stats: PoolStats,
	taste: ForYouTaste,
	steer: Steer,
	opts: {
		cap?: number
		reasonsTop?: number
		hidden?: ReadonlySet<string>
	} = {},
): Ranked[] {
	const { cap = STEER_CAP, reasonsTop = 160, hidden } = opts
	const { v, any, byKey, maxEdge } = steerVector(steer, taste)
	const w = new Float64Array(N)
	for (let k = 0; k < N; k++)
		w[k] = (byKey.get(FP_KEYS[k])?.edge ?? 0) / maxEdge
	const wNorm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1
	const vNorm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
	const tasteW = 1.1 * (1 - 0.85 * ADVENTURE)
	const steerW = any ? 1.5 * Math.min(cap, vNorm / 1.6) : 0
	const leanMask = steer.recipeLean.reduce(
		(mask, key) => mask | (1 << MOOD_KEYS.indexOf(key)),
		0,
	)
	const out: Ranked[] = []
	for (let i = 0; i < pool.keys.length; i++) {
		if (hidden?.has(pool.keys[i])) continue
		const gw = pool.scores[i]
		if (!(gw >= 55 + 25 * QUALITY)) continue
		let t = 0
		let s = 0
		let novelty = 0
		for (let k = 0; k < N; k++) {
			const zk = stats.z[i * N + k]
			t += w[k] * zk
			s += v[k] * zk
			if (zk > 1 && Math.abs(w[k]) < 0.25) novelty += zk - 1
		}
		t /= wNorm
		s /= vNorm
		const site = pool.steps[i] ? (pool.steps[i] - 75) / 12 : 0
		const lean = (pool.moods[i] & leanMask) !== 0 ? 1 : 0
		const score =
			tasteW * (0.55 * t + 0.45 * site) +
			steerW * s +
			0.9 * lean +
			ADVENTURE * 0.35 * novelty +
			0.35 * ((gw - 70) / 12)
		out.push({ index: i, score, steerFit: any ? s : 0, reasons: [] })
	}
	out.sort((a, b) => b.score - a.score)
	const sMax = Math.max(...out.map((r) => r.steerFit), 0.01)
	out.forEach((r, i) => {
		r.steerFit = any ? Math.max(0, Math.round((r.steerFit / sMax) * 100)) : 100
		if (i < reasonsTop) r.reasons = reasonsFor(r.index, stats, w, v, byKey)
	})
	return out
}

function reasonsFor(
	i: number,
	stats: PoolStats,
	w: Float64Array,
	v: Float64Array,
	byKey: Map<string, ForYouTaste["attributes"][number]>,
): Reason[] {
	const parts: Reason[] = []
	for (let k = 0; k < N; k++) {
		const zk = stats.z[i * N + k]
		if (zk < 0.6) continue
		const fromSteer = v[k] * zk
		const fromTaste = Math.max(0, w[k]) * zk * 0.6
		const weight = fromSteer + fromTaste
		if (weight <= 0.15) continue
		const a = byKey.get(FP_KEYS[k])
		if (!a) continue
		parts.push({
			key: a.key,
			family: a.family,
			weight,
			steered: fromSteer > fromTaste,
		})
	}
	return parts.sort((a, b) => b.weight - a.weight).slice(0, 4)
}
