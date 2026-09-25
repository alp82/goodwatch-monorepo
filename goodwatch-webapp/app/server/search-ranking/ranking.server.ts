// The scoring of the search ranking: every signal is z-scored over the candidate pool and summed with fixed weights.
// Pure functions; rank-search.server.ts fetches the signals and calls these. How it works:
// docs/prototypes/search-arena/results/simplify/HOW-IT-WORKS.md.
import type { Intent, Reference } from "./references.server.ts"
import type { NameEntity, SearchIndex } from "./search-index.server.ts"

/** Recorded with each search as its ranker version. Change it when the ranking changes. */
export const RANKER_VERSION = "hybrid-v1"

// --- Weights ---------------------------------------------------------------------------------------------------------

export const WEIGHTS = {
	/** Dense cosine of the query (or residual) to each title's text. */
	dense: 0.4,
	/** Jev's fingerprint: the weighted sum of the Jev weights and the raw 0..10 scores. */
	fingerprint: 0.48,
	bm25: 0.12,
	/** Dense match to each of Jev's searched phrases, averaged. */
	facet: 0.1,
	/** The weakest facet unit counts, so "western with samurai" needs both. */
	coverage: 0.3,
	/** Similarity to a negated phrase. */
	negation: 0.1,
	/** Keyword or tag labels that name the negated thing, times the label share. */
	negationLabels: 2.0,
	votes: 0.1,
	goodwatchScore: 0.1,
	// Reference profile, at full strength for style and both, at PROFILE_WEAK for like and filmography.
	profileFingerprint: 0.8,
	profileText: 0.6,
	profileTerms: 0.3,
	peers: 0.3,
	mentions: 0.1,
	/** min(z fingerprint, z text, z terms) of the profile. */
	agreement: 0.2,
	/** Own titles: + weight x credit weight; filmography queries let the entity's titles lead. */
	ownTitles: 1.0,
	ownTitlesFilmography: 4.0,
	/** Style and both: others' titles lose this x z(log votes) instead of the votes prior. */
	popularityDamping: 0.2,
	/** "early" / "late" with a person: z(-year) or z(year). */
	career: 1.0,
} as const
export const PROFILE_WEAK = 0.15
/** A coverage unit's score: z(dense) + COVERAGE_BM25 x z(BM25). */
export const COVERAGE_BM25 = 0.5
/** Coverage only for queries with at most this many content tokens. */
export const COVERAGE_MAX_TOKENS = 5
/** Non-English: share of z(English chips cosine) in the dense signal. */
export const NON_ENGLISH_MIX = 0.5

// Candidate depths.
/** Per whole-query list: dense, fingerprint, reference centroids. */
export const MAIN_DEPTH = 500
/** Per partial list: BM25, facets, coverage units, profile terms, mentions. */
export const PART_DEPTH = 300
/** Non-English: each cosine's top list, whose union is rescored with both. */
export const NON_ENGLISH_UNION_DEPTH = 2000
/** The returned list length. */
export const RESULT_LENGTH = 50

// Reference profiles.
export const PROFILE_TERMS = 40
const PROFILE_TERMS_MIN_DF = 2
const PEER_COUNT = 15
const PEER_TITLES = 8
/** Own titles in the top 10, (min, max) by intent. Filmography isn't bounded. */
const OWN_BOUNDS: Partial<Record<Intent, [number, number]>> = {
	like: [0, 1],
	style: [3, 6],
	both: [6, 10],
}
/** A title reference's own titles never take the first rank. */
const LIKE_FIRST = 1

// --- Numerics --------------------------------------------------------------------------------------------------------

/** z-scores with the population standard deviation; all zeros when the values don't vary. */
export function z(values: ArrayLike<number>): Float64Array {
	const n = values.length
	const out = new Float64Array(n)
	if (!n) return out
	let mean = 0
	for (let i = 0; i < n; i++) mean += values[i]
	mean /= n
	let variance = 0
	for (let i = 0; i < n; i++) variance += (values[i] - mean) ** 2
	const sd = Math.sqrt(variance / n)
	if (sd <= 1e-12) return out
	for (let i = 0; i < n; i++) out[i] = (values[i] - mean) / sd
	return out
}

