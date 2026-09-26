// The search ranking after the Jev reading: one entry point, rankSearch().
//
// Per search:
// 1. Read the query: language, a person, studio or "like X" reference, negated clauses, a decade or year.
// 2. Encode the texts with the two local query models, one request. At the same time, fetch the reference's stored
//    profile (one person, team or studio) or its seed titles' vectors (a "like X" title, several people).
// 3. Qdrant round 1: every top list at once (fingerprint, dense, BM25F, facets, coverage units, profile).
//    Non-English queries with English chips then rescore the union of both dense top lists with both vectors.
// 4. Qdrant round 2: score the candidate pool with every signal.
// 5. Score in memory, blend with the title lookup, fold alternate cuts, bound the reference's own titles.
//
// Nothing here runs while SEARCH_RANKING_MODE is off: the index, the encoder and the Qdrant client all refuse.
import type {
	Eligibility,
	ReadingFields,
} from "../combined-search/reading-retrieval.server.ts"
import {
	queryBatch,
	type QdrantQuery,
	type ScoredPoint,
} from "./qdrant-http.server.ts"
import { encodeQueryTexts } from "./query-encoder.server.ts"
import {
	englishFromChips,
	eraRange,
	facetUnits,
	facets,
	labelNegation,
	looksForeign,
	spell,
	splitNegation,
} from "./query-parsing.server.ts"
import {
	COVERAGE_BM25,
	COVERAGE_MAX_TOKENS,
	MAIN_DEPTH,
	NON_ENGLISH_MIX,
	NON_ENGLISH_UNION_DEPTH,
	PART_DEPTH,
	PROFILE_WEAK,
	RANKER_VERSION,
	RESULT_LENGTH,
	WEIGHTS,
	boundOwn,
	centroid,
	filled,
	foldCuts,
	idf,
	meanSd,
	peerScores,
	profileTerms,
	topIds,
	z,
} from "./ranking.server.ts"
import {
	type Intent,
	type Reference,
	nearestIntent,
	resolveReference,
} from "./references.server.ts"
import { searchFilter } from "./search-filter.server.ts"
import {
	type QuantizedVectors,
	type SearchIndex,
	getSearchIndex,
} from "./search-index.server.ts"
import {
	type BlendedTitle,
	type TitleFacts,
	type TitleLookupRow,
	blend,
} from "./title-blend.server.ts"
import { queryTerms, tokens } from "./text-rules.server.ts"

const COLLECTION = "media_fingerprint_v1"
const PROFILES = "search_reference_profiles"
const VECTOR = {
	fingerprint: "fingerprint_v1",
	fingerprintRaw: "fingerprint_v1_raw",
	english: "text_en_v1",
	multilingual: "text_multi_v1",
	terms: "terms_bm25f_v1",
} as const
type Model = "english" | "multilingual"

export interface SearchRequest {
	/** What the person typed. */
	query: string
	/** The text the Jev reading used (the query, unless it was translated). */
	text: string
	/** The language step routed the query away from English. */
	nonEnglish: boolean
	/** The allowed title lookup matches (movies and shows), in lookup order. */
	titleLookup: TitleLookupRow[]
	/** Also return the intermediate values (texts, candidate scores, profile terms), for parity checks. */
	trace?: boolean
}

/** The intermediate values of one search, returned when the request asks for a trace. */
export interface SearchTrace {
	/** The texts encoded per model. */
	texts: Record<"english" | "multilingual", string[]>
	/** Every candidate of the pool with its score before the blend. */
	candidates: [number, number][]
	/** Each signal's weighted contribution per candidate, aligned with candidates. */
	signals: Record<string, number[]>
	/** The top RESULT_LENGTH candidates before the blend, highest first. */
	discovery: [number, number][]
	/** The reference profile's terms with their query weights. */
	profileTerms: [string, number][] | null
	/** Seed titles, own titles and the era of the reference. */
	seeds: number[] | null
	own: number[] | null
	/** Round 2: the candidates each pool query returned. The rescore: the points it returned of the union it asked for. */
	scored: { using: string; asked: number; returned: number }[]
	/** Titles the filter keeps (title table rows), and the era applied. */
	filtered: number
	era: { from: number; to: number } | null
}

