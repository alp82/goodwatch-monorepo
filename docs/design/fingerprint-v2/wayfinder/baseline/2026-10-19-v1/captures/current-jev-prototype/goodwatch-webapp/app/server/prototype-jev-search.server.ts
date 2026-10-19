// PROTOTYPE - throwaway. Evaluates Jev (TypeSafe System One) for free-text discovery:
// request -> fingerprint dimension weights and attributes -> candidates (Qdrant vector search
// plus trope full-text search) -> per-title fit, judged once per token-cut variant.
// No caching, no error handling beyond what keeps the page running. Don't ship.

import { readFileSync } from "node:fs"
import { QdrantClient } from "@qdrant/js-client-rest"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { query } from "~/utils/crate"
import { MEDIA_COLLECTION, parsePointId } from "~/utils/qdrant"
import { VALID_FINGERPRINT_KEYS } from "./utils/fingerprint"

const MODEL = "jev-latest"
const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000
const KEY_FALLBACK_FILE =
	"/home/alp/dev/projects/goodwatch/goodwatch-jev-fingerprint/docs/benchmarks/fingerprint/jev/private/experiment.env"

const FINGERPRINT_POOL = 20
const TROPE_POOL = 20
const TROPES_PER_TITLE = 6
const MAX_DIMENSIONS = 8
const MIN_VOTES = 2000
const CONCURRENCY = 16
const BATCH_SIZE = 8
// Wanted-level ladder is 0..4 with 2 = "no preference"
const NEUTRAL = 2
const MIN_DEVIATION = 0.6
const FLAG_THRESHOLD = 0.6

const LADDERS = {
	full: {
		wanted: [
			"The request explicitly asks to avoid this quality or says there should be none of it",
			"The request asks for only a little of this quality, or implies it should stay low",
			"The request says nothing about this quality, neither directly nor by clear implication",
			"The request asks for this quality, directly or by clear implication",
			"This quality is central to the request: it is one of the main things the person is asking for",
		],
		fit: [
			"The evidence contradicts the request: the title is clearly the opposite of what is asked for",
			"Poor fit: the evidence shows little of what the request asks for",
			"Partial fit: some requested aspects are supported, others are missing or unclear",
			"Good fit: the evidence supports most of what the request asks for",
			"Excellent fit: the evidence directly and specifically supports everything the request asks for",
		],
		flag: {
			required: "The request asks for this attribute, directly or by clear implication",
			excluded: "The request rules this attribute out, directly or by clear implication",
			not_mentioned: "The request says nothing that settles this attribute",
		},
	},
	short: {
		wanted: ["Must be avoided", "Wanted only a little", "Not mentioned", "Wanted", "Central to the request"],
		fit: ["Opposite of the request", "Poor fit", "Partial fit", "Good fit", "Excellent fit"],
		flag: { required: "Asked for", excluded: "Ruled out", not_mentioned: "Not mentioned" },
	},
}
export type LadderStyle = keyof typeof LADDERS

// Token-cut variants of the fit judgment. Every variant judges the same candidates.
export interface FitVariant {
	id: string
	label: string
	description: string
	tropes: "none" | "passages" | "names"
	tropeQuestions: boolean
	leanState: boolean
	ladder: LadderStyle
	batch: number
}
const variant = (v: Partial<FitVariant> & Pick<FitVariant, "id" | "label" | "description">): FitVariant => ({
	tropes: "passages",
	tropeQuestions: true,
	leanState: false,
	ladder: "full",
	batch: 1,
	...v,
})
export const FIT_VARIANTS: FitVariant[] = [
	variant({
		id: "no_tropes",
		label: "No tropes",
		description: "Full title state, no trope evidence.",
		tropes: "none",
		tropeQuestions: false,
	}),
	variant({
		id: "baseline",
		label: "Baseline with tropes",
		description: "Full title state, trope passages, one question per trope. Rank changes are relative to this column.",
	}),
	variant({
		id: "no_trope_questions",
		label: "No per-trope questions",
		description: "Baseline without the per-trope support questions. Only the fit question remains.",
		tropeQuestions: false,
	}),
	variant({
		id: "lean_state",
		label: "Lean title state",
		description: "Synopsis cut to 200 characters, no tags, no list of absent traits.",
		leanState: true,
	}),
	variant({
		id: "short_ladder",
		label: "Short fit levels",
		description: "Fit levels are two or three words each.",
		ladder: "short",
	}),
	variant({
		id: "trope_names",
		label: "Trope names only",
		description: "Sends the matching trope names without their passages.",
		tropes: "names",
		tropeQuestions: false,
	}),
	variant({
		id: "batched",
		label: `Batched, ${BATCH_SIZE} titles per request`,
		description: "Baseline state, but one request judges several titles, so the levels and request are sent once.",
		tropeQuestions: false,
		batch: BATCH_SIZE,
	}),
	variant({
		id: "all_cuts",
		label: "All cuts combined",
		description: "Lean state, short levels, no per-trope questions, batched.",
		tropeQuestions: false,
		leanState: true,
		ladder: "short",
		batch: BATCH_SIZE,
	}),
]