/** Mean and population standard deviation (1 when it is 0). */
export function meanSd(values: ArrayLike<number>): [number, number] {
	const n = values.length
	if (!n) return [0, 1]
	let mean = 0
	for (let i = 0; i < n; i++) mean += values[i]
	mean /= n
	let variance = 0
	for (let i = 0; i < n; i++) variance += (values[i] - mean) ** 2
	return [mean, Math.sqrt(variance / n) || 1]
}

/** Missing values (NaN, or 0 and below, such as an unknown year) replaced by the mean of the others. */
export function filled(values: ArrayLike<number>): Float64Array {
	let sum = 0
	let count = 0
	for (let i = 0; i < values.length; i++) {
		if (values[i] > 0) {
			sum += values[i]
			count++
		}
	}
	const fill = count ? sum / count : 0
	return Float64Array.from(values, (v) => (v > 0 ? v : fill))
}

/** Point ids of the top k scores, highest first; ties keep the input order. */
export function topIds(
	ids: number[],
	scores: ArrayLike<number>,
	k: number,
): number[] {
	return ids
		.map((id, i) => [id, scores[i], i] as const)
		.sort((a, b) => b[1] - a[1] || a[2] - b[2])
		.slice(0, k)
		.map(([id]) => id)
}

/** The L2-normalized centroid of vectors, weighted by log(1 + votes). */
export function centroid(
	vectors: ArrayLike<number>[],
	votes: number[],
): Float32Array {
	const dim = vectors[0]?.length ?? 0
	const weights = votes.map((v) => Math.log1p(v))
	const total = weights.reduce((a, b) => a + b, 0) || 1
	const c = new Float64Array(dim)
	vectors.forEach((v, i) => {
		const w = weights[i] / total
		for (let d = 0; d < dim; d++) c[d] += v[d] * w
	})
	let norm = 0
	for (let d = 0; d < dim; d++) norm += c[d] * c[d]
	norm = Math.sqrt(norm) || 1
	return Float32Array.from(c, (x) => x / norm)
}

/** BM25 IDF over the eligible titles. */
export function idf(index: SearchIndex, term: number): number {
	const { n, df } = index.termStatistics
	return Math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
}

/**
 * The term profile of seed titles from their terms_bm25f_v1 indices: terms that at least min(2, seeds) of them share,
 * weighted by the share of seeds times IDF, the top PROFILE_TERMS sorted by weight, then by term.
 */
export function profileTerms(
	index: SearchIndex,
	seedTermIds: number[][],
): { term: number; weight: number }[] {
	const { sortedIds, sortedIdTerm, terms } = index.termStatistics
	const counts = new Map<number, number>()
	for (const ids of seedTermIds) {
		for (const id of new Set(ids)) {
			// Binary search the term of a terms_bm25f_v1 index. Terms of titles outside the statistics are skipped.
			let lo = 0
			let hi = sortedIds.length - 1
			while (lo <= hi) {
				const mid = (lo + hi) >> 1
				if (sortedIds[mid] < id) lo = mid + 1
				else if (sortedIds[mid] > id) hi = mid - 1
				else {
					const term = sortedIdTerm[mid]
					counts.set(term, (counts.get(term) ?? 0) + 1)
					break
				}
			}
		}
	}
	const seeds = seedTermIds.length
	const minDf = Math.min(PROFILE_TERMS_MIN_DF, seeds)
	const out: { term: number; weight: number }[] = []
	for (const [term, count] of counts) {
		if (count < minDf) continue
		const weight = (count / seeds) * idf(index, term)
		if (weight > 0) out.push({ term, weight })
	}
	return out
		.sort(
			(a, b) =>
				b.weight - a.weight || codePointCompare(terms[a.term], terms[b.term]),
		)
		.slice(0, PROFILE_TERMS)
}

