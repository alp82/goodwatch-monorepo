import { isOnServices } from "~/server/availability-index.server"
// The person a portrait describes, read against the catalog: their rated titles as z-scores against the reference pool
// of the catalog statistics, their usual rating and its spread, the two halves of their signature (what they choose
// and what they rate above their usual), and the unseen titles of the reference pool to suggest from.
//
// Everything here runs in memory over the title snapshot; nothing reads Crate.
import type { Taste } from "~/server/taste/index.server"
import { CRAFT_KEYS, type FingerprintKey } from "~/server/taste/index.server"
import type {
	TitleFacts,
	TitleKey,
	TitleSnapshot,
} from "~/server/title-snapshot/index.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { titleKey } from "~/utils/title-key"

export const KEYS = VALID_FINGERPRINT_KEYS as readonly string[]
export const K = KEYS.length
/** The attributes that describe what a title is like, not how well it's made: the ones sides and cosines use. */
export const NON_CRAFT = KEYS.flatMap((key, k) =>
	CRAFT_KEYS.has(key as FingerprintKey) ? [] : [k],
)
const MISSING_SCORE = 255

/** What a portrait is built from. */
export interface PortraitInput {
	kind: "member" | "guest" | "sample"
	/** Ratings, 1 to 10. */
	scores: ReadonlyMap<TitleKey, number>
	/** Titles the person chose to watch: rated or watched. */
	chosen: ReadonlySet<TitleKey>
	wantToSee: ReadonlySet<TitleKey>
	skipped: ReadonlySet<TitleKey>
	country: string
	services: number[]
	/** The person's taste match, for the match shown on suggestions. */
	taste: Taste
}

export interface RatedTitle {
	key: TitleKey
	score: number
	z: Float64Array
	fingerprint: Uint8Array
	facts: TitleFacts
}

export interface PoolTitle {
	key: TitleKey
	z: Float64Array
	facts: TitleFacts
}

export interface Person {
	input: PortraitInput
	snapshot: TitleSnapshot
	/** Rated titles with a title analysis. */
	rated: RatedTitle[]
	ratedByKey: Map<TitleKey, RatedTitle>
	/** Usual rating and its spread (1 when all ratings are equal). */
	mu: number
	sigma: number
	/** Mean z of the chosen titles. */
	selection: Float64Array
	/** Rating-weighted preference: the ratings' distance from the usual, plus Want to See and skipped titles. */
	preference: Float64Array
	/** Half what the person chooses, half what they rate above their usual (the direction suggestions are ranked by). */
	signature: Float64Array
	/** The reference pool titles the person hasn't rated, watched, skipped, or put on Want to See. */
	unseen: PoolTitle[]
	/** z of any title in the snapshot; null without a title analysis. */
	zOf(key: TitleKey): Float64Array | null
	match(keys: TitleKey[]): Map<TitleKey, number | null>
	onMyServices(key: TitleKey): boolean | null
}

// ---------- vector math ----------

export const average = (xs: number[]) =>
	xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/** Cosine over the non-craft attributes. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
	let dot = 0
	let na = 0
	let nb = 0
	for (const k of NON_CRAFT) {
		dot += a[k] * b[k]
		na += a[k] * a[k]
		nb += b[k] * b[k]
	}
	return na && nb ? dot / Math.sqrt(na * nb) : 0
}

export function meanOf(vectors: ArrayLike<number>[]): Float64Array {
	const mean = new Float64Array(K)
	if (!vectors.length) return mean
	for (const v of vectors) for (let k = 0; k < K; k++) mean[k] += v[k]
	for (let k = 0; k < K; k++) mean[k] /= vectors.length
	return mean
}

function unit(v: Float64Array): Float64Array {
	let squares = 0
	for (let k = 0; k < K; k++) squares += v[k] * v[k]
	const length = Math.sqrt(squares) || 1
	return v.map((x) => x / length)
}

export const round1 = (x: number) => Math.round(x * 10) / 10
export const round2 = (x: number) => Math.round(x * 100) / 100

export const yearOf = (facts: TitleFacts) =>
	facts.releaseDay === null
		? null
		: new Date(facts.releaseDay * 86_400_000).getUTCFullYear()

// ---------- z-scores against the reference pool ----------

function zScores(
	fingerprint: Uint8Array,
	mean: readonly number[],
	sd: readonly number[],
) {
	const z = new Float64Array(K)
	for (let k = 0; k < K; k++) {
		const v = fingerprint[k] === MISSING_SCORE ? 0 : fingerprint[k]
		z[k] = (v - mean[k]) / sd[k]
	}
	return z
}

let pool: { version: string; titles: PoolTitle[] } | null = null

/** The reference pool's titles with their z-scores, once per snapshot version. */
function referencePool(snapshot: TitleSnapshot): PoolTitle[] {
	if (pool?.version === snapshot.version) return pool.titles
	const { mean, sd } = snapshot.stats
	const titles = snapshot.referenceRows.map((row) => {
		const facts = snapshot.factsAt(row)
		return {
			key: titleKey(facts.mediaType, facts.tmdbId),
			z: zScores(snapshot.fingerprintAt(row), mean, sd),
			facts,
		}
	})
	pool = { version: snapshot.version, titles }
	return titles
}

