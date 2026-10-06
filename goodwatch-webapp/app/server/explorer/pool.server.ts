// The Explorer's pool: the snapshot titles with a poster and a backdrop, the 9,000 most voted movies with at least 800
// votes and the 3,000 most voted shows with at least 200 (about 12,000 titles), with what every request needs about
// them precomputed: descriptive vectors for closeness, a quality score, and display fields.
//
// Built once per snapshot version. Candidates are selected from snapshot columns; facts are created only for the
// top rows kept for each media type. The display fields (title, year, poster, backdrop, genres) and the title analysis's
// occasion flags, which the snapshot doesn't hold, are the only thing read from Crate, in the background by primary key, once per version; no request reads Crate for the pool.
import { onShutdown } from "~/server/lifecycle.server"
import type {
	TitleFacts,
	TitleKey,
	TitleSnapshot,
} from "~/server/title-snapshot/index.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { query } from "~/utils/crate"
import { selectCandidateRows } from "./pool-select.server"

const DISPLAY_BATCH = 1000
const MISSING_SCORE = 255

// Craft attributes are high for every acclaimed title and homages are everywhere, so closeness and "what sets an
// island apart" use the descriptive attributes only.
const LEFT_OUT = new Set([
	"direction",
	"acting",
	"cinematography",
	"editing",
	"music_composition",
	"dialogue_quality",
	"narrative_structure",
	"rewatchability",
	"homage_and_reference",
])
/** Indexes into VALID_FINGERPRINT_KEYS of the attributes Explorer compares titles by. */
export const DESCRIPTIVE = VALID_FINGERPRINT_KEYS.flatMap((key, k) =>
	LEFT_OUT.has(key) ? [] : [k],
)
export const DESCRIPTIVE_KEYS = DESCRIPTIVE.map(
	(k) => VALID_FINGERPRINT_KEYS[k],
)
const D = DESCRIPTIVE.length

/**
 * The title analysis's suitability and viewing-context flags the Occasion grouping uses, as the Crate columns that hold
 * them. Bit i of a title's `occasions` is OCCASION_FLAGS[i].
 */
export const OCCASION_FLAGS = [
	"suitability_date_night",
	"suitability_partner",
	"suitability_family",
	"suitability_intergenerational",
	"suitability_friends",
	"suitability_group_party",
	"suitability_solo_watch",
	"suitability_kids",
	"suitability_teens",
	"context_is_comfort_watch",
	"context_is_binge_friendly",
	"context_is_background_friendly",
	"context_is_pure_escapism",
	"context_is_drop_in_friendly",
] as const

export type OccasionFlag = (typeof OCCASION_FLAGS)[number]

export interface Display {
	title: string
	year: number | null
	poster: string
	backdrop: string | null
	/** The first two genres, in TMDB's order (the snapshot's genre bits have no order). */
	genres: string[]
	/** Bit i set when the title analysis sets OCCASION_FLAGS[i]. */
	occasions: number
}

export interface ExplorerPool {
	readonly version: string
	readonly snapshot: TitleSnapshot
	readonly n: number
	readonly keys: Float64Array
	/** Snapshot rows, for the snapshot's by-row accessors. */
	readonly rows: Int32Array
	readonly facts: TitleFacts[]
	readonly display: Display[]
	/** Descriptive attributes as z-scores over the pool, n x D. */
	readonly z: Float32Array
	/** The same, unit length, for cosines. */
	readonly unit: Float32Array
	/** 0 to 1, not personal: GoodWatch score and how many people voted. */
	readonly quality: Float32Array
	readonly years: Int16Array
	indexOf(key: TitleKey): number
}

export const DIMENSIONS = D

const WARM_EVERY_MS = 60_000

let ready: ExplorerPool | null = null
let building: { version: string; promise: Promise<ExplorerPool> } | null = null

/**
 * The pool for the snapshot. A new snapshot version builds a new pool in the background while requests keep getting
 * the previous one; only the very first build is waited for.
 */
