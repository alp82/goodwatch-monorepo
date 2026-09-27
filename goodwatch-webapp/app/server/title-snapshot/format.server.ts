// The title snapshot's stored format, version 1: the manifest at `title-snapshot:current` and the column bytes split
// into chunks at `title-snapshot:<version>:<n>`. The Windmill publisher writes it, and scripts/write-title-snapshot.ts
// writes it from a sample for development; the webapp decodes it here. A change to the layout bumps FORMAT.
//
// Layout: the chunks, joined in order n = 0, 1, ..., are the columns one after another, little-endian, every column
// holding one value per title in the same row order. Rows are sorted by point id, ascending and unique. The columns,
// widest type first so each one starts on an aligned offset:
//
//   point id      float64      movie 1e12 + tmdb_id, show 2e12 + tmdb_id
//   genres        uint32       bit i set for manifest.genres[i]
//   release day   int32        days since 1970-01-01 (a film's release date, a show's last air date); INT32_MIN unknown
//   votes         uint32       goodwatch_overall_score_voting_count
//   popularity    float32      TMDB popularity
//   fingerprint   uint8 x 74   raw 0 to 10 scores in manifest.keyOrder; 255 for a missing score
//   score         uint8        goodwatch_overall_score_normalized_percent rounded down, 0 to 100; 255 unknown
//   origin        uint8        index into manifest.origins (first production country, else original language); 255 unknown
//   flags         uint8        FLAG_* bits
//
// That is 101 bytes per title. manifest.sha256 is the SHA-256 (hex) of the joined chunks.
import { createHash } from "node:crypto"

export const FORMAT = 1
export const CURRENT_KEY = "title-snapshot:current"
export const chunkKey = (version: string, n: number) =>
	`title-snapshot:${version}:${n}`
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024

export const FINGERPRINT_LENGTH = 74
export const MISSING_SCORE = 255
export const UNKNOWN_DAY = -2147483648
export const UNKNOWN_SCORE = 255
export const UNKNOWN_ORIGIN = 255
export const MAX_GENRES = 32
export const MAX_ORIGINS = 255

export const FLAG_POSTER = 1
export const FLAG_BACKDROP = 2
export const FLAG_ADULT = 4
export const FLAG_ANIME = 8

export const MOVIE_BASE = 1e12
export const SHOW_BASE = 2e12

export const BYTES_PER_TITLE =
	8 + 4 + 4 + 4 + 4 + FINGERPRINT_LENGTH + 1 + 1 + 1

export interface Manifest {
	version: string
	format: number
	count: number
	chunks: number
	sha256: string
	keyOrder: string[]
	genres: string[]
	origins: string[]
	builtAt: string
}

export interface Columns {
	count: number
	pointIds: Float64Array
	genres: Uint32Array
	releaseDays: Int32Array
	votes: Uint32Array
	popularity: Float32Array
	fingerprints: Uint8Array // count x 74, row after row
	scores: Uint8Array
	origins: Uint8Array
	flags: Uint8Array
}

export class SnapshotRefused extends Error {
	constructor(message: string) {
		super(message)
		this.name = "SnapshotRefused"
	}
}

const isLittleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1

/** Views of the columns over one buffer of count * BYTES_PER_TITLE bytes; no copy. */
export function columnsOf(buffer: ArrayBuffer, count: number): Columns {
	if (!isLittleEndian)
		throw new Error("The title snapshot needs a little-endian machine")
	if (buffer.byteLength !== count * BYTES_PER_TITLE)
		throw new SnapshotRefused(
			`Snapshot holds ${buffer.byteLength} bytes; ${count} titles need ${count * BYTES_PER_TITLE}`,
		)
	let offset = 0
	const take = <T>(make: (at: number) => T, width: number): T => {
		const view = make(offset)
		offset += width * count
		return view
	}
	return {
		count,
		pointIds: take((at) => new Float64Array(buffer, at, count), 8),
		genres: take((at) => new Uint32Array(buffer, at, count), 4),
		releaseDays: take((at) => new Int32Array(buffer, at, count), 4),
		votes: take((at) => new Uint32Array(buffer, at, count), 4),
		popularity: take((at) => new Float32Array(buffer, at, count), 4),
		fingerprints: take(
			(at) => new Uint8Array(buffer, at, count * FINGERPRINT_LENGTH),
			FINGERPRINT_LENGTH,
		),
		scores: take((at) => new Uint8Array(buffer, at, count), 1),
		origins: take((at) => new Uint8Array(buffer, at, count), 1),
		flags: take((at) => new Uint8Array(buffer, at, count), 1),
	}
}