/** Python's string order: by code point. */
export function codePointCompare(a: string, b: string): number {
	const x = [...a]
	const y = [...b]
	for (let i = 0; i < Math.min(x.length, y.length); i++) {
		if (x[i] !== y[i])
			return (x[i].codePointAt(0) ?? 0) - (y[i].codePointAt(0) ?? 0)
	}
	return x.length - y.length
}

/**
 * Peers of a reference: people (or studios, when every entity is a studio) whose fingerprint centroid is nearest to
 * the reference's, z-scored over their kind. The nearest PEER_COUNT that aren't the reference give max(z, 0) to their
 * top titles. Point id -> score.
 */
export function peerScores(
	index: SearchIndex,
	entities: NameEntity[],
	fingerprint: ArrayLike<number>,
): Map<number, number> {
	const { members, fingerprints, dim, titles } = index.peers
	const studios = entities.every((e) => e.kind === "studio")
	const mine = new Set(entities.flatMap((e) => e.members))
	const selected: number[] = []
	for (let i = 0; i < members.length; i++)
		if (members[i].startsWith("p:") !== studios) selected.push(i)
	const sims = selected.map((i) => {
		let s = 0
		for (let d = 0; d < dim; d++)
			s += fingerprints[i * dim + d] * fingerprint[d]
		return s
	})
	const zs = z(Float32Array.from(sims))
	const order = selected.map((_, k) => k).sort((a, b) => zs[b] - zs[a])
	const out = new Map<number, number>()
	let taken = 0
	for (const k of order) {
		if (mine.has(members[selected[k]])) continue
		for (const id of titles[selected[k]].slice(0, PEER_TITLES))
			out.set(id, Math.max(out.get(id) ?? 0, Math.max(zs[k], 0)))
		if (++taken >= PEER_COUNT) break
	}
	return out
}

// --- After the blend -----------------------------------------------------------------------------------------------

/** Keeps the first title of every set of alternate cuts, in rank order. */
export function foldCuts<T extends { id: number }>(
	index: SearchIndex,
	ranked: T[],
): T[] {
	const kept = new Set<number>()
	return ranked.filter(({ id }) => {
		for (const other of index.alternateCuts.get(id) ?? [])
			if (kept.has(other)) return false
		kept.add(id)
		return true
	})
}

/**
 * The top n holds the intent's bounds of own titles. A title reference's own titles stay out of the first rank, and
 * out of the top n when the query modifies the title ("like X but Y"). Extra own titles move below n; missing ones
 * (from the rest of the list) are pulled up into every second rank.
 */
export function boundOwn<T extends { id: number }>(
	ranked: T[],
	ref: Reference,
	n = 10,
): T[] {
	const bounds = OWN_BOUNDS[ref.intent]
	if (!bounds) return ranked
	let [lo, hi] = bounds
	if (ref.kind === "title" && ref.text) hi = 0
	const first = ref.kind === "title" ? LIKE_FIRST : 0
	const isOwn = ranked.map((x) => ref.own.has(x.id))
	const ownAt = isOwn.flatMap((o, i) => (o ? [i] : []))
	const otherAt = isOwn.flatMap((o, i) => (o ? [] : [i]))
	const k = Math.min(
		Math.max(ownAt.filter((i) => i < n).length, lo),
		hi,
		ownAt.length,
	)
	const keepOwn = ownAt.slice(0, k)
	let base = [...keepOwn.filter((i) => i < n), ...otherAt.slice(0, n - k)].sort(
		(a, b) => a - b,
	)
	const head = base.filter((i) => !isOwn[i]).slice(0, first)
	base = [...head, ...base.filter((i) => !head.includes(i))]
	for (const i of keepOwn.filter((i) => i >= n)) {
		let slot = base.length
		for (let s = first; s < n; s += 2) {
			if (s <= base.length && !(s < base.length && isOwn[base[s]])) {
				slot = s
				break
			}
		}
		base.splice(slot, 0, i)
	}
	const top = base.slice(0, n)
	const inTop = new Set(top)
	return [
		...top.map((i) => ranked[i]),
		...ranked.filter((_, i) => !inTop.has(i)),
	]
}
