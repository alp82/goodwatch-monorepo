// Catalog statistics: per fingerprint attribute, how the reference pool of popular titles scores it. Taste, Explorer,
// and the explanation chips compare a person's titles with these. Nothing about other members goes into them.
import {
	type Columns,
	FINGERPRINT_LENGTH,
	FLAG_BACKDROP,
	FLAG_POSTER,
	MISSING_SCORE,
	SHOW_BASE,
} from "./format.server"

export interface CatalogStats {
	/** Titles in the reference pool. */
	readonly pool: number
	// One value per fingerprint key, in VALID_FINGERPRINT_KEYS order. A missing score counts as 0.
	readonly mean: readonly number[]
	/** Standard deviation over the pool; 1 where every pool title scores the key the same. */
	readonly sd: readonly number[]
	/** "Everyone": the vote-weighted mean z-score of the pool. */
	readonly everyone: readonly number[]
	/** The score that puts a title in the pool's top quarter for the key (75th percentile), at least 3. */
	readonly threshold: readonly number[]
	/** The vote-weighted share of pool titles scoring at or above the threshold. */
	readonly share: readonly number[]
}

// The reference pool: the most voted titles with a poster and a backdrop, movies with at least 3,000 votes and shows
// with at least 1,000, as the Taste and fingerprint prototypes built it.
const POOL_MOVIES = { minVotes: 3000, size: 2200 }
const POOL_SHOWS = { minVotes: 1000, size: 800 }
const MIN_THRESHOLD = 3

/** The reference pool's rows: the most voted qualifying movies, then shows, ties by row order. */
export function referencePool(c: Columns): number[] {
	const movies: number[] = []
	const shows: number[] = []
	const images = FLAG_POSTER | FLAG_BACKDROP
	for (let row = 0; row < c.count; row++) {
		if ((c.flags[row] & images) !== images) continue
		const isShow = c.pointIds[row] >= SHOW_BASE
		const rule = isShow ? POOL_SHOWS : POOL_MOVIES
		if (c.votes[row] >= rule.minVotes) (isShow ? shows : movies).push(row)
	}
	const top = (rows: number[], size: number) =>
		rows.sort((a, b) => c.votes[b] - c.votes[a] || a - b).slice(0, size)
	return [...top(movies, POOL_MOVIES.size), ...top(shows, POOL_SHOWS.size)]
}

export function catalogStats(c: Columns): CatalogStats {
	const rows = referencePool(c)
	const n = rows.length
	const K = FINGERPRINT_LENGTH
	const fp = c.fingerprints
	const value = (row: number, k: number) => {
		const v = fp[row * K + k]
		return v === MISSING_SCORE ? 0 : v
	}
	const mean = new Array<number>(K).fill(0)
	const sd = new Array<number>(K).fill(0)
	const everyone = new Array<number>(K).fill(0)
	const threshold = new Array<number>(K).fill(MIN_THRESHOLD)
	const share = new Array<number>(K).fill(0)
	if (n === 0)
		return { pool: 0, mean, sd: sd.fill(1), everyone, threshold, share }

	// Each title weighs the square root of its votes, so the most voted titles don't drown the rest.
	const weights = rows.map((row) => Math.sqrt(c.votes[row]))
	const weightSum = weights.reduce((a, b) => a + b, 0) || 1
	const histogram = new Array<number>(11)
	for (let k = 0; k < K; k++) {
		let sum = 0
		for (const row of rows) sum += value(row, k)
		mean[k] = sum / n
		let squares = 0
		for (const row of rows) squares += (value(row, k) - mean[k]) ** 2
		sd[k] = Math.sqrt(squares / n) || 1

		let z = 0
		histogram.fill(0)
		rows.forEach((row, i) => {
			const v = value(row, k)
			z += (weights[i] * (v - mean[k])) / sd[k]
			histogram[v]++
		})
		everyone[k] = z / weightSum

		// The value at position floor(0.75 n) of the pool's sorted scores.
		const position = Math.floor(n * 0.75)
		let seen = 0
		let p75 = 10
		for (let v = 0; v <= 10; v++) {
			seen += histogram[v]
			if (seen > position) {
				p75 = v
				break
			}
		}
		threshold[k] = Math.max(MIN_THRESHOLD, p75)

		let above = 0
		rows.forEach((row, i) => {
			if (value(row, k) >= threshold[k]) above += weights[i]
		})
		share[k] = above / weightSum
	}
	return { pool: n, mean, sd, everyone, threshold, share }
}