export function explorerPool(snapshot: TitleSnapshot): Promise<ExplorerPool> {
	if (ready?.version === snapshot.version) return Promise.resolve(ready)
	if (building?.version !== snapshot.version) {
		const promise = buildPool(snapshot)
		const entry = { version: snapshot.version, promise }
		building = entry
		promise.then(
			(pool) => {
				ready = pool
				if (building === entry) building = null
			},
			(error) => {
				console.error("Explorer pool not built:", error)
				if (building === entry) building = null
			},
		)
	}
	return ready ? Promise.resolve(ready) : building.promise
}

let warming: NodeJS.Timeout | undefined

/**
 * Builds the pool as soon as the snapshot has loaded, and again for each new snapshot version, so no request waits
 * for its display fields. Safe to call more than once.
 */
export function keepExplorerPoolWarm(
	getSnapshot: () => TitleSnapshot | null,
): void {
	if (warming) return
	const check = () => {
		const snapshot = getSnapshot()
		if (snapshot) explorerPool(snapshot).catch(() => {})
		warming = setTimeout(check, snapshot ? WARM_EVERY_MS : 2_000)
		warming.unref()
	}
	warming = setTimeout(check, 0)
	warming.unref()
	onShutdown("explorer pool warm-up", () => clearTimeout(warming))
}

async function buildPool(snapshot: TitleSnapshot): Promise<ExplorerPool> {
	const startedAt = performance.now()
	const selected = selectCandidateRows(snapshot)
	const candidates = [...selected.movie, ...selected.show].map((row) => ({
		row,
		facts: snapshot.factsAt(row),
	}))
	const selectMs = performance.now() - startedAt

	const displayStartedAt = performance.now()
	const display = await readDisplay(candidates)
	const displayMs = performance.now() - displayStartedAt
	// A title Crate no longer has, or has without a poster, stays off the map.
	const kept = candidates.filter((c) => display.has(key(c)))

	const pool = derive(snapshot, kept, display)
	console.info(
		`Explorer pool ${snapshot.version}: ${pool.n} titles in ${Math.round(performance.now() - startedAt)} ms (selecting ${Math.round(selectMs)} ms, display fields ${Math.round(displayMs)} ms)`,
	)
	return pool
}

interface Candidate {
	row: number
	facts: TitleFacts
}

const key = (c: Candidate) =>
	(c.facts.mediaType === "movie" ? 1e12 : 2e12) + c.facts.tmdbId

async function readDisplay(
	candidates: Candidate[],
): Promise<Map<TitleKey, Display>> {
	const out = new Map<TitleKey, Display>()
	for (const mediaType of ["movie", "show"] as const) {
		const ids = candidates
			.filter((c) => c.facts.mediaType === mediaType)
			.map((c) => c.facts.tmdbId)
		const base = mediaType === "movie" ? 1e12 : 2e12
		// One batch at a time: this runs in the background and shouldn't crowd Crate.
		for (let at = 0; at < ids.length; at += DISPLAY_BATCH) {
			const batch = ids.slice(at, at + DISPLAY_BATCH)
			const rows = await query<
				{
					tmdb_id: number
					title: string | null
					release_year: number | null
					poster_path: string | null
					backdrop_path: string | null
					genres: string[] | null
				} & Partial<Record<OccasionFlag, boolean | null>>
			>(
				`SELECT tmdb_id, title, release_year, poster_path, backdrop_path, genres, ${OCCASION_FLAGS.join(", ")}
				 FROM ${mediaType} WHERE tmdb_id IN (${batch.map(() => "?").join(",")}) LIMIT ?`,
				[...batch, batch.length],
			)
			for (const r of rows) {
				if (!r.title || !r.poster_path) continue
				let occasions = 0
				OCCASION_FLAGS.forEach((flag, bit) => {
					if (r[flag]) occasions |= 1 << bit
				})
				out.set(base + Number(r.tmdb_id), {
					title: r.title,
					year: r.release_year || null,
					poster: r.poster_path,
					backdrop: r.backdrop_path || null,
					genres: (r.genres ?? []).slice(0, 2),
					occasions,
				})
			}
		}
	}
	return out
}