// ---------- the person ----------

export function readPerson(
	snapshot: TitleSnapshot,
	input: PortraitInput,
): Person {
	const { mean, sd } = snapshot.stats
	const zCache = new Map<TitleKey, Float64Array | null>()
	const zOf = (key: TitleKey) => {
		if (zCache.has(key)) return zCache.get(key) ?? null
		const fp = snapshot.fingerprint(key)
		const z = fp ? zScores(fp, mean, sd) : null
		zCache.set(key, z)
		return z
	}

	const rated: RatedTitle[] = []
	for (const [key, score] of input.scores) {
		const fingerprint = snapshot.fingerprint(key)
		const facts = snapshot.facts(key)
		const z = zOf(key)
		if (!fingerprint || !facts || !z) continue
		rated.push({ key, score, z, fingerprint, facts })
	}
	// Best first, then by key, so every step that takes "the first" is repeatable.
	rated.sort((a, b) => b.score - a.score || a.key - b.key)
	const scores = rated.map((r) => r.score)
	const mu = average(scores)
	const sigma = Math.sqrt(average(scores.map((s) => (s - mu) ** 2))) || 1

	// The selection half: what they chose to watch; the ratings alone when nothing else is known.
	const chosen = [...input.chosen].flatMap((key) => zOf(key) ?? [])
	const selection = meanOf(chosen.length ? chosen : rated.map((r) => r.z))
	const preference = new Float64Array(K)
	let total = 0
	const add = (z: Float64Array, weight: number) => {
		total += Math.abs(weight)
		for (let k = 0; k < K; k++) preference[k] += weight * z[k]
	}
	for (const r of rated)
		add(r.z, Math.max(-2, Math.min(2, (r.score - mu) / sigma)))
	for (const key of input.wantToSee) {
		const z = input.scores.has(key) ? null : zOf(key)
		if (z) add(z, 0.3)
	}
	for (const key of input.skipped) {
		const z = input.scores.has(key) ? null : zOf(key)
		if (z) add(z, -0.6)
	}
	if (total) for (let k = 0; k < K; k++) preference[k] /= total
	const selectionUnit = unit(selection)
	const preferenceUnit = unit(preference)
	const signature = selectionUnit.map(
		(x, k) => (0.45 * x + 0.55 * preferenceUnit[k]) * 2,
	)

	const excluded = (key: TitleKey) =>
		input.chosen.has(key) ||
		input.scores.has(key) ||
		input.wantToSee.has(key) ||
		input.skipped.has(key)
	const unseen = referencePool(snapshot).filter(
		(t) => !excluded(t.key) && !t.facts.adult && t.facts.hasPoster,
	)

	const matches = new Map<TitleKey, number | null>()
	const services = input.services
	return {
		input,
		snapshot,
		rated,
		ratedByKey: new Map(rated.map((r) => [r.key, r])),
		mu,
		sigma,
		selection,
		preference,
		signature,
		unseen,
		zOf,
		match(keys) {
			const missing = keys.filter((key) => !matches.has(key))
			if (missing.length) {
				const found = input.taste.match(missing)
				missing.forEach((key, i) => matches.set(key, found[i]))
			}
			return matches
		},
		onMyServices: (key) =>
			services.length ? isOnServices(input.country, services, key) : null,
	}
}

/** Unseen titles ranked by closeness to a direction, with a nudge toward well-rated ones. */
export function rankUnseen(
	person: Person,
	direction: ArrayLike<number>,
	quality: number,
	keep: (t: PoolTitle) => boolean = () => true,
): PoolTitle[] {
	return person.unseen
		.filter(keep)
		.map((t) => ({
			t,
			value:
				cosine(t.z, direction) + (quality * ((t.facts.score ?? 0) - 72)) / 100,
		}))
		.sort((a, b) => b.value - a.value || a.t.key - b.t.key)
		.map((x) => x.t)
}