// Boolean and enum title attributes. `sql` is the clause that holds when the attribute is true.
interface Flag {
	id: string
	label: string
	description: string
	sql?: string
	qdrant?: { key: string; value: string | boolean }
	table?: "movie" | "show"
}
const flag = (
	id: string,
	label: string,
	description: string,
	custom?: { sql: string; qdrant: { key: string; value: string } },
): Flag => ({
	id,
	label,
	description,
	sql: custom?.sql ?? `${id} = true`,
	qdrant: custom?.qdrant ?? { key: id, value: true },
})
const FLAGS: Flag[] = [
	{ id: "movie", label: "Movie", description: "A feature film, not a series.", table: "movie" },
	{ id: "show", label: "TV show", description: "A series with episodes, not a film.", table: "show" },
	flag("is_anime", "Anime", "Japanese-style animation (anime)."),
	flag("animated", "Animated", "Any animated production, as opposed to live action.", {
		sql: "production_method = 'Animation'",
		qdrant: { key: "production_method", value: "Animation" },
	}),
	flag("live_action", "Live action", "Filmed with real actors, not animated.", {
		sql: "production_method = 'Live-Action'",
		qdrant: { key: "production_method", value: "Live-Action" },
	}),
	flag("suitability_adults", "Adults", "Mature themes, not for kids."),
	flag("suitability_date_night", "Date night", "Great for a romantic evening."),
	flag("suitability_family", "Family movie night", "Good for watching with the whole family."),
	flag("suitability_friends", "Friends night", "A fun watch with a group of friends."),
	flag("suitability_group_party", "Party vibe", "Lively and great for a group setting."),
	flag("suitability_intergenerational", "Intergenerational", "Enjoyable for a wide range of ages, for example with parents or grandparents."),
	flag("suitability_kids", "Kids", "Made for children."),
	flag("suitability_partner", "Partner watch", "Good to watch with a significant other."),
	flag("suitability_public_viewing_safe", "Public viewing safe", "No awkward scenes when watching in public."),
	flag("suitability_solo_watch", "Solo watch", "Best enjoyed alone."),
	flag("suitability_teens", "Teens", "Aimed at a teenage audience."),
	flag("context_is_background_friendly", "Background watch", "Doesn't require full attention."),
	flag("context_is_binge_friendly", "Binge-friendly", "Makes you want to watch episode after episode."),
	flag("context_is_comfort_watch", "Comfort watch", "Cozy, familiar, and reassuring."),
	flag("context_is_drop_in_friendly", "Drop-in friendly", "Easy to follow even if you miss a bit."),
	flag("context_is_pure_escapism", "Pure escapism", "Lets you completely disconnect from reality."),
	flag("context_is_thought_provoking", "Thought-provoking", "Leaves you with a lot to think about."),
]
const FLAG_COLUMNS = [
	"is_anime",
	"production_method",
	...FLAGS.filter((f) => f.id.startsWith("suitability_") || f.id.startsWith("context_")).map((f) => f.id),
].join(", ")

let apiKey: string | undefined
const getKey = () => {
	if (apiKey) return apiKey
	apiKey = process.env.TYPESAFE_API_KEY
	if (!apiKey) {
		const line = readFileSync(KEY_FALLBACK_FILE, "utf8")
			.split("\n")
			.find((l) => l.startsWith("TYPESAFE_API_KEY="))
		apiKey = line?.split("=", 2)[1]?.trim()
	}
	if (!apiKey) throw new Error("TYPESAFE_API_KEY missing")
	return apiKey
}