export interface RankedSearch {
	rankerVersion: string
	buildId: string
	results: BlendedTitle[]
	/** general, non_english or reference. */
	route: "general" | "non_english" | "reference"
	reference: {
		kind: string
		intent: Intent
		names: string[]
		residual: string
	} | null
	/** Milliseconds per stage. */
	timings: Record<string, number>
	/** Qdrant requests: queries and Qdrant's own time per round. */
	rounds: { name: string; queries: number; serverMs: number; wallMs: number }[]
	poolSize: number
	trace?: SearchTrace
}

// --- Signals -------------------------------------------------------------------------------------------------------

/** A dense query: a vector, or a stored profile point read with lookup_from. */
type DenseQuery =
	| { using: string; vector: number[] }
	| { using: string; profile: string }

const denseQuery = (q: DenseQuery) =>
	"vector" in q
		? { query: q.vector, using: q.using }
		: {
				query: q.profile,
				using: q.using,
				lookup_from: { collection: PROFILES, vector: q.using },
			}

const sparseQuery = (weights: Map<number, number>) => {
	const entries = [...weights].sort((a, b) => a[0] - b[0])
	return {
		query: {
			indices: entries.map(([i]) => i),
			values: entries.map(([, v]) => v),
		},
		using: VECTOR.terms,
	}
}

/** BM25F query weights of a text: IDF per distinct query term, at the term's terms_bm25f_v1 index. */
function bm25Weights(index: SearchIndex, text: string): Map<number, number> {
	const out = new Map<number, number>()
	const { indexOf, ids } = index.termStatistics
	for (const term of queryTerms(text)) {
		const t = indexOf.get(term)
		if (t !== undefined) out.set(ids[t], idf(index, t))
	}
	return out
}

/** Cosine of int8 vectors with a query: values[row] . (query x scale). */
function quantizedCosines(
	q: QuantizedVectors,
	query: Float32Array,
	rows: Uint8Array,
): number[] {
	const { dim, scale, values } = q
	const scaled = new Float32Array(dim)
	for (let d = 0; d < dim; d++) scaled[d] = query[d] * scale[d]
	const out: number[] = []
	for (let row = 0; row < rows.length; row++) {
		if (!rows[row]) continue
		let s = 0
		const base = row * dim
		for (let d = 0; d < dim; d++) s += values[base + d] * scaled[d]
		out.push(s)
	}
	return out
}

const toMap = (points: ScoredPoint[]) =>
	new Map(points.map((p) => [Number(p.id), p.score]))

// The payload fields that stand in for a title table row, for titles below the eligibility line.
const FACT_FIELDS = [
	"title",
	"original_title",
	"release_year",
	"goodwatch_overall_score_voting_count",
	"goodwatch_overall_score_normalized_percent",
]

/** A lesser-known title's facts from its payload, in the title table's conventions. */
function payloadFacts(payload: Record<string, unknown>): TitleFacts {
	const title = typeof payload.title === "string" ? payload.title : ""
	const original =
		typeof payload.original_title === "string" ? payload.original_title : ""
	const score = payload.goodwatch_overall_score_normalized_percent
	return {
		title: title || original,
		originalTitle: original,
		year: Number(payload.release_year) || 0,
		votes: Number(payload.goodwatch_overall_score_voting_count) || 0,
		goodwatchScore: typeof score === "number" ? score : Number.NaN,
	}
}

// --- The entry point -------------------------------------------------------------------------------------------------

