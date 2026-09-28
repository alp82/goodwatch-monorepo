// The reference pool taste match is calibrated against: every title in the snapshot with at least 1,000 votes and a
// poster (58,628 titles when #174 measured it), as the titles people browse. Derived once per snapshot version.
//
// It keeps its own compact copy of the pool's fingerprints (missing scores as 0, about 4.3 MB) with their inverse
// norms, because a quantile table scores the whole pool and a tight loop over one array is several times faster than
// asking the snapshot title by title. It also holds the pool's per-key mean and standard deviation of the unit-length
// fingerprints, the space the taste vector lives in, so reasons and leanings can say where a person or a title stands.
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"
import { TASTE_LENGTH } from "./formula.server"

const MIN_VOTES = 1000
const MISSING_SCORE = 255
const K = TASTE_LENGTH

export interface TastePool {
	readonly version: string
	readonly count: number
	readonly mean: Float64Array
	readonly sd: Float64Array
	/** count x 74 raw scores, missing as 0. */
	readonly fingerprints: Uint8Array
	readonly inverseNorms: Float32Array
}

let current: TastePool | null = null

export function tastePool(snapshot: TitleSnapshot): TastePool {
	if (current?.version === snapshot.version) return current
	const startedAt = performance.now()
	const rows: number[] = []
	snapshot.forEach((_key, row) => {
		const facts = snapshot.factsAt(row)
		if (facts.votes >= MIN_VOTES && facts.hasPoster) rows.push(row)
	})
	const fingerprints = new Uint8Array(rows.length * K)
	const inverseNorms = new Float32Array(rows.length)
	const sum = new Float64Array(K)
	const squares = new Float64Array(K)
	let count = 0
	for (const row of rows) {
		const fp = snapshot.fingerprintAt(row)
		const at = count * K
		let norm = 0
		for (let k = 0; k < K; k++) {
			const v = fp[k] === MISSING_SCORE ? 0 : fp[k]
			fingerprints[at + k] = v
			norm += v * v
		}
		if (norm === 0) continue
		const inverse = 1 / Math.sqrt(norm)
		inverseNorms[count] = inverse
		for (let k = 0; k < K; k++) {
			const v = fingerprints[at + k] * inverse
			sum[k] += v
			squares[k] += v * v
		}
		count++
	}
	const n = count || 1
	const mean = sum.map((s) => s / n)
	const sd = squares.map(
		(s, k) => Math.sqrt(Math.max(0, s / n - mean[k] ** 2)) || 1,
	)
	current = {
		version: snapshot.version,
		count,
		mean,
		sd,
		fingerprints: fingerprints.slice(0, count * K),
		inverseNorms: inverseNorms.slice(0, count),
	}
	console.info(
		`Taste reference pool for ${snapshot.version}: ${count} titles in ${Math.round(performance.now() - startedAt)} ms`,
	)
	return current
}

/** The cosine of every pool title with a unit-length taste vector. */
export function poolCosines(
	pool: TastePool,
	vector: Float32Array,
): Float32Array {
	const { count, fingerprints, inverseNorms } = pool
	const taste = Float64Array.from(vector)
	const cosines = new Float32Array(count)
	for (let i = 0; i < count; i++) {
		const at = i * K
		let dot = 0
		for (let k = 0; k < K; k++) dot += fingerprints[at + k] * taste[k]
		cosines[i] = dot * inverseNorms[i]
	}
	return cosines
}
