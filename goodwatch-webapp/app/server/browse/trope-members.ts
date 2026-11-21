// Which titles carry a trope, and which of them bend it, in a form that is small in Redis and in memory: the TMDB ids of
// each kind as sorted 32-bit integers (base64 in the cached record, a Uint32Array in memory), plus the few titles whose
// write-up bends the trope. A trope with 12,000 titles takes 48 KB here instead of a Set of 12,000 numbers.
//
// No IO: trope-members.server.ts reads the rows from Crate and keeps the records in the shared cache.
import { type Play, isPlay } from "~/domain/tropes/play"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"

export const TROPE_RECORD_FORMAT = 1

/** One trope's membership as stored in the shared cache (JSON). */
export type TropeRecord = {
	format: typeof TROPE_RECORD_FORMAT
	/** Sorted, distinct movie TMDB ids, as little-endian uint32 in base64. */
	movies: string
	/** The same for shows. */
	shows: string
	/** The titles whose write-up bends the trope, as [title key, play]. */
	bent: [TitleKey, Play][]
}

export interface TropeRow {
	media_type: string
	media_tmdb_id: number
	/** How the write-up's plain text starts; null when it has none. */
	play: Play | null
}

function packIds(ids: Iterable<number>): string {
	const sorted = Uint32Array.from(new Set(ids)).sort()
	return Buffer.from(sorted.buffer, sorted.byteOffset, sorted.byteLength).toString("base64")
}

function unpackIds(text: string): Uint32Array {
	const bytes = Buffer.from(text, "base64")
	// A copy aligned for Uint32Array (Buffer views may start at any byte offset).
	const out = new Uint32Array(Math.floor(bytes.byteLength / 4))
	new Uint8Array(out.buffer).set(bytes.subarray(0, out.byteLength))
	return out
}

/** The record for a trope's rows (one row per title write-up; other media types are left out). */
export function encodeTrope(rows: readonly TropeRow[]): TropeRecord {
	const movies: number[] = []
	const shows: number[] = []
	const bent = new Map<TitleKey, Play>()
	for (const r of rows) {
		const id = Number(r.media_tmdb_id)
		if (!Number.isInteger(id) || id <= 0 || id > 0xffffffff) continue
		const type = r.media_type === "movie" ? "movie" : r.media_type === "show" ? "show" : null
		if (!type) continue
		;(type === "movie" ? movies : shows).push(id)
		if (r.play && r.play !== "straight") bent.set(titleKey(type, id), r.play)
	}
	return {
		format: TROPE_RECORD_FORMAT,
		movies: packIds(movies),
		shows: packIds(shows),
		bent: [...bent],
	}
}

function hasId(ids: Uint32Array, id: number): boolean {
	let lo = 0
	let hi = ids.length - 1
	while (lo <= hi) {
		const mid = (lo + hi) >>> 1
		const v = ids[mid]
		if (v === id) return true
		if (v < id) lo = mid + 1
		else hi = mid - 1
	}
	return false
}

/** One trope's titles in memory. Every title with a write-up counts, well-known or not. */
export class TropeMembers {
	readonly movies: Uint32Array
	readonly shows: Uint32Array
	private readonly bentByKey: ReadonlyMap<TitleKey, Play>

	constructor(movies: Uint32Array, shows: Uint32Array, bent: ReadonlyMap<TitleKey, Play>) {
		this.movies = movies
		this.shows = shows
		this.bentByKey = bent
	}

	/** Titles that carry the trope (movies and shows). */
	get size(): number {
		return this.movies.length + this.shows.length
	}

	/** Titles whose write-up bends the trope (subverted, averted, lampshaded…). */
	get bentCount(): number {
		return this.bentByKey.size
	}

	/** The share of write-ups that bend the trope, 0 to 1 (0 for a trope without titles). */
	get twistShare(): number {
		return this.size ? this.bentByKey.size / this.size : 0
	}

	has(key: TitleKey): boolean {
		const { mediaType, tmdbId } = parseTitleKey(key)
		return hasId(mediaType === "movie" ? this.movies : this.shows, tmdbId)
	}

	/** How a title plays the trope, or null when it doesn't carry it. */
	play(key: TitleKey): Play | null {
		return this.bentByKey.get(key) ?? (this.has(key) ? "straight" : null)
	}

	/** The titles that bend the trope, with how. */
	bent(): ReadonlyMap<TitleKey, Play> {
		return this.bentByKey
	}

	/** Every title key, movies first, each kind in TMDB id order. */
	*keys(): IterableIterator<TitleKey> {
		for (const id of this.movies) yield titleKey("movie", id)
		for (const id of this.shows) yield titleKey("show", id)
	}
}

/** The in-memory form of a cached record, or null for a record of another format. */
export function decodeTrope(record: unknown): TropeMembers | null {
	if (!record || typeof record !== "object") return null
	const r = record as Partial<TropeRecord>
	if (
		r.format !== TROPE_RECORD_FORMAT ||
		typeof r.movies !== "string" ||
		typeof r.shows !== "string"
	)
		return null
	const bent = new Map<TitleKey, Play>()
	for (const pair of Array.isArray(r.bent) ? r.bent : []) {
		if (Array.isArray(pair) && typeof pair[0] === "number" && isPlay(pair[1]))
			bent.set(pair[0], pair[1])
	}
	return new TropeMembers(unpackIds(r.movies), unpackIds(r.shows), bent)
}