/** Checks the manifest's shape and that its key order is the webapp's own. Throws SnapshotRefused. */
export function checkManifest(
	value: unknown,
	keyOrder: readonly string[],
): Manifest {
	const m = value as Partial<Manifest> | null
	const fail = (why: string): never => {
		throw new SnapshotRefused(`Title snapshot manifest refused: ${why}`)
	}
	if (!m || typeof m !== "object") return fail("not an object")
	if (m.format !== FORMAT)
		return fail(`format ${m.format}, this webapp reads ${FORMAT}`)
	if (typeof m.version !== "string" || !/^[\w.-]{1,64}$/.test(m.version))
		return fail("bad version")
	if (!Number.isSafeInteger(m.count) || (m.count as number) < 0)
		return fail("bad count")
	if (!Number.isSafeInteger(m.chunks) || (m.chunks as number) < 1)
		return fail("bad chunk count")
	if (typeof m.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(m.sha256))
		return fail("bad sha256")
	if (
		!Array.isArray(m.keyOrder) ||
		m.keyOrder.length !== keyOrder.length ||
		m.keyOrder.some((key, i) => key !== keyOrder[i])
	)
		return fail("its fingerprint key order differs from VALID_FINGERPRINT_KEYS")
	const isTable = (t: unknown, max: number) =>
		Array.isArray(t) &&
		t.length <= max &&
		t.every((s) => typeof s === "string") &&
		new Set(t).size === t.length
	if (!isTable(m.genres, MAX_GENRES)) return fail("bad genre table")
	if (!isTable(m.origins, MAX_ORIGINS)) return fail("bad origin table")
	if (typeof m.builtAt !== "string" || Number.isNaN(Date.parse(m.builtAt)))
		return fail("bad builtAt")
	return m as Manifest
}

/** Joins the chunks into one fresh buffer and checks it against the manifest. Throws SnapshotRefused. */
export function joinChunks(manifest: Manifest, chunks: Uint8Array[]): Columns {
	const hash = createHash("sha256")
	let total = 0
	for (const chunk of chunks) {
		hash.update(chunk)
		total += chunk.byteLength
	}
	const digest = hash.digest("hex")
	if (digest !== manifest.sha256)
		throw new SnapshotRefused(
			`Title snapshot ${manifest.version} refused: checksum ${digest} differs from the manifest's ${manifest.sha256}`,
		)
	const bytes = new Uint8Array(total)
	let at = 0
	for (const chunk of chunks) {
		bytes.set(chunk, at)
		at += chunk.byteLength
	}
	const columns = columnsOf(bytes.buffer, manifest.count)
	checkRows(manifest, columns)
	return columns
}

// Values the rest of the webapp relies on: sorted unique ids of movies or shows, scores 0 to 10 or missing, and
// table indexes inside their tables.
function checkRows(manifest: Manifest, c: Columns) {
	const fail = (why: string): never => {
		throw new SnapshotRefused(
			`Title snapshot ${manifest.version} refused: ${why}`,
		)
	}
	let previous = Number.NEGATIVE_INFINITY
	for (let row = 0; row < c.count; row++) {
		const id = c.pointIds[row]
		if (!(id > previous)) return fail(`point ids not ascending at row ${row}`)
		const tmdbId = id >= SHOW_BASE ? id - SHOW_BASE : id - MOVIE_BASE
		if (!Number.isSafeInteger(tmdbId) || tmdbId < 0 || tmdbId >= MOVIE_BASE)
			return fail(`bad point id ${id}`)
		previous = id
	}
	const genreBits =
		manifest.genres.length >= 32 ? 0 : ~((1 << manifest.genres.length) - 1)
	for (let row = 0; row < c.count; row++) {
		if (c.genres[row] & genreBits)
			return fail(`genre bits outside the table at row ${row}`)
		const origin = c.origins[row]
		if (origin !== UNKNOWN_ORIGIN && origin >= manifest.origins.length)
			return fail(`origin outside the table at row ${row}`)
		const score = c.scores[row]
		if (score !== UNKNOWN_SCORE && score > 100)
			return fail(`GoodWatch score ${score} at row ${row}`)
	}
	const fp = c.fingerprints
	for (let i = 0; i < fp.length; i++)
		if (fp[i] > 10 && fp[i] !== MISSING_SCORE)
			return fail(`fingerprint score ${fp[i]} at row ${Math.floor(i / 74)}`)
}

