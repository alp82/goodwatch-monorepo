// The loaded title snapshot: every title with a title analysis, its fingerprint and the facts filters and sorts need,
// in webapp memory. Built once per snapshot version from the decoded columns; never changed afterwards.
import { type MoodKey, moodMaskOf, moodsInMask } from "~/domain/moods"
import { type CatalogStats, catalogStats } from "./catalog-stats.server"
import {
	type Columns,
	FINGERPRINT_LENGTH,
	FLAG_ADULT,
	FLAG_ANIME,
	FLAG_BACKDROP,
	FLAG_POSTER,
	MISSING_SCORE,
	MOVIE_BASE,
	type Manifest,
	SHOW_BASE,
	UNKNOWN_DAY,
	UNKNOWN_ORIGIN,
	UNKNOWN_SCORE,
} from "./format.server"

/** A title's point id: movie 1e12 + tmdb_id, show 2e12 + tmdb_id. */
export type TitleKey = number

export interface TitleFacts {
	mediaType: "movie" | "show"
	tmdbId: number
	genres: string[]
	/** Days since 1970-01-01: a film's release date, a show's last air date. */
	releaseDay: number | null
	/** GoodWatch score, 0 to 100. */
	score: number | null
	votes: number
	popularity: number
	/** First production country, else original language. */
	origin: string | null
	hasPoster: boolean
	hasBackdrop: boolean
	adult: boolean
	anime: boolean
	moods: MoodKey[]
}

export interface TitleSnapshot {
	readonly version: string
	readonly builtAt: Date
	readonly count: number
	has(key: TitleKey): boolean
	facts(key: TitleKey): TitleFacts | null
	/** Cosine between the title's fingerprint and a unit-length taste vector in VALID_FINGERPRINT_KEYS order. */
	cosine(key: TitleKey, unitTaste: Float32Array): number | null
	/** Every title, in point id order, with its row (0 to count - 1). */
	forEach(fn: (key: TitleKey, row: number) => void): void
	readonly stats: CatalogStats
	/** The 74 raw scores in VALID_FINGERPRINT_KEYS order, 255 for a missing score. A view, not a copy: don't write. */
	fingerprint(key: TitleKey): Uint8Array | null
	// The same by row (0 to count - 1, as forEach passes it), for callers that go over many titles once per version.
	factsAt(row: number): TitleFacts
	cosineAt(row: number, unitTaste: Float32Array): number | null
	fingerprintAt(row: number): Uint8Array
}

const K = FINGERPRINT_LENGTH

class LoadedSnapshot implements TitleSnapshot {
	readonly version: string
	readonly builtAt: Date
	readonly count: number
	readonly stats: CatalogStats
	private readonly genreNames: string[]
	private readonly originNames: string[]
	// 1 / |fingerprint| per row; 0 for a fingerprint of all zeros.
	private readonly inverseNorms: Float32Array
	// Bit i is MOOD_KEYS[i].
	private readonly moodMasks: Uint16Array

	constructor(
		manifest: Manifest,
		private readonly c: Columns,
	) {
		this.version = manifest.version
		this.builtAt = new Date(manifest.builtAt)
		this.count = c.count
		this.genreNames = manifest.genres
		this.originNames = manifest.origins
		this.inverseNorms = new Float32Array(c.count)
		this.moodMasks = new Uint16Array(c.count)
		const genreLists = new Map<number, string[]>()
		for (let row = 0; row < c.count; row++) {
			const fp = c.fingerprints.subarray(row * K, row * K + K)
			let squares = 0
			for (let k = 0; k < K; k++) {
				const v = fp[k]
				if (v !== MISSING_SCORE) squares += v * v
			}
			this.inverseNorms[row] = squares > 0 ? 1 / Math.sqrt(squares) : 0
			const bits = c.genres[row]
			let genres = genreLists.get(bits)
			if (!genres) {
				genres = this.genresOf(bits)
				genreLists.set(bits, genres)
			}
			this.moodMasks[row] = moodMaskOf(fp, genres)
		}
		this.stats = catalogStats(c)
	}

	/** The row of a point id, by binary search over the sorted ids; -1 when absent. */
	private rowOf(key: TitleKey): number {
		const ids = this.c.pointIds
		let lo = 0
		let hi = ids.length - 1
		while (lo <= hi) {
			const mid = (lo + hi) >>> 1
			const id = ids[mid]
			if (id === key) return mid
			if (id < key) lo = mid + 1
			else hi = mid - 1
		}
		return -1
	}

	private genresOf(bits: number): string[] {
		const genres: string[] = []
		for (let i = 0; i < this.genreNames.length; i++)
			if (bits & (1 << i)) genres.push(this.genreNames[i])
		return genres
	}

	has(key: TitleKey): boolean {
		return this.rowOf(key) >= 0
	}

	facts(key: TitleKey): TitleFacts | null {
		const row = this.rowOf(key)
		return row < 0 ? null : this.factsAt(row)
	}

	factsAt(row: number): TitleFacts {
		const c = this.c
		const key = c.pointIds[row]
		const isShow = key >= SHOW_BASE
		const day = c.releaseDays[row]
		const score = c.scores[row]
		const origin = c.origins[row]
		const flags = c.flags[row]
		return {
			mediaType: isShow ? "show" : "movie",
			tmdbId: key - (isShow ? SHOW_BASE : MOVIE_BASE),
			genres: this.genresOf(c.genres[row]),
			releaseDay: day === UNKNOWN_DAY ? null : day,
			score: score === UNKNOWN_SCORE ? null : score,
			votes: c.votes[row],
			popularity: c.popularity[row],
			origin: origin === UNKNOWN_ORIGIN ? null : this.originNames[origin],
			hasPoster: (flags & FLAG_POSTER) !== 0,
			hasBackdrop: (flags & FLAG_BACKDROP) !== 0,
			adult: (flags & FLAG_ADULT) !== 0,
			anime: (flags & FLAG_ANIME) !== 0,
			moods: moodsInMask(this.moodMasks[row]),
		}
	}

	cosine(key: TitleKey, unitTaste: Float32Array): number | null {
		const row = this.rowOf(key)
		return row < 0 ? null : this.cosineAt(row, unitTaste)
	}

	cosineAt(row: number, unitTaste: Float32Array): number | null {
		const inverseNorm = this.inverseNorms[row]
		if (inverseNorm === 0) return null
		const fp = this.c.fingerprints
		const start = row * K
		let dot = 0
		for (let k = 0; k < K; k++) {
			const v = fp[start + k]
			if (v !== MISSING_SCORE) dot += v * unitTaste[k]
		}
		return dot * inverseNorm
	}

	forEach(fn: (key: TitleKey, row: number) => void): void {
		const ids = this.c.pointIds
		for (let row = 0; row < ids.length; row++) fn(ids[row], row)
	}

	fingerprint(key: TitleKey): Uint8Array | null {
		const row = this.rowOf(key)
		return row < 0 ? null : this.fingerprintAt(row)
	}

	fingerprintAt(row: number): Uint8Array {
		return this.c.fingerprints.subarray(row * K, row * K + K)
	}
}

/** Derives the inverse norms, mood masks, and catalog statistics from decoded, checked columns. */
export function buildSnapshot(
	manifest: Manifest,
	columns: Columns,
): TitleSnapshot {
	return new LoadedSnapshot(manifest, columns)
}