interface ScoreAnswer {
	type: "score"
	score: number
	probabilities: Record<string, number>
	confidence: number
}
interface NoulAnswer {
	type: "noul"
	noul: number
}
interface ChoiceAnswer {
	type: "choice"
	choice: string
	probabilities: Record<string, number>
	confidence: number
}
type Answer = ScoreAnswer | NoulAnswer | ChoiceAnswer

export interface Usage {
	requests: number
	questions: number
	tokens: number
	usd: number
	ms: number
}
const newUsage = (): Usage => ({ requests: 0, questions: 0, tokens: 0, usd: 0, ms: 0 })

const jev = async (usage: Usage, state: unknown, questions: Record<string, unknown>) => {
	for (let attempt = 0; ; attempt++) {
		const response = await fetch("https://api.typesafe.ai/v1/systemone", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${getKey()}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ state, model: MODEL, questions }),
		})
		if ((response.status === 429 || response.status === 529) && attempt < 4) {
			await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
			continue
		}
		if (!response.ok) {
			throw new Error(`Jev ${response.status}: ${(await response.text()).slice(0, 300)}`)
		}
		const body = (await response.json()) as {
			answers: Record<string, Answer>
			usage: { input_tokens: number }
		}
		usage.requests += 1
		usage.questions += Object.keys(questions).length
		usage.tokens += body.usage.input_tokens
		usage.usd = usage.tokens * USD_PER_INPUT_TOKEN
		return body.answers
	}
}

const pooled = async <T, R>(items: T[], fn: (item: T) => Promise<R>) => {
	const results: R[] = new Array(items.length)
	let next = 0
	await Promise.all(
		Array.from({ length: CONCURRENCY }, async () => {
			while (next < items.length) {
				const i = next++
				results[i] = await fn(items[i])
			}
		}),
	)
	return results
}

