// A person's taste as surfaces use it: the match for any titles, why a title matches, and what the person leans to.
import type {
	TitleKey,
	TitleSnapshot,
} from "~/server/title-snapshot/index.server"
import {
	type CoreScores,
	VALID_FINGERPRINT_KEYS,
} from "~/server/utils/fingerprint"
import { TASTE_LENGTH, displayMatch, percentileOf } from "./formula.server"
import { type TastePool, tastePool } from "./pool.server"

export type FingerprintKey = keyof CoreScores

export interface Taste {
	/** "none" below 5 liked titles: no vector, and match returns nulls. */
	readonly signal: "none" | "some"
	/** All ratings, with or without a fingerprint. */
	readonly ratings: number
	/** Liked titles (rated 6 or more) with a fingerprint. */
	readonly liked: number
	/** The unit-length taste vector in VALID_FINGERPRINT_KEYS order (the fingerprint_v1 space); null without taste. */
	readonly vector: Float32Array | null
	/** 50 to 99 per title; null for a title without a fingerprint in the snapshot, or without taste. */
	match(keys: TitleKey[]): (number | null)[]
	/** The attributes that most drive the title's match, strongest first. */
	reasons(key: TitleKey, n?: number): FingerprintKey[]
	/** The person's strongest attributes against the reference pool, strongest first. */
	leanings(n?: number): FingerprintKey[]
}

/** What a taste is made of, as stored for a member or built for a guest. */
export interface BuiltTaste {
	ratings: number
	liked: number
	vector: Float32Array | null
	quantiles: Float32Array | null
}

// Craft attributes say how well a title is made, not what it is like, so they never explain a match (as in the
// prototypes).
const CRAFT_KEYS: ReadonlySet<FingerprintKey> = new Set([
	"direction",
	"acting",
	"cinematography",
	"editing",
	"music_composition",
	"dialogue_quality",
	"narrative_structure",
	"rewatchability",
])
// Reasons: the person leans to the attribute by more than a quarter of the pool's standard deviation, the title
// stands out on it by more than half, and scores it 6 or more. The contribution is the product of the two leans.
const REASON_PERSON_LEAN = 0.25
const REASON_TITLE_LEAN = 0.5
const REASON_MIN_SCORE = 6
const MISSING_SCORE = 255

const KEYS = VALID_FINGERPRINT_KEYS

const nulls = (keys: TitleKey[]) => keys.map(() => null)

export const NO_TASTE: Taste = {
	signal: "none",
	ratings: 0,
	liked: 0,
	vector: null,
	match: nulls,
	reasons: () => [],
	leanings: () => [],
}

export function makeTaste(snapshot: TitleSnapshot, built: BuiltTaste): Taste {
	const { vector, quantiles } = built
	if (!vector || !quantiles)
		return { ...NO_TASTE, ratings: built.ratings, liked: built.liked }
	// Where the person stands on each key against the pool, in pool standard deviations. Only reasons and leanings
	// need it, so it's derived on first use.
	let against: { pool: TastePool; lean: Float64Array } | null = null
	const standing = () => {
		if (!against) {
			const pool = tastePool(snapshot)
			const lean = Float64Array.from(
				vector,
				(v, k) => (v - pool.mean[k]) / pool.sd[k],
			)
			against = { pool, lean }
		}
		return against
	}
	return {
		signal: "some",
		ratings: built.ratings,
		liked: built.liked,
		vector,
		match: (keys) =>
			keys.map((key) => {
				const cosine = snapshot.cosine(key, vector)
				return cosine === null
					? null
					: displayMatch(percentileOf(cosine, quantiles))
			}),
		reasons: (key, n = 2) => {
			const fp = snapshot.fingerprint(key)
			if (!fp) return []
			const { pool, lean: person } = standing()
			const { mean, sd } = pool
			let squares = 0
			for (let k = 0; k < TASTE_LENGTH; k++)
				if (fp[k] !== MISSING_SCORE) squares += fp[k] * fp[k]
			if (squares === 0) return []
			const norm = Math.sqrt(squares)
			const found: { key: FingerprintKey; contribution: number }[] = []
			for (let k = 0; k < TASTE_LENGTH; k++) {
				const score = fp[k]
				if (score === MISSING_SCORE || score < REASON_MIN_SCORE) continue
				if (person[k] <= REASON_PERSON_LEAN || CRAFT_KEYS.has(KEYS[k])) continue
				const titleLean = (score / norm - mean[k]) / sd[k]
				if (titleLean > REASON_TITLE_LEAN)
					found.push({ key: KEYS[k], contribution: person[k] * titleLean })
			}
			return found
				.sort((a, b) => b.contribution - a.contribution)
				.slice(0, n)
				.map((r) => r.key)
		},
		leanings: (n = 5) => {
			const person = standing().lean
			return KEYS.map((key, k) => ({ key, lean: person[k] }))
				.filter((r) => r.lean > 0 && !CRAFT_KEYS.has(r.key))
				.sort((a, b) => b.lean - a.lean)
				.slice(0, n)
				.map((r) => r.key)
		},
	}
}