// --- Writing (the development script; the Windmill publisher follows the same layout) -------------------------------

export interface SnapshotRow {
	pointId: number
	genres: readonly string[]
	releaseDay: number | null
	votes: number
	popularity: number
	fingerprint: ArrayLike<number> // 74 scores in key order, MISSING_SCORE for a missing one
	score: number | null
	origin: string | null
	hasPoster: boolean
	hasBackdrop: boolean
	adult: boolean
	anime: boolean
}

/** Encodes rows into the manifest and its chunks. Sorts the rows by point id; the tables come from the rows. */
export function encodeSnapshot(input: {
	version: string
	rows: SnapshotRow[]
	keyOrder: readonly string[]
	builtAt?: Date
}): { manifest: Manifest; chunks: Uint8Array[] } {
	const rows = [...input.rows].sort((a, b) => a.pointId - b.pointId)
	const genres = [...new Set(rows.flatMap((r) => r.genres))].sort()
	if (genres.length > MAX_GENRES)
		throw new Error(`${genres.length} genres; format ${FORMAT} holds 32`)
	// The most common origins get the table's places; rarer ones beyond it are stored as unknown.
	const originCounts = new Map<string, number>()
	for (const r of rows)
		if (r.origin)
			originCounts.set(r.origin, (originCounts.get(r.origin) ?? 0) + 1)
	const origins = [...originCounts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, MAX_ORIGINS)
		.map(([origin]) => origin)
	const genreIndex = new Map(genres.map((g, i) => [g, i]))
	const originIndex = new Map(origins.map((o, i) => [o, i]))

	const count = rows.length
	const bytes = new Uint8Array(count * BYTES_PER_TITLE)
	const c = columnsOf(bytes.buffer, count)
	rows.forEach((r, row) => {
		c.pointIds[row] = r.pointId
		let bits = 0
		for (const g of r.genres) bits |= 1 << (genreIndex.get(g) as number)
		c.genres[row] = bits >>> 0
		c.releaseDays[row] = r.releaseDay ?? UNKNOWN_DAY
		c.votes[row] = Math.max(0, Math.min(0xffffffff, Math.round(r.votes)))
		c.popularity[row] = r.popularity
		for (let k = 0; k < FINGERPRINT_LENGTH; k++)
			c.fingerprints[row * FINGERPRINT_LENGTH + k] = r.fingerprint[k]
		c.scores[row] =
			r.score == null
				? UNKNOWN_SCORE
				: Math.max(0, Math.min(100, Math.floor(r.score)))
		c.origins[row] =
			r.origin == null
				? UNKNOWN_ORIGIN
				: (originIndex.get(r.origin) ?? UNKNOWN_ORIGIN)
		c.flags[row] =
			(r.hasPoster ? FLAG_POSTER : 0) |
			(r.hasBackdrop ? FLAG_BACKDROP : 0) |
			(r.adult ? FLAG_ADULT : 0) |
			(r.anime ? FLAG_ANIME : 0)
	})

	const chunks: Uint8Array[] = []
	for (let at = 0; at < bytes.length || chunks.length === 0; ) {
		chunks.push(bytes.subarray(at, at + MAX_CHUNK_BYTES))
		at += MAX_CHUNK_BYTES
	}
	return {
		manifest: {
			version: input.version,
			format: FORMAT,
			count,
			chunks: chunks.length,
			sha256: createHash("sha256").update(bytes).digest("hex"),
			keyOrder: [...input.keyOrder],
			genres,
			origins,
			builtAt: (input.builtAt ?? new Date()).toISOString(),
		},
		chunks,
	}
}