const stripHtml = (html: string) =>
	html
		.replace(/<[^>]+>/g, " ")
		.replace(/&[a-z#0-9]+;/gi, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 600)

const levels = (answer: ScoreAnswer, count: number) =>
	Array.from({ length: count }, (_, i) => answer.probabilities[String(i)] ?? 0)

export interface DimensionJudgment {
	key: string
	label: string
	wanted: number
	confidence: number
	probabilities: number[]
	weight: number
	used: boolean
}

export interface FlagJudgment {
	id: string
	label: string
	required: number
	excluded: number
	decision: "required" | "excluded" | null
}

const interpretRequest = async (request: string, style: LadderStyle) => {
	const started = Date.now()
	const usage = newUsage()
	const ladder = LADDERS[style]
	const questions: Record<string, unknown> = {}
	for (const f of FLAGS) {
		questions[`flag:${f.id}`] = {
			type: "choice",
			instructions: `A person describes what they want to watch in \`request\`. What does the request say about the attribute "${f.label}" (${f.description})?`,
			criteria: ladder.flag,
		}
	}
	for (const key of VALID_FINGERPRINT_KEYS) {
		const meta = FINGERPRINT_META[key]
		questions[key] = {
			type: "score",
			instructions: `A person describes what they want to watch in \`request\`. How much of the quality "${meta?.label ?? key}" (${meta?.description ?? key}) does the request ask for?`,
			criteria: ladder.wanted,
		}
	}
	const answers = await jev(usage, { request }, questions)
	const dimensions: DimensionJudgment[] = VALID_FINGERPRINT_KEYS.map((key) => {
		const answer = answers[key] as ScoreAnswer
		return {
			key,
			label: FINGERPRINT_META[key]?.label ?? key,
			wanted: answer.score,
			confidence: answer.confidence,
			probabilities: levels(answer, ladder.wanted.length),
			weight: answer.score - NEUTRAL,
			used: false,
		}
	})
	const strongest = [...dimensions]
		.filter((j) => Math.abs(j.weight) >= MIN_DEVIATION)
		.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
		.slice(0, MAX_DIMENSIONS)
	for (const j of strongest) j.used = true

	const flags: FlagJudgment[] = FLAGS.map((f) => {
		const { probabilities } = answers[`flag:${f.id}`] as ChoiceAnswer
		const required = probabilities.required ?? 0
		const excluded = probabilities.excluded ?? 0
		return {
			id: f.id,
			label: f.label,
			required,
			excluded,
			decision: required >= FLAG_THRESHOLD ? "required" : excluded >= FLAG_THRESHOLD ? "excluded" : null,
		}
	})
	usage.ms = Date.now() - started
	return { style, dimensions, flags, usage, levels: ladder.wanted }
}

// Decided flags become hard filters. Audience and context exclusions are over-eager
// ("with my parents" excludes date night, friends, solo) and empty the result set,
// so only identity attributes may exclude.
const decidedFlags = (flags: FlagJudgment[]) =>
	flags.flatMap((judgment) => {
		if (!judgment.decision) return []
		const f = FLAGS.find((x) => x.id === judgment.id) as Flag
		const wanted = judgment.decision === "required"
		const soft = f.id.startsWith("suitability_") || f.id.startsWith("context_")
		return !wanted && soft ? [] : [{ flag: f, wanted }]
	})

// Returns null when the table itself is ruled out
const flagSql = (flags: FlagJudgment[], table: "movie" | "show") => {
	const clauses: string[] = []
	for (const { flag: f, wanted } of decidedFlags(flags)) {
		if (f.table) {
			if ((f.table === table) !== wanted) return null
		} else {
			clauses.push(wanted ? `(${f.sql})` : `NOT coalesce((${f.sql}), false)`)
		}
	}
	return clauses.map((c) => ` AND ${c}`).join("")
}

interface Row {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: number
	poster_path: string | null
	genres: string[] | null
	synopsis: string | null
	essence_text: string | null
	essence_tags: string[] | null
	fingerprint_scores: Record<string, number> | null
	is_anime: boolean | null
	production_method: string | null
	[flagColumn: string]: unknown
}

const COLUMNS = `tmdb_id, title, release_year, poster_path, genres, synopsis, essence_text, essence_tags, fingerprint_scores, ${FLAG_COLUMNS}`

type Ref = { media_type: "movie" | "show"; tmdb_id: number }

// Qdrant holds no synopsis or essence text, so title details always come from Crate by ID
const loadRows = async (refs: Ref[], flags: FlagJudgment[]) => {
	const rows = await Promise.all(
		(["movie", "show"] as const).map(async (table) => {
			const ids = refs.filter((r) => r.media_type === table).map((r) => r.tmdb_id)
			const filter = flagSql(flags, table)
			if (!ids.length || filter === null) return []
			return (
				await query<Row>(
					`SELECT ${COLUMNS} FROM ${table}
					 WHERE tmdb_id IN (${ids.join(",")}) AND fingerprint_scores IS NOT NULL${filter}`,
				)
			).map((row) => ({ ...row, media_type: table }))
		}),
	)
	const byKey = new Map(rows.flat().map((r) => [`${r.media_type}:${r.tmdb_id}`, r]))
	return refs.map((r) => byKey.get(`${r.media_type}:${r.tmdb_id}`)).filter((r): r is Row => Boolean(r))
}

let qdrant: QdrantClient | undefined
const getQdrant = () => {
	if (!qdrant) {
		// The webapp's QDRANT_URL points at the gRPC port. The REST client needs 6333.
		const url = new URL(process.env.QDRANT_URL || "http://localhost:6333")
		if (url.port === "6334") url.port = "6333"
		qdrant = new QdrantClient({
			url: url.toString().replace(/\/$/, ""),
			apiKey: process.env.QDRANT_API_KEY,
			checkCompatibility: false,
		})
	}
	return qdrant
}

// The fingerprint_v1 vector is the 74 raw scores in VALID_FINGERPRINT_KEYS order (cosine distance).
// The query vector holds Jev's weight for each used dimension and 0 elsewhere.
// With `rerank`, Qdrant returns a wide pool and code re-orders it by the plain weighted sum.
// Cosine distance divides by the title vector's length, which favors titles with few strong scores.
const QDRANT_WIDE_POOL = 300
const qdrantCandidates = async (
	used: DimensionJudgment[],
	flags: FlagJudgment[],
	rerank: boolean,
): Promise<Ref[]> => {
	const weights = new Map(used.map((d) => [d.key, d.weight]))
	const vector = VALID_FINGERPRINT_KEYS.map((key) => weights.get(key) ?? 0)
	const must: unknown[] = [{ key: "goodwatch_overall_score_voting_count", range: { gte: MIN_VOTES } }]
	const must_not: unknown[] = []
	for (const { flag: f, wanted } of decidedFlags(flags)) {
		const condition = f.table
			? { key: "media_type", match: { value: f.table } }
			: { key: f.qdrant?.key, match: { value: f.qdrant?.value } }
		;(wanted ? must : must_not).push(condition)
	}
	const response = await getQdrant().query(MEDIA_COLLECTION, {
		query: vector,
		using: "fingerprint_v1",
		filter: { must, must_not } as never,
		limit: rerank ? QDRANT_WIDE_POOL : FINGERPRINT_POOL,
		with_payload: rerank ? ["fingerprint_scores_v1"] : false,
	})
	const weightedSum = (payload: unknown) => {
		const scores = (payload as { fingerprint_scores_v1?: Record<string, number> })?.fingerprint_scores_v1
		return used.reduce((sum, d) => sum + d.weight * (scores?.[d.key] ?? 0), 0)
	}
	const points = rerank
		? [...response.points]
				.sort((a, b) => weightedSum(b.payload) - weightedSum(a.payload))
				.slice(0, FINGERPRINT_POOL)
		: response.points
	return points.map((point) => {
		const { mediaType, tmdbId } = parsePointId(Number(point.id))
		return { media_type: mediaType, tmdb_id: tmdbId }
	})
}

const crateCandidates = async (used: DimensionJudgment[], flags: FlagJudgment[]): Promise<Ref[]> => {
	// keys come from VALID_FINGERPRINT_KEYS, weights are numbers: safe to inline
	const fit =
		used.map((d) => `(${d.weight.toFixed(3)} * fingerprint_scores['${d.key}'])`).join(" + ") || "0"
	const rows = await Promise.all(
		(["movie", "show"] as const).map(async (table) => {
			const filter = flagSql(flags, table)
			if (filter === null) return []
			return (
				await query<{ tmdb_id: number; fit: number }>(
					`SELECT tmdb_id, (${fit}) AS fit FROM ${table}
					 WHERE goodwatch_overall_score_voting_count >= ${MIN_VOTES}
					   AND fingerprint_scores['tension'] IS NOT NULL${filter}
					 ORDER BY fit DESC, goodwatch_overall_score_voting_count DESC
					 LIMIT ${FINGERPRINT_POOL}`,
				)
			).map((row) => ({ ...row, media_type: table }))
		}),
	)
	return rows
		.flat()
		.sort((a, b) => b.fit - a.fit)
		.slice(0, FINGERPRINT_POOL)
}

interface Trope {
	name: string
	text: string
}
interface TropeHit {
	media_tmdb_id: number
	media_type: "movie" | "show"
	name: string
	content: string | null
}
const TROPE_SELECT =
	"SELECT media_tmdb_id, media_type, name, substr(content, 1, 1200) AS content, _score FROM trope"

const groupTropes = (hits: TropeHit[], into = new Map<string, Trope[]>()) => {
	for (const hit of hits) {
		const key = `${hit.media_type}:${hit.media_tmdb_id}`
		const list = into.get(key) ?? []
		if (list.length < TROPES_PER_TITLE && !list.some((t) => t.name === hit.name)) {
			list.push({ name: hit.name, text: stripHtml(hit.content ?? "") })
		}
		into.set(key, list)
	}
	return into
}

// Trope passages exist only in Crate, which has a full-text index on them. The best-matching
// rows are grouped by title in code: a GROUP BY over the full-text match took four times as long.
const tropeSearch = (request: string) =>
	query<TropeHit>(`${TROPE_SELECT} WHERE match((name, content), ?) ORDER BY _score DESC LIMIT 400`, [
		request,
	])

// Matching passages for titles that came from the fingerprint pool
const tropesForIds = (request: string, refs: Ref[]) =>
	refs.length
		? query<TropeHit>(
				`${TROPE_SELECT} WHERE match((name, content), ?)
				 AND media_tmdb_id IN (${[...new Set(refs.map((r) => r.tmdb_id))].join(",")})
				 ORDER BY _score DESC LIMIT 400`,
				[request],
			)
		: Promise.resolve([])

const attributesOf = (row: Row) =>
	FLAGS.filter((f) =>
		f.table
			? f.table === row.media_type
			: f.id === "animated"
				? row.production_method === "Animation"
				: f.id === "live_action"
					? row.production_method === "Live-Action"
					: row[f.id] === true,
	).map((f) => f.label)

const titleState = (row: Row, tropes: Trope[], v: FitVariant) => {
	const scores = row.fingerprint_scores ?? {}
	const label = (key: string) => FINGERPRINT_META[key]?.label ?? key
	const entries = VALID_FINGERPRINT_KEYS.map((key) => [key, scores[key]] as const).filter(
		([, value]) => typeof value === "number",
	)
	const traits: Record<string, string[]> = {
		defining: entries.filter(([, value]) => value >= 9).map(([k]) => label(k)),
		strong: entries.filter(([, value]) => value >= 7 && value < 9).map(([k]) => label(k)),
	}
	if (!v.leanState) traits.absent = entries.filter(([, value]) => value <= 1).map(([k]) => label(k))
	const state: Record<string, unknown> = {
		media_type: row.media_type === "movie" ? "Movie" : "TV show",
		genres: row.genres ?? [],
		synopsis: v.leanState ? (row.synopsis ?? "").slice(0, 200) : (row.synopsis ?? ""),
		essence: row.essence_text ?? "",
		traits,
		attributes: attributesOf(row),
	}
	if (!v.leanState) state.tags = row.essence_tags ?? []
	if (v.tropes === "passages" && tropes.length) state.tropes = tropes
	if (v.tropes === "names" && tropes.length) state.tropes = tropes.map((t) => t.name)
	return state
}

export interface VariantJudgment {
	score: number
	confidence: number
	probabilities: number[]
	rank: number
	usedTropes: boolean
	tropeSupport: number[] | null
	state: unknown
}

interface Candidate {
	row: Row
	sources: ("fingerprint" | "tropes")[]
	tropes: Trope[]
}

const runVariant = async (request: string, candidates: Candidate[], v: FitVariant) => {
	const started = Date.now()
	const usage = newUsage()
	const fitLevels = LADDERS[v.ladder].fit
	const fitQuestion = (path: string) => ({
		type: "score",
		instructions: `A person describes what they want to watch in \`request\`. Judging only from the evidence in ${path}, how well does this title fit the request? Don't use outside knowledge about the title.`,
		criteria: fitLevels,
	})
	const judgments = new Map<Candidate, VariantJudgment>()
	const record = (candidate: Candidate, state: unknown, answers: Record<string, Answer>, prefix: string) => {
		const fit = answers[`${prefix}fit`] as ScoreAnswer
		const withQuestions = v.tropeQuestions && v.tropes === "passages" && candidate.tropes.length > 0
		judgments.set(candidate, {
			score: fit.score,
			confidence: fit.confidence,
			probabilities: levels(fit, fitLevels.length),
			rank: 0,
			usedTropes: v.tropes !== "none" && candidate.tropes.length > 0,
			tropeSupport: withQuestions
				? candidate.tropes.map((_, i) => (answers[`${prefix}trope_${i}`] as NoulAnswer).noul)
				: null,
			state,
		})
	}

	if (v.batch > 1) {
		const batches: Candidate[][] = []
		for (let i = 0; i < candidates.length; i += v.batch) batches.push(candidates.slice(i, i + v.batch))
		await pooled(batches, async (batch) => {
			const titles = batch.map((c) => titleState(c.row, c.tropes, v))
			const questions: Record<string, unknown> = {}
			batch.forEach((_, i) => {
				questions[`${i}:fit`] = fitQuestion(`\`titles[${i}]\` alone`)
			})
			const answers = await jev(usage, { request, titles }, questions)
			batch.forEach((c, i) => record(c, titles[i], answers, `${i}:`))
		})
	} else {
		await pooled(candidates, async (c) => {
			const title = titleState(c.row, c.tropes, v)
			const questions: Record<string, unknown> = { fit: fitQuestion("`title`") }
			if (v.tropeQuestions && v.tropes === "passages") {
				c.tropes.forEach((_, i) => {
					questions[`trope_${i}`] = {
						type: "noul",
						instructions: `Does the passage in \`title.tropes[${i}]\` show that this title delivers something the \`request\` asks for?`,
						criteria: {
							true: "The passage describes content that directly matches part of the request",
							false: "The passage is unrelated to the request, or only shares words with it",
						},
					}
				})
			}
			record(c, title, await jev(usage, { request, title }, questions), "")
		})
	}
	usage.ms = Date.now() - started
	return { judgments, usage }
}

export interface PrototypeResult {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: number
	poster_path: string | null
	essence_text: string | null
	sources: ("fingerprint" | "tropes")[]
	attributes: string[]
	arithmeticFit: number
	dimensionValues: { key: string; label: string; weight: number; value: number | null }[]
	tropes: Trope[]
	// Why the title matches, derived from data: no Jev text is involved
	reasons: { text: string; kind: "attribute" | "dimension" | "mismatch" }[]
	variants: Record<string, VariantJudgment>
}

const reasonsFor = (c: Candidate, used: DimensionJudgment[], flags: FlagJudgment[]) => {
	const reasons: PrototypeResult["reasons"] = []
	const has = new Set(attributesOf(c.row))
	for (const { flag: f, wanted } of decidedFlags(flags)) {
		if (wanted && has.has(f.label)) reasons.push({ text: f.label, kind: "attribute" })
	}
	const scores = c.row.fingerprint_scores ?? {}
	for (const d of used) {
		const value = scores[d.key]
		if (typeof value !== "number") continue
		if (d.weight > 0 && value >= 7) reasons.push({ text: `${d.label} ${value}`, kind: "dimension" })
		else if (d.weight < 0 && value <= 3) reasons.push({ text: `low ${d.label} ${value}`, kind: "dimension" })
		else if (d.weight > 0 && value <= 3) reasons.push({ text: `but ${d.label} only ${value}`, kind: "mismatch" })
		else if (d.weight < 0 && value >= 7) reasons.push({ text: `but ${d.label} ${value}`, kind: "mismatch" })
	}
	return reasons
}

export const runPrototypeSearch = async (
	request: string,
	options: { retrieval: "qdrant" | "qdrant_rerank" | "crate"; interpretation: LadderStyle },
) => {
	const started = Date.now()
	const timed = async <T>(promise: Promise<T>) => {
		const from = Date.now()
		const value = await promise
		return { value, ms: Date.now() - from }
	}

	// The trope search needs only the request text, so it runs while Jev reads the request.
	// Both interpretation ladders run so that the page can compare them. One drives retrieval.
	const tropeSearchPromise = timed(tropeSearch(request))
	const interpretations = await Promise.all([
		interpretRequest(request, "full"),
		interpretRequest(request, "short"),
	])
	const chosen = interpretations.find((i) => i.style === options.interpretation) ?? interpretations[0]
	const used = chosen.dimensions.filter((d) => d.used)

	const afterInterpretation = Date.now()
	const hasSignal = used.length > 0 || decidedFlags(chosen.flags).length > 0
	const vectorSearch = await timed(
		!hasSignal
			? Promise.resolve([] as Ref[])
			: options.retrieval !== "crate" && used.length > 0
				? qdrantCandidates(used, chosen.flags, options.retrieval === "qdrant_rerank")
				: crateCandidates(used, chosen.flags),
	)
	const tropeHits = await tropeSearchPromise
	const tropeRefs: Ref[] = []
	for (const hit of tropeHits.value) {
		if (!tropeRefs.some((r) => r.media_type === hit.media_type && r.tmdb_id === hit.media_tmdb_id)) {
			tropeRefs.push({ media_type: hit.media_type, tmdb_id: hit.media_tmdb_id })
		}
	}
	const details = await timed(
		Promise.all([
			loadRows(vectorSearch.value, chosen.flags),
			loadRows(tropeRefs.slice(0, TROPE_POOL * 4), chosen.flags),
			tropesForIds(request, vectorSearch.value),
		]),
	)
	const [fromFingerprint, tropeRows, fingerprintTropeHits] = details.value
	const fromTropes = tropeRows.slice(0, TROPE_POOL)

	const merged = new Map<string, Candidate>()
	for (const [source, rows] of [
		["fingerprint", fromFingerprint],
		["tropes", fromTropes],
	] as const) {
		for (const row of rows) {
			const key = `${row.media_type}:${row.tmdb_id}`
			const entry = merged.get(key) ?? { row, sources: [] as ("fingerprint" | "tropes")[], tropes: [] }
			entry.sources.push(source)
			merged.set(key, entry)
		}
	}
	const candidates = [...merged.values()]
	const tropesByTitle = groupTropes(fingerprintTropeHits, groupTropes(tropeHits.value))
	for (const c of candidates) c.tropes = tropesByTitle.get(`${c.row.media_type}:${c.row.tmdb_id}`) ?? []
	// Time on the critical path after the interpretation. The trope search overlaps the interpretation.
	const retrievalMs = Date.now() - afterInterpretation

	const arithmeticFit = (c: Candidate) =>
		used.reduce((sum, d) => sum + d.weight * (c.row.fingerprint_scores?.[d.key] ?? 0), 0)

	// Variants run one after another so that each variant's wall-clock time is its own
	const variantRuns: ({ variant: FitVariant } & Awaited<ReturnType<typeof runVariant>>)[] = []
	for (const v of FIT_VARIANTS) {
		const run = await runVariant(request, candidates, v)
		;[...candidates]
			.sort(
				(a, b) =>
					(run.judgments.get(b)?.score ?? 0) - (run.judgments.get(a)?.score ?? 0) ||
					arithmeticFit(b) - arithmeticFit(a),
			)
			.forEach((c, i) => {
				const judgment = run.judgments.get(c)
				if (judgment) judgment.rank = i + 1
			})
		variantRuns.push({ variant: v, ...run })
	}

	const results: PrototypeResult[] = candidates.map((c) => ({
		tmdb_id: c.row.tmdb_id,
		media_type: c.row.media_type,
		title: c.row.title,
		release_year: c.row.release_year,
		poster_path: c.row.poster_path,
		essence_text: c.row.essence_text,
		sources: c.sources,
		attributes: attributesOf(c.row),
		arithmeticFit: arithmeticFit(c),
		dimensionValues: used.map((d) => ({
			key: d.key,
			label: d.label,
			weight: d.weight,
			value: c.row.fingerprint_scores?.[d.key] ?? null,
		})),
		tropes: c.tropes,
		reasons: reasonsFor(c, used, chosen.flags),
		variants: Object.fromEntries(
			variantRuns.map((run) => [run.variant.id, run.judgments.get(c) as VariantJudgment]),
		),
	}))

	// Jev reads the request and nothing else: no title is sent. Candidates rank by weighted sum.
	const byWeightedSum = [...results].sort((a, b) => b.arithmeticFit - a.arithmeticFit)
	for (const result of results) {
		result.variants.interpret_only = {
			score: result.arithmeticFit,
			confidence: 0,
			probabilities: [],
			rank: byWeightedSum.indexOf(result) + 1,
			usedTropes: false,
			tropeSupport: null,
			state: "No title state is sent in this variant.",
		}
	}
	const interpretOnly = {
		...variant({
			id: "interpret_only",
			label: "No fit calls",
			description:
				"Jev only reads the request. No title is sent to Jev. Candidates rank by the weighted sum of their stored scores.",
			tropes: "none",
			tropeQuestions: false,
		}),
		arithmetic: true,
		usage: newUsage(),
		fitLevels: [] as string[],
		searchTokens: chosen.usage.tokens,
		searchUsd: chosen.usage.tokens * USD_PER_INPUT_TOKEN,
		searchMs: chosen.usage.ms + retrievalMs,
	}

	const allUsage = [...interpretations.map((i) => i.usage), ...variantRuns.map((r) => r.usage)]
	return {
		request,
		options,
		interpretations,
		results,
		variants: [interpretOnly].concat(
			variantRuns.map((run) => ({
			...run.variant,
			arithmetic: false,
			usage: run.usage,
			fitLevels: LADDERS[run.variant.ladder].fit,
			// What a product search would cost with this variant: one interpretation plus the fit calls
			searchTokens: chosen.usage.tokens + run.usage.tokens,
			searchUsd: (chosen.usage.tokens + run.usage.tokens) * USD_PER_INPUT_TOKEN,
			searchMs: chosen.usage.ms + retrievalMs + run.usage.ms,
			})),
		),
		stats: {
			ms: Date.now() - started,
			retrievalMs,
			stages: {
				interpretMs: chosen.usage.ms,
				tropeSearchMs: tropeHits.ms,
				vectorSearchMs: vectorSearch.ms,
				detailsMs: details.ms,
			},
			requests: allUsage.reduce((sum, u) => sum + u.requests, 0),
			questions: allUsage.reduce((sum, u) => sum + u.questions, 0),
			tokens: allUsage.reduce((sum, u) => sum + u.tokens, 0),
			usd: allUsage.reduce((sum, u) => sum + u.tokens, 0) * USD_PER_INPUT_TOKEN,
			fromFingerprint: fromFingerprint.length,
			fromTropes: fromTropes.length,
			titlesWithTropes: candidates.filter((c) => c.tropes.length > 0).length,
		},
	}
}

export type PrototypeSearch = Awaited<ReturnType<typeof runPrototypeSearch>>