/** Ranks a search from its Jev reading: the ranked list plus per-stage timings. */
export async function rankSearch(
	reading: ReadingFields,
	request: SearchRequest,
	eligibility: Eligibility,
): Promise<RankedSearch> {
	const started = performance.now()
	const timings: Record<string, number> = {}
	const rounds: RankedSearch["rounds"] = []
	let mark = started
	const lap = (name: string) => {
		const now = performance.now()
		timings[name] = (timings[name] ?? 0) + (now - mark)
		mark = now
	}

	const index = await getSearchIndex()
	lap("index")
	const t = index.titleTable
	const { query, text } = request
	const nonEnglish = request.nonEnglish || looksForeign(text)
	const embMain: Model = nonEnglish ? "multilingual" : "english"

	// 1. Read the query
	const found = resolveReference(index, query, text, nonEnglish)
	const det = found?.detection ?? null
	const { base: baseFilter, withEra: filter } = searchFilter(
		t,
		reading.flags,
		eligibility,
		eraRange(text),
	)
	let { positive, negated } = splitNegation(
		nonEnglish ? text : spell(index, text),
	)
	let denseText = positive
	if (found) {
		positive = found.text
		negated = found.negated
		denseText = found.kind === "title" ? denseText : positive
	}
	// A non-English entity query uses the intent vector as its dense query, with no second encode
	const denseFromIntent = found?.kind === "entity" && embMain === "multilingual"
	const phrases = reading.searchedPhrases.map((p) => p.phrase)
	const concrete = new Set(
		reading.concreteWords
			.filter((w) => w.isConcrete)
			.map((w) => w.word.toLowerCase()),
	)
	const facetTexts = positive
		? facets(phrases, negated, found?.words ?? new Set())
		: []
	let units: string[] = []
	if (!found && tokens(positive).length <= COVERAGE_MAX_TOKENS) {
		units = facetUnits(index, phrases, negated)
		if (!units.some((u) => u.split(" ").some((w) => concrete.has(w))))
			units = []
	}
	const hasDense =
		Boolean(denseText) && (!denseFromIntent || det?.intentText != null)
	const chips = nonEnglish && hasDense ? englishFromChips(reading.chips) : null
	const mixed = Boolean(chips?.positive)

	// The texts per model, each encoded once
	const texts: Record<Model, string[]> = { english: [], multilingual: [] }
	const slot = (model: Model, s: string) => {
		const i = texts[model].indexOf(s)
		if (i >= 0) return i
		texts[model].push(s)
		return texts[model].length - 1
	}
	const intentSlot =
		det?.intentText != null ? slot("multilingual", det.intentText) : -1
	const denseSlot = hasDense && !denseFromIntent ? slot(embMain, denseText) : -1
	const chipSlot = mixed && chips ? slot("english", chips.positive) : -1
	const avoidedSlots =
		mixed && chips ? chips.avoided.map((s) => slot("english", s)) : []
	const facetSlots = facetTexts.map((s) => slot(embMain, s))
	const unitSlots = units.map((s) => slot(embMain, s))
	const negatedSlots = negated.map((s) => slot(embMain, s))
	lap("parse")

	// 2. Encode, and fetch the reference's profile or seed vectors meanwhile
	const single =
		found?.kind === "entity" && det?.entities.length === 1
			? det.entities[0].entity
			: null
	const seedIds =
		found && !single ? found.seeds.map((row) => t.pointIds[row]) : []
	const encoding =
		texts.english.length || texts.multilingual.length
			? encodeQueryTexts(texts).then((v) => {
					timings.encode = v.timings.totalMs
					return v
				})
			: Promise.resolve({
					english: [] as Float32Array[],
					multilingual: [] as Float32Array[],
				})
	const prefetch = (async () => {
		const t0 = performance.now()
		let points: ScoredPoint[] = []
		if (single) {
			const r = await queryBatch(PROFILES, [
				{
					filter: { must: [{ has_id: [single.id] }] },
					limit: 1,
					with_payload: ["terms"],
					with_vector: [VECTOR.fingerprint],
				},
			])
			rounds.push({
				name: "profile",
				queries: 1,
				serverMs: r.serverMs,
				wallMs: r.wallMs,
			})
			points = r.results[0]
		} else if (seedIds.length) {
			const r = await queryBatch(COLLECTION, [
				{
					filter: { must: [{ has_id: seedIds }] },
					limit: seedIds.length,
					with_payload: false,
					with_vector: [VECTOR.fingerprint, VECTOR.english, VECTOR.terms],
				},
			])
			rounds.push({
				name: "seeds",
				queries: 1,
				serverMs: r.serverMs,
				wallMs: r.wallMs,
			})
			points = r.results[0]
		}
		timings.prefetch = performance.now() - t0
		return points
	})()
	const [vectors, fetched] = await Promise.all([encoding, prefetch])
	lap("encodeAndPrefetch")
	const vec = (model: Model, i: number) => Array.from(vectors[model][i])

	let ref: Reference | null = null
	if (found) {
		let intent = found.intent
		if (!intent) intent = nearestIntent(index, vectors.multilingual[intentSlot])
		ref = { ...found, intent }
	}

	// The reference profile: stored for one entity, computed from the seeds otherwise
	let fpCentroid: ArrayLike<number> | null = null
	let profileFp: DenseQuery | null = null
	let profileText: DenseQuery | null = null
	let profileWeights = new Map<number, number>()
	if (ref && single) {
		const point = fetched[0]
		if (point) {
			fpCentroid = (point.vector as Record<string, number[]>)[
				VECTOR.fingerprint
			]
			profileFp = { using: VECTOR.fingerprint, profile: single.id }
			profileText = { using: VECTOR.english, profile: single.id }
			const { indexOf, ids } = index.termStatistics
			for (const { term, weight } of (point.payload?.terms ?? []) as {
				term: string
				weight: number
			}[]) {
				const i = indexOf.get(term)
				if (i !== undefined) profileWeights.set(ids[i], weight)
			}
		}
	} else if (ref && fetched.length) {
		const byId = new Map(
			fetched.map((p) => [Number(p.id), p.vector as Record<string, unknown>]),
		)
		const seeds = seedIds.filter((id) => byId.has(id))
		const votes = seeds.map((id) => t.votes[t.rowOf.get(id) as number])
		const of = (name: string) =>
			seeds.map((id) => byId.get(id)?.[name] as number[])
		const fp = centroid(of(VECTOR.fingerprint), votes)
		fpCentroid = fp
		profileFp = { using: VECTOR.fingerprint, vector: Array.from(fp) }
		profileText = {
			using: VECTOR.english,
			vector: Array.from(centroid(of(VECTOR.english), votes)),
		}
		const terms = profileTerms(
			index,
			seeds.map(
				(id) =>
					(
						(byId.get(id)?.[VECTOR.terms] as { indices: number[] }) ?? {
							indices: [],
						}
					).indices,
			),
		)
		profileWeights = new Map(
			terms.map(({ term, weight }) => [index.termStatistics.ids[term], weight]),
		)
	}
	const mentionWeights =
		ref && det
			? bm25Weights(
					index,
					det.entities.flatMap((e) => e.entity.mention).join(" "),
				)
			: new Map()
	const peers =
		ref && det && fpCentroid
			? peerScores(
					index,
					det.entities.map((e) => e.entity),
					fpCentroid,
				)
			: null
	lap("profile")

	// 3. Round 1: the top lists
	const F = filter.qdrant
	const round1: QdrantQuery[] = []
	const decode: ((points: ScoredPoint[]) => void)[] = []
	const pool = new Set<number>()
	const add = (q: QdrantQuery, onResult: (points: ScoredPoint[]) => void) => {
		round1.push({ ...q, filter: F, with_payload: false })
		decode.push(onResult)
	}
	const joinAll = (points: ScoredPoint[]) => {
		for (const p of points) pool.add(Number(p.id))
	}
	const joinPositive = (points: ScoredPoint[]) => {
		for (const p of points) if (p.score > 0) pool.add(Number(p.id))
	}
	const hits = (target: Map<number, number>) => (points: ScoredPoint[]) => {
		for (const p of points)
			if (p.score > 0) {
				pool.add(Number(p.id))
				target.set(Number(p.id), p.score)
			}
	}
	add(
		{
			query: reading.vector,
			using: VECTOR.fingerprintRaw,
			limit: MAIN_DEPTH,
			params: { exact: true },
		},
		joinAll,
	)
	// The dense query
	let dense: DenseQuery | null = null
	const denseVector = denseFromIntent
		? hasDense
			? vec("multilingual", intentSlot)
			: null
		: denseSlot >= 0
			? vec(embMain, denseSlot)
			: null
	if (denseVector) dense = { using: VECTOR[embMain], vector: denseVector }
	const chipQuery: DenseQuery | null =
		chipSlot >= 0
			? { using: VECTOR.english, vector: vec("english", chipSlot) }
			: null
	const unionIds = new Set<number>()
	if (dense && chipQuery) {
		add({ ...denseQuery(dense), limit: NON_ENGLISH_UNION_DEPTH }, (points) => {
			for (const p of points) unionIds.add(Number(p.id))
		})
		add(
			{ ...denseQuery(chipQuery), limit: NON_ENGLISH_UNION_DEPTH },
			(points) => {
				for (const p of points) unionIds.add(Number(p.id))
			},
		)
	} else if (dense) add({ ...denseQuery(dense), limit: MAIN_DEPTH }, joinAll)
	// BM25F of the query (English)
	const bm25 = new Map<number, number>()
	if (!nonEnglish && positive) {
		const weights = bm25Weights(index, positive)
		if (weights.size)
			add({ ...sparseQuery(weights), limit: PART_DEPTH }, hits(bm25))
	}
	const facetQueries = facetSlots.map((i) => ({
		using: VECTOR[embMain],
		vector: vec(embMain, i),
	}))
	for (const q of facetQueries)
		add({ ...denseQuery(q), limit: PART_DEPTH }, joinAll)
	const unitQueries = unitSlots.map((i) => ({
		using: VECTOR[embMain],
		vector: vec(embMain, i),
	}))
	const unitBm25 = units.map(() => new Map<number, number>())
	units.forEach((u, k) => {
		add({ ...denseQuery(unitQueries[k]), limit: PART_DEPTH }, joinAll)
		const weights = bm25Weights(index, u)
		if (weights.size)
			add({ ...sparseQuery(weights), limit: PART_DEPTH }, hits(unitBm25[k]))
	})
	if (ref) {
		for (const row of ref.weights.keys())
			if (filter.rows[row]) pool.add(t.pointIds[row])
		if (profileFp)
			add({ ...denseQuery(profileFp), limit: MAIN_DEPTH }, joinPositive)
		if (profileText)
			add({ ...denseQuery(profileText), limit: MAIN_DEPTH }, joinPositive)
		if (profileWeights.size)
			add({ ...sparseQuery(profileWeights), limit: PART_DEPTH }, joinPositive)
		if (mentionWeights.size)
			add({ ...sparseQuery(mentionWeights), limit: PART_DEPTH }, joinPositive)
		for (const [id, score] of peers ?? []) {
			const row = t.rowOf.get(id)
			if (score > 0 && row !== undefined && filter.rows[row]) pool.add(id)
		}
	}
	lap("plan")
	const r1 = await queryBatch(COLLECTION, round1)
	rounds.push({
		name: "top lists",
		queries: round1.length,
		serverMs: r1.serverMs,
		wallMs: r1.wallMs,
	})
	r1.results.forEach((points, i) => decode[i](points))
	lap("round1")

	// Non-English with English chips: the dense signal mixes z(multilingual cosine) and z(English chips cosine), each
	// z-scored over every filtered title (from the int8 mix vectors); the union of both top lists is rescored.
	const scored: SearchTrace["scored"] = []
	let mixStats: [number, number, number, number] | null = null
	if (dense && chipQuery && "vector" in dense && "vector" in chipQuery) {
		const union = [...unionIds]
		const r = await queryBatch(
			COLLECTION,
			[dense, chipQuery].map((q) => ({
				...denseQuery(q),
				params: { exact: true },
				filter: { must: [{ has_id: union }] },
				limit: union.length,
				with_payload: false,
			})),
		)
		if (request.trace)
			for (const [k, q] of [dense, chipQuery].entries())
				scored.push({
					using: `rescore ${q.using}`,
					asked: union.length,
					returned: r.results[k].length,
				})
		rounds.push({
			name: "rescore",
			queries: 2,
			serverMs: r.serverMs,
			wallMs: r.wallMs,
		})
		lap("rescore")
		const [m1, s1] = meanSd(
			quantizedCosines(
				index.mixVectors.multilingual,
				Float32Array.from(dense.vector),
				filter.rows,
			),
		)
		const [m2, s2] = meanSd(
			quantizedCosines(
				index.mixVectors.english,
				Float32Array.from(chipQuery.vector),
				filter.rows,
			),
		)
		mixStats = [m1, s1, m2, s2]
		const a = toMap(r.results[0])
		const b = toMap(r.results[1])
		const mixedScores = union.map(
			(id) =>
				(1 - NON_ENGLISH_MIX) * (((a.get(id) ?? 0) - m1) / s1) +
				NON_ENGLISH_MIX * (((b.get(id) ?? 0) - m2) / s2),
		)
		for (const id of topIds(union, mixedScores, MAIN_DEPTH)) pool.add(id)
		lap("mixStatistics")
	}

	// 4. Round 2: every signal over the pool
	const poolIds = [...pool].sort((x, y) => x - y)
	const poolFilter = {
		must: [{ has_id: poolIds }, ...F.must],
		must_not: F.must_not,
	}
	const round2: QdrantQuery[] = []
	// Every pool title needs its score, so the dense queries search exactly: without `exact`, a query for a known set
	// of ids can return only part of them (in "zombie movie without gore", 789 of 1,110).
	const score = (q: Record<string, unknown>) => {
		round2.push({
			...q,
			...("lookup_from" in q || Array.isArray(q.query)
				? { params: { exact: true } }
				: {}),
			filter: poolFilter,
			limit: poolIds.length,
			with_payload: false,
		})
		return round2.length - 1
	}
	const fpAt = score({
		query: reading.vector,
		using: VECTOR.fingerprintRaw,
		params: { exact: true },
	})
	const denseAt = dense ? score(denseQuery(dense)) : -1
	const chipAt = chipQuery ? score(denseQuery(chipQuery)) : -1
	const avoidedAt = avoidedSlots.map((i) =>
		score(denseQuery({ using: VECTOR.english, vector: vec("english", i) })),
	)
	const facetAt = facetQueries.map((q) => score(denseQuery(q)))
	const unitAt = unitQueries.map((q) => score(denseQuery(q)))
	const negatedAt = negatedSlots.map((i) =>
		score(denseQuery({ using: VECTOR[embMain], vector: vec(embMain, i) })),
	)
	const profileFpAt = profileFp ? score(denseQuery(profileFp)) : -1
	const profileTextAt = profileText ? score(denseQuery(profileText)) : -1
	const termsAt = profileWeights.size ? score(sparseQuery(profileWeights)) : -1
	const mentionAt = mentionWeights.size
		? score(sparseQuery(mentionWeights))
		: -1
	// A lesser-known search's pool holds titles the title table doesn't: read their facts in the same request.
	const outside = eligibility.lesserKnown
		? poolIds.filter((id) => !t.rowOf.has(id))
		: []
	let factsAt = -1
	if (outside.length) {
		round2.push({
			filter: { must: [{ has_id: outside }] },
			limit: outside.length,
			with_payload: FACT_FIELDS,
		})
		factsAt = round2.length - 1
	}
	lap("plan")
	const r2 = await queryBatch(COLLECTION, round2)
	rounds.push({
		name: "pool scores",
		queries: round2.length,
		serverMs: r2.serverMs,
		wallMs: r2.wallMs,
	})
	lap("round2")

	// 5. Score. The candidates are the pool titles that pass the filter.
	const fpScores = toMap(r2.results[fpAt])
	const outsideFacts = new Map<number, TitleFacts>(
		factsAt >= 0
			? r2.results[factsAt].map((p) => [
					Number(p.id),
					payloadFacts(p.payload ?? {}),
				])
			: [],
	)
	const cand = poolIds.filter(
		(id) => fpScores.has(id) && (t.rowOf.has(id) || outsideFacts.has(id)),
	)
	if (request.trace)
		round2.forEach((q, k) => {
			if (k === factsAt) return
			const got = new Set(r2.results[k].map((p) => Number(p.id)))
			scored.push({
				using: String(q.using),
				asked: cand.length,
				returned: cand.filter((id) => got.has(id)).length,
			})
		})
	// Title table rows, -1 for a lesser-known title outside it
	const rows = cand.map((id) => t.rowOf.get(id) ?? -1)
	const fact = <K extends keyof TitleFacts>(
		key: K,
		fromTable: (row: number) => TitleFacts[K],
	) =>
		cand.map((id, i) =>
			rows[i] >= 0
				? fromTable(rows[i])
				: (outsideFacts.get(id) as TitleFacts)[key],
		)
	const votes = fact("votes", (row) => t.votes[row])
	const column = (at: number) => {
		const m = toMap(r2.results[at])
		return cand.map((id) => m.get(id) ?? 0)
	}
	const fromMap = (m: Map<number, number>) => cand.map((id) => m.get(id) ?? 0)
	const n = cand.length
	const total = new Float64Array(n)
	const signals: Record<string, number[]> = {}
	const addTo = (
		weight: number,
		values: ArrayLike<number>,
		name = "signal",
	) => {
		for (let i = 0; i < n; i++) total[i] += weight * values[i]
		if (request.trace) {
			let key = name
			for (let k = 2; key in signals; k++) key = `${name}${k}`
			signals[key] = Array.from(values, (v) => weight * v)
		}
	}
	addTo(
		WEIGHTS.fingerprint,
		z(cand.map((id) => fpScores.get(id) ?? 0)),
		"fingerprint",
	)
	if (denseAt >= 0) {
		let values = column(denseAt)
		if (chipAt >= 0 && mixStats) {
			const [m1, s1, m2, s2] = mixStats
			const english = column(chipAt)
			values = values.map(
				(x, i) =>
					(1 - NON_ENGLISH_MIX) * ((x - m1) / s1) +
					NON_ENGLISH_MIX * ((english[i] - m2) / s2),
			)
		}
		addTo(WEIGHTS.dense, z(values), "dense")
	}
	if (bm25.size) {
		const values = fromMap(bm25)
		if (values.some((v) => v !== 0)) addTo(WEIGHTS.bm25, z(values), "bm25")
	}
	if (facetAt.length) {
		const zs = facetAt.map((at) => z(column(at)))
		addTo(
			WEIGHTS.facet,
			cand.map((_, i) => zs.reduce((s, x) => s + x[i], 0) / zs.length),
			"facets",
		)
	}
	if (units.length) {
		const perUnit = units.map((_, k) => {
			const d = z(column(unitAt[k]))
			const s = z(fromMap(unitBm25[k]))
			return d.map((x, i) => x + COVERAGE_BM25 * s[i])
		})
		addTo(
			WEIGHTS.coverage,
			z(cand.map((_, i) => Math.min(...perUnit.map((u) => u[i])))),
			"coverage",
		)
	}
	const penalties = [...negatedAt, ...avoidedAt].map((at) => column(at))
	if (penalties.length)
		addTo(
			-WEIGHTS.negation,
			z(cand.map((_, i) => Math.max(...penalties.map((p) => p[i])))),
			"negation",
		)
	if (negated.length) {
		const shares = negated.map((phrase) =>
			labelNegation(index, phrase, nonEnglish),
		)
		addTo(
			-WEIGHTS.negationLabels,
			cand.map((id) => Math.max(...shares.map((s) => s.get(id) ?? 0))),
			"negationLabels",
		)
	}
	const logVotes = votes.map((v) => Math.log1p(v))
	addTo(
		WEIGHTS.goodwatchScore,
		z(filled(fact("goodwatchScore", (row) => t.goodwatchScores[row]))),
		"goodwatchScore",
	)
	if (!ref) addTo(WEIGHTS.votes, z(logVotes), "votes")
	else {
		const credit = rows.map((row) => ref.weights.get(row) ?? 0)
		const strength =
			ref.intent === "like" || ref.intent === "filmography" ? PROFILE_WEAK : 1
		const agreeing: Float64Array[] = []
		if (profileFpAt >= 0) {
			const zc = z(column(profileFpAt))
			addTo(strength * WEIGHTS.profileFingerprint, zc, "profileFingerprint")
			agreeing.push(zc)
		}
		if (profileTextAt >= 0) {
			const zc = z(column(profileTextAt))
			addTo(strength * WEIGHTS.profileText, zc, "profileText")
			agreeing.push(zc)
		}
		// The prototype's term profile is scored even when empty (all zeros)
		const termsZ = termsAt >= 0 ? z(column(termsAt)) : new Float64Array(n)
		addTo(strength * WEIGHTS.profileTerms, termsZ, "profileTerms")
		agreeing.push(termsZ)
		if (det) {
			const mentions = mentionAt >= 0 ? column(mentionAt) : new Array(n).fill(0)
			addTo(
				strength * WEIGHTS.mentions,
				z(mentions.map((x) => Math.log1p(x))),
				"mentions",
			)
			if (peers) addTo(strength * WEIGHTS.peers, fromMap(peers), "peers")
		}
		if (agreeing.length)
			addTo(
				strength * WEIGHTS.agreement,
				cand.map((_, i) => Math.min(...agreeing.map((a) => a[i]))),
				"agreement",
			)
		addTo(
			ref.intent === "filmography"
				? WEIGHTS.ownTitlesFilmography
				: WEIGHTS.ownTitles,
			credit,
			"ownTitles",
		)
		if (ref.intent === "style" || ref.intent === "both") {
			const zv = z(logVotes)
			addTo(
				-WEIGHTS.popularityDamping,
				zv.map((x, i) => (credit[i] >= 1 ? 0 : x)),
				"popularityDamping",
			)
		} else addTo(WEIGHTS.votes, z(logVotes), "votes")
		if (ref.era) {
			const zy = z(filled(fact("year", (row) => t.years[row])))
			addTo(WEIGHTS.career * (ref.era === "late" ? 1 : -1), zy, "career")
		}
	}
	const ranked = topIds(cand, total, RESULT_LENGTH)
	lap("score")
	let trace: SearchTrace | undefined
	if (request.trace) {
		const scoreOf = new Map(cand.map((id, i) => [id, total[i]]))
		// Only the profile's terms: a map of every term would cost tens of milliseconds per search
		const termOf = new Map<number, string>()
		if (ref && profileWeights.size)
			index.termStatistics.ids.forEach((id, i) => {
				if (profileWeights.has(id)) termOf.set(id, index.termStatistics.terms[i])
			})
		trace = {
			texts,
			signals,
			candidates: cand.map((id, i) => [id, total[i]]),
			discovery: ranked.map((id) => [id, scoreOf.get(id) as number]),
			profileTerms: ref
				? [...profileWeights].map(([id, w]) => [
						termOf.get(id) ?? String(id),
						w,
					])
				: null,
			seeds: ref ? ref.seeds.map((row) => t.pointIds[row]) : null,
			own: ref ? [...ref.own].sort((a, b) => a - b) : null,
			scored,
			filtered: filter.rows.reduce((a, b) => a + b, 0),
			era: filter.era,
		}
		lap("trace")
	}

	// Blend with the title lookup, fold alternate cuts, bound the own titles
	let results = foldCuts(
		index,
		blend(
			index,
			query,
			request.titleLookup,
			ranked,
			concrete,
			baseFilter.rows,
			outsideFacts,
		),
	)
	if (ref) results = boundOwn(results, ref)
	results = results.slice(0, RESULT_LENGTH)
	lap("blend")
	// The trace is for checks and shadow logs, not part of the ranking: keep it out of the total
	timings.total = performance.now() - started - (timings.trace ?? 0)

	return {
		rankerVersion: RANKER_VERSION,
		buildId: index.buildId,
		results,
		route: ref ? "reference" : nonEnglish ? "non_english" : "general",
		reference: ref
			? {
					kind: ref.kind,
					intent: ref.intent,
					names: det
						? det.entities.map((e) => e.entity.name)
						: [t.titles[ref.seeds[0]]],
					residual: ref.text,
				}
			: null,
		timings,
		rounds,
		poolSize: cand.length,
		trace,
	}
}