function derive(
	snapshot: TitleSnapshot,
	kept: Candidate[],
	displayByKey: Map<TitleKey, Display>,
): ExplorerPool {
	const n = kept.length
	const keys = new Float64Array(n)
	const rows = new Int32Array(n)
	const facts: TitleFacts[] = []
	const display: Display[] = []
	const years = new Int16Array(n)
	kept.forEach((c, i) => {
		keys[i] = key(c)
		rows[i] = c.row
		facts.push(c.facts)
		display.push(displayByKey.get(keys[i]) as Display)
		years[i] =
			c.facts.releaseDay === null
				? (display[i].year ?? 0)
				: new Date(c.facts.releaseDay * 86_400_000).getUTCFullYear()
	})

	// z-scores over the pool, so an attribute every title in the pool has says little.
	const raw = new Float32Array(n * D)
	for (let i = 0; i < n; i++) {
		const fp = snapshot.fingerprintAt(rows[i])
		for (let d = 0; d < D; d++) {
			const v = fp[DESCRIPTIVE[d]]
			raw[i * D + d] = v === MISSING_SCORE ? 0 : v
		}
	}
	const mean = new Float64Array(D)
	const sd = new Float64Array(D)
	for (let i = 0; i < n; i++)
		for (let d = 0; d < D; d++) mean[d] += raw[i * D + d] / n
	for (let i = 0; i < n; i++)
		for (let d = 0; d < D; d++) sd[d] += (raw[i * D + d] - mean[d]) ** 2 / n
	for (let d = 0; d < D; d++) sd[d] = Math.sqrt(sd[d]) || 1
	const z = new Float32Array(n * D)
	const unit = new Float32Array(n * D)
	for (let i = 0; i < n; i++) {
		let squares = 0
		for (let d = 0; d < D; d++) {
			const v = (raw[i * D + d] - mean[d]) / sd[d]
			z[i * D + d] = v
			squares += v * v
		}
		const length = Math.sqrt(squares) || 1
		for (let d = 0; d < D; d++) unit[i * D + d] = z[i * D + d] / length
	}

	// Quality: the GoodWatch score, and the vote percentile within the pool so well-known titles lead.
	const byVotes = Array.from({ length: n }, (_, i) => i).sort(
		(a, b) => facts[a].votes - facts[b].votes,
	)
	const quality = new Float32Array(n)
	byVotes.forEach((i, rank) => {
		const percentile = rank / Math.max(1, n - 1)
		quality[i] = 0.6 * ((facts[i].score ?? 50) / 100) + 0.4 * percentile
	})

	const index = new Map<TitleKey, number>()
	for (let i = 0; i < n; i++) index.set(keys[i], i)
	return {
		version: snapshot.version,
		snapshot,
		n,
		keys,
		rows,
		facts,
		display,
		z,
		unit,
		quality,
		years,
		indexOf: (k) => index.get(k) ?? -1,
	}
}

/** Cosine between two pool titles over the descriptive attributes. */
export function cosineOf(pool: ExplorerPool, i: number, j: number): number {
	const u = pool.unit
	let dot = 0
	for (let d = 0, a = i * D, b = j * D; d < D; d++) dot += u[a + d] * u[b + d]
	return dot
}

/** Cosine between a pool title and a unit-length vector of D descriptive attributes. */
export function cosineTo(
	pool: ExplorerPool,
	i: number,
	vector: Float64Array,
): number {
	const u = pool.unit
	let dot = 0
	for (let d = 0, a = i * D; d < D; d++) dot += u[a + d] * vector[d]
	return dot
}
