// PROTOTYPE - throwaway. Compares ways of turning a free-text request into a fingerprint
// vector query through Jev (TypeSafe System One). No fit calls, no tropes: Jev reads the request,
// Qdrant retrieves, code ranks by weighted sum. Sibling of prototype-jev-search.server.ts.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { QdrantClient } from "@qdrant/js-client-rest"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { query } from "~/utils/crate"
import { MEDIA_COLLECTION, parsePointId } from "~/utils/qdrant"
import { VALID_FINGERPRINT_KEYS } from "./utils/fingerprint"

const MODEL = "jev-latest"
const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000
const KEY_FALLBACK_FILE =
	"/home/alp/dev/projects/goodwatch/goodwatch-jev-fingerprint/docs/benchmarks/fingerprint/jev/private/experiment.env"
const RESULTS = 20
const MIN_VOTES = 2000
const FLAG_THRESHOLD = 0.6

type Key = (typeof VALID_FINGERPRINT_KEYS)[number]
const label = (key: string) => FINGERPRINT_META[key]?.label ?? key
const describe = (key: string) => `"${label(key)}" (${FINGERPRINT_META[key]?.description ?? key})`

const WANTED_LEVELS = [
	"The request explicitly asks to avoid this quality or says there should be none of it",
	"The request asks for only a little of this quality, or implies it should stay low",
	"The request says nothing about this quality, neither directly nor by clear implication",
	"The request asks for this quality, directly or by clear implication",
	"This quality is central to the request: it is one of the main things the person is asking for",
]
interface Flag {
	id: string
	label: string
	description: string
	qdrant?: { key: string; value: string | boolean }
	media?: "movie" | "show"
}
const flag = (id: string, label: string, description: string, qdrant?: Flag["qdrant"]): Flag => ({
	id,
	label,
	description,
	qdrant: qdrant ?? { key: id, value: true },
})
const FLAGS: Flag[] = [
	{ id: "movie", label: "Movie", description: "A feature film, not a series.", media: "movie" },
	{ id: "show", label: "TV show", description: "A series with episodes, not a film.", media: "show" },
	flag("is_anime", "Anime", "Japanese-style animation (anime)."),
	flag("animated", "Animated", "Any animated production, as opposed to live action.", { key: "production_method", value: "Animation" }),
	flag("live_action", "Live action", "Filmed with real actors, not animated.", { key: "production_method", value: "Live-Action" }),
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
	const started = Date.now()
	for (let attempt = 0; ; attempt++) {
		const response = await fetch("https://api.typesafe.ai/v1/systemone", {
			method: "POST",
			headers: { Authorization: `Bearer ${getKey()}`, "Content-Type": "application/json" },
			body: JSON.stringify({ state, model: MODEL, questions }),
		})
		if ((response.status === 429 || response.status === 529) && attempt < 4) {
			await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
			continue
		}
		if (!response.ok) throw new Error(`Jev ${response.status}: ${(await response.text()).slice(0, 300)}`)
		const body = (await response.json()) as { answers: Record<string, Answer>; usage: { input_tokens: number } }
		usage.requests += 1
		usage.questions += Object.keys(questions).length
		usage.tokens += body.usage.input_tokens
		usage.usd = usage.tokens * USD_PER_INPUT_TOKEN
		usage.ms += Date.now() - started
		return body.answers
	}
}

export interface Options {
	pool: number
	// auto: trope search runs only when Jev says the request names a concrete thing or trope
	tropes: "auto" | "off" | "always"
}
// Module-level so that retrieval needs no extra parameter. Fine for a single-user prototype.
let options: Options = { pool: 2000, tropes: "auto" }

// --- Shared Jev readings -------------------------------------------------------------------
// Each reading runs once per search. Variants derive their weights from the shared readings,
// so differences between columns come from the variant logic and not from run-to-run noise.

const sparseVector = (weights: Partial<Record<Key, number>>) => VALID_FINGERPRINT_KEYS.map((k) => weights[k] ?? 0)

interface Detail {
	key: Key
	label: string
	text: string
	weight: number
}

// Reading A: wanted level per dimension, 74 Score questions
const readWanted = async (request: string) => {
	const usage = newUsage()
	const questions: Record<string, unknown> = {}
	for (const key of VALID_FINGERPRINT_KEYS) {
		questions[key] = {
			type: "score",
			instructions: `A person describes what they want to watch in \`request\`. How much of the quality ${describe(key)} does the request ask for?`,
			criteria: WANTED_LEVELS,
		}
	}
	const answers = await jev(usage, { request }, questions)
	const details: Detail[] = VALID_FINGERPRINT_KEYS.map((key) => {
		const a = answers[key] as ScoreAnswer
		return { key, label: label(key), weight: a.score - 2, text: `wanted ${a.score.toFixed(2)} of 4, confidence ${a.confidence.toFixed(2)}` }
	})
	return { usage, details }
}

// Reading B: want and avoid as two Noul questions per dimension, 148 in total
// The shared sentences move into the state, which Jev reads once. Each question keeps only what
// differs. This cut tokens by 37% in a benchmark, but the reading changes somewhat.
const SHORT_TASK =
	"A person describes what they want to watch in `request`. Each question names one quality of movies and shows. 'Asks for' includes clear implication. 'Avoid' includes wanting little of it."
const readWantAvoid = async (request: string, wording: "full" | "short" = "full") => {
	const usage = newUsage()
	const questions: Record<string, unknown> = {}
	for (const key of wording === "short" ? VALID_FINGERPRINT_KEYS : []) {
		questions[`want:${key}`] = { type: "noul", instructions: `Does \`request\` ask for ${describe(key)}?` }
		questions[`avoid:${key}`] = { type: "noul", instructions: `Does \`request\` ask to avoid ${describe(key)}?` }
	}
	for (const key of wording === "full" ? VALID_FINGERPRINT_KEYS : []) {
		questions[`want:${key}`] = {
			type: "noul",
			instructions: `A person describes what they want to watch in \`request\`. Does the request ask for the quality ${describe(key)}, directly or by clear implication?`,
		}
		questions[`avoid:${key}`] = {
			type: "noul",
			instructions: `A person describes what they want to watch in \`request\`. Does the request ask to avoid the quality ${describe(key)}, or to keep it low?`,
		}
	}
	const answers = await jev(usage, wording === "short" ? { task: SHORT_TASK, request } : { request }, questions)
	const details: Detail[] = VALID_FINGERPRINT_KEYS.map((key) => {
		const want = (answers[`want:${key}`] as NoulAnswer).noul
		const avoid = (answers[`avoid:${key}`] as NoulAnswer).noul
		return { key, label: label(key), weight: 2 * (want - avoid), text: `want ${(want * 100).toFixed(0)}%, avoid ${(avoid * 100).toFixed(0)}%` }
	})
	return { usage, details }
}

const pick = (details: Detail[], keep: (d: Detail) => boolean, max: number) => {
	const weights: Partial<Record<Key, number>> = {}
	const kept = details.filter(keep).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, max)
	// Never return an empty reading: fall back to the single strongest dimension
	const chosen = kept.length ? kept : [...details].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 1)
	for (const d of chosen) weights[d.key] = d.weight
	return weights
}

// --- Archetypes (novel approach C) ------------------------------------------------------------
// Jev can't invent a realistic 74-number profile, and a sparse weight vector says nothing about
// what kind of title is wanted, which is how game shows win "tense but not bleak". So the catalog
// itself supplies the profiles: popular titles are clustered once into archetypes, each archetype
// is described in words, and Jev judges how well each kind of title fits the request. The best
// archetypes' centroids, which are real full profiles, become the cosine query.

const ARCHETYPES = 48
const ARCHETYPE_SAMPLE = 20000
const ARCHETYPE_CACHE = "node_modules/.cache/prototype-jev-archetypes-v1.json"

interface Archetype {
	id: number
	size: number
	centroid: number[]
	description: { kind: string; genres: string[]; strongest_qualities: string[]; distinctive_qualities: string[]; unusually_low_qualities: string[] }
}

let archetypes: Archetype[] | undefined
const getArchetypes = async () => {
	if (archetypes) return archetypes
	if (existsSync(ARCHETYPE_CACHE)) {
		archetypes = JSON.parse(readFileSync(ARCHETYPE_CACHE, "utf8")) as Archetype[]
		return archetypes
	}
	const points: { vector: number[]; genres: string[]; show: boolean }[] = []
	let offset: unknown
	do {
		const page = await getQdrant().scroll(MEDIA_COLLECTION, {
			filter: { must: [{ key: "goodwatch_overall_score_voting_count", range: { gte: 5000 } }] } as never,
			limit: 5000,
			offset: offset as never,
			with_payload: ["genres", "media_type"],
			with_vector: ["fingerprint_v1"],
		})
		for (const p of page.points) {
			const vector = (p.vector as Record<string, number[]>)?.fingerprint_v1
			const payload = p.payload as { genres?: string[]; media_type?: string }
			if (vector) points.push({ vector, genres: payload.genres ?? [], show: payload.media_type === "show" })
		}
		offset = page.next_page_offset
	} while (offset && points.length < ARCHETYPE_SAMPLE)

	// Spherical k-means on the normalized vectors, which matches the collection's cosine distance.
	// Deterministic start: evenly spaced points.
	const dims = VALID_FINGERPRINT_KEYS.length
	const normalize = (v: number[]) => {
		const length = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
		return v.map((x) => x / length)
	}
	let centroids = Array.from({ length: ARCHETYPES }, (_, i) => points[Math.floor((i * points.length) / ARCHETYPES)].vector)
	const assignment = new Array<number>(points.length).fill(0)
	for (let iteration = 0; iteration < 20; iteration++) {
		points.forEach((p, i) => {
			let best = 0
			let bestDot = Number.NEGATIVE_INFINITY
			centroids.forEach((c, k) => {
				let dot = 0
				for (let d = 0; d < dims; d++) dot += c[d] * p.vector[d]
				if (dot > bestDot) {
					bestDot = dot
					best = k
				}
			})
			assignment[i] = best
		})
		const sums = Array.from({ length: ARCHETYPES }, () => new Array<number>(dims).fill(0))
		points.forEach((p, i) => {
			for (let d = 0; d < dims; d++) sums[assignment[i]][d] += p.vector[d]
		})
		centroids = sums.map((sum, k) => (sum.some((x) => x !== 0) ? normalize(sum) : centroids[k]))
	}

	const mean = new Array<number>(dims).fill(0)
	for (const p of points) for (let d = 0; d < dims; d++) mean[d] += p.vector[d] / points.length
	const deviation = new Array<number>(dims).fill(0)
	for (const p of points) for (let d = 0; d < dims; d++) deviation[d] += (p.vector[d] - mean[d]) ** 2 / points.length
	archetypes = centroids
		.map((centroid, id) => {
			const members = points.filter((_, i) => assignment[i] === id)
			const genreCount = new Map<string, number>()
			for (const m of members) for (const g of m.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1)
			const z = centroid.map((x, d) => (x - mean[d]) / (Math.sqrt(deviation[d]) || 1))
			const byZ = VALID_FINGERPRINT_KEYS.map((key, d) => ({ key, z: z[d], value: centroid[d] }))
			const shows = members.filter((m) => m.show).length / Math.max(members.length, 1)
			return {
				id,
				size: members.length,
				centroid,
				description: {
					kind: shows > 0.7 ? "mostly TV shows" : shows < 0.3 ? "mostly movies" : "movies and TV shows",
					genres: [...genreCount].filter(([, n]) => n / members.length >= 0.25).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g),
					strongest_qualities: [...byZ].sort((a, b) => b.value - a.value).slice(0, 6).map((x) => label(x.key)),
					distinctive_qualities: [...byZ].sort((a, b) => b.z - a.z).filter((x) => x.z > 0.5).slice(0, 6).map((x) => label(x.key)),
					unusually_low_qualities: [...byZ].sort((a, b) => a.z - b.z).filter((x) => x.z < -0.5).slice(0, 4).map((x) => label(x.key)),
				},
			}
		})
		.filter((a) => a.size >= 20)
	mkdirSync("node_modules/.cache", { recursive: true })
	writeFileSync(ARCHETYPE_CACHE, JSON.stringify(archetypes))
	return archetypes
}

const ARCHETYPE_LEVELS = [
	"Opposite: this kind of title is what the request wants to avoid",
	"Poor fit: this kind of title shares little with the request",
	"Partial fit: some aspects match, but it is not the kind of title the person has in mind",
	"Good fit: this is the kind of title the person has in mind",
	"Excellent fit: this kind of title matches the request in genre, tone, and qualities",
]

const readArchetypes = async (request: string) => {
	const all = await getArchetypes()
	const usage = newUsage()
	const questions = Object.fromEntries(
		all.map((_, i) => [
			`a${i}`,
			{
				type: "score",
				instructions: `A person describes what they want to watch in \`request\`. \`kinds[${i}]\` describes one kind of title by its genres and qualities. How well does that kind of title fit the request?`,
				criteria: ARCHETYPE_LEVELS,
			},
		]),
	)
	const answers = await jev(usage, { request, kinds: all.map((a) => a.description) }, questions)
	const scored = all
		.map((a, i) => ({ archetype: a, score: (answers[`a${i}`] as ScoreAnswer).score }))
		.sort((x, y) => y.score - x.score)
	// Blend the best three kinds, weighted by how far each is above "partial fit"
	const best = scored.slice(0, 3).filter((x, i) => i === 0 || x.score >= 2.5)
	const vector = new Array<number>(VALID_FINGERPRINT_KEYS.length).fill(0)
	for (const b of best) {
		const weight = Math.max(b.score - 2, 0.1) ** 2
		b.archetype.centroid.forEach((x, d) => {
			vector[d] += weight * x
		})
	}
	return { usage, scored, best, vector }
}

// --- Variants ------------------------------------------------------------------------------

// A reading is missing when no visible variant needs it
interface Readings {
	wanted?: Awaited<ReturnType<typeof readWanted>>
	wantAvoid?: Awaited<ReturnType<typeof readWantAvoid>>
	wantAvoidShort?: Awaited<ReturnType<typeof readWantAvoid>>
	archetypes?: Awaited<ReturnType<typeof readArchetypes>>
	genres: GenreJudgment[]
	attributes: Awaited<ReturnType<typeof readFlags>>
}
const need = <T>(reading: T | undefined): T => {
	if (!reading) throw new Error("variant uses a reading that it doesn't list in `needs`")
	return reading
}
const wanted = (r: Readings) => need(r.wanted)
const wantAvoid = (r: Readings) => need(r.wantAvoid)

interface Variant {
	id: string
	label: string
	description: string
	// Which Jev readings a product search with this variant would pay for
	needs: ("wanted" | "wantAvoid" | "wantAvoidShort" | "archetypes")[]
	hidden?: boolean
	phrase?: PhraseSpec
	// Which wording of the attribute request this column uses. Default: full.
	attributeCriteria?: "full" | "short"
	build: (r: Readings) => {
		query: Query
		details: Detail[]
		notes: string[]
		text?: {
			words: string[]
			// Tried in order while the list is still short
			alternatives?: string[][]
			optional?: string[]
			mode: "all" | "any"
			rank: "text" | "blend"
			note?: string
		}
	}
}

const archetypeNotes = (r: Readings) =>
	need(r.archetypes).best.map(
		(b) =>
			`Kind ${b.archetype.id}, fit ${b.score.toFixed(2)} of 4: ${b.archetype.description.genres.join(", ") || "mixed genres"}; ${b.archetype.description.distinctive_qualities.join(", ")}`,
	)

const b2Weights = (r: Readings) => pick(wantAvoid(r).details, (d) => d.weight >= 0.6 || d.weight <= -1.2, 74)

const VARIANTS: Variant[] = [
	{
		id: "a_linear",
		hidden: true,
		label: "A1. Wanted level",
		description: "74 Score questions. The eight strongest deviations above 0.6 become weights. The earlier baseline.",
		needs: ["wanted"],
		build: (r) => {
			const weights = pick(wanted(r).details, (d) => Math.abs(d.weight) >= 0.6, 8)
			return { query: { weights, vector: sparseVector(weights), order: "weighted_sum", genres: [] }, details: wanted(r).details, notes: [] }
		},
	},
	{
		id: "b_asymmetric",
		hidden: true,
		label: "B2. Want and avoid",
		description: "Same reading as B1. A wanted dimension needs a weight of 0.6, an avoided one needs 1.2, because B over-generates avoids.",
		needs: ["wantAvoid"],
		build: (r) => {
			const weights = pick(wantAvoid(r).details, (d) => d.weight >= 0.6 || d.weight <= -1.2, 74)
			return { query: { weights, vector: sparseVector(weights), order: "weighted_sum", genres: [] }, details: wantAvoid(r).details, notes: [] }
		},
	},
	{
		id: "c_archetypes_weights",
		hidden: true,
		label: "C2. Kinds of title, then A weights",
		description: "New. The kinds select the pool: the 2,000 titles closest to the best kinds. A2's strong weights rank inside that pool. The two Jev readings run in parallel.",
		needs: ["archetypes", "wanted"],
		build: (r) => {
			const weights = pick(wanted(r).details, (d) => Math.abs(d.weight) >= 1.2, 8)
			return {
				query: { weights, vector: need(r.archetypes).vector, order: "weighted_sum", genres: [] },
				details: wanted(r).details,
				notes: archetypeNotes(r),
			}
		},
	},
	{
		id: "d_text_only",
		hidden: true,
		label: "D1. Essence text only",
		description: "No dimension reading at all. The whole request, minus negated parts, runs as a full-text search over the essence text and synopsis. Rank is the text score. The attribute filter still applies.",
		needs: [],
		build: (r) => ({
			query: { weights: {}, vector: [], order: "weighted_sum", genres: [] },
			details: [],
			notes: [],
			text: { words: contentWords(r.attributes.request), mode: "any", rank: "text" },
		}),
	},
	{
		id: "d_text_pool",
		hidden: true,
		label: "D2. Whole request finds, B2 ranks",
		description: "The same whole-request text search selects up to 300 titles per media type. B2's weights rank them, and the text score adds up to half a point.",
		needs: ["wantAvoid"],
		build: (r) => ({
			query: { weights: b2Weights(r), vector: sparseVector(b2Weights(r)), order: "weighted_sum", genres: [] },
			details: wantAvoid(r).details,
			notes: [],
			text: { words: contentWords(r.attributes.request), mode: "any", rank: "blend" },
		}),
	},
	{
		id: "d_concrete_pool",
		hidden: true,
		label: "D3. Concrete words find, B2 ranks",
		description: "Jev marks which request words name something concrete. Those questions ride along in the attribute request. Only the concrete words go to the text search, and every one of them must match. B2's weights rank the matches. Without concrete words, this column equals B2.",
		needs: ["wantAvoid"],
		build: (r) => ({
			query: { weights: b2Weights(r), vector: sparseVector(b2Weights(r)), order: "weighted_sum", genres: [] },
			details: wantAvoid(r).details,
			notes: [],
			text: { words: r.attributes.split.filter((w) => w.isConcrete).map((w) => w.word), mode: "all", rank: "blend" },
		}),
	},
	{
		id: "d_best_phrase",
		hidden: true,
		label: "D4. Jev picks the search phrase",
		description: "Code lists every wanted word and adjacent word pair as a candidate. One Choice question, riding along in the attribute request, picks the best search phrase, so there is always one. Parts the person wants little of are never candidates. All words of the phrase must match, and B2's weights rank.",
		needs: ["wantAvoid"],
		build: (r) => {
			const best = r.attributes.phrases[0]
			return {
				query: { weights: b2Weights(r), vector: sparseVector(b2Weights(r)), order: "weighted_sum", genres: [] },
				details: wantAvoid(r).details,
				notes: [],
				text: {
					words: best ? best.phrase.split(" ") : [],
					alternatives: r.attributes.phrases.slice(1, 4).filter((p) => p.probability >= 0.01).map((p) => p.phrase.split(" ")),
					mode: "all",
					rank: "blend",
					note: `Phrase candidates: ${r.attributes.phrases.slice(0, 5).map((p) => `"${p.phrase}" ${(p.probability * 100).toFixed(0)}%`).join(", ")}`,
				},
			}
		},
	},
	{
		id: "d_mentions",
		hidden: true,
		label: "D5. Words a description would mention",
		description: "One yes/no question per word: would a description of the ideal title mention it? The question follows the direction of the request, so \"little action\" scores low. Concrete words must match. Without concrete words, the single best-scoring word must match. Every other word at 50% or more is optional and adds a small bonus. B2's weights rank.",
		needs: ["wantAvoid"],
		build: (r) => {
			const split = r.attributes.split
			const concrete = split.filter((w) => w.isConcrete && w.mention >= 0.5).map((w) => w.word)
			const byMention = [...split].sort((a, b) => b.mention - a.mention)
			const required = concrete.length ? concrete : byMention.slice(0, 1).map((w) => w.word)
			const optional = split.filter((w) => w.mention >= 0.5 && !required.includes(w.word)).map((w) => w.word)
			return {
				query: { weights: b2Weights(r), vector: sparseVector(b2Weights(r)), order: "weighted_sum", genres: [] },
				details: wantAvoid(r).details,
				notes: [],
				text: {
					words: required,
					optional,
					mode: "all",
					rank: "blend",
					note: `Must match: ${required.join(" ") || "nothing"}. Optional: ${optional.join(" ") || "none"}.`,
				},
			}
		},
	},
	...(
		[
			["d4_plus_short", "D4+ short wording", "Jev picks the search phrase, with two phrases, the mood gate, and wider evidence. The B2 reading uses the short question wording. The attribute request uses the full criteria.", "full"],
			["d4_plus_short_attributes", "D4+ short wording, short attribute criteria", "The same pipeline. The 22 attribute questions also move their shared text into the state, and their three answers carry no description. This saves about 1,400 tokens per search.", "short"],
		] as const
	).map(
		([id, label, description, attributeCriteria]): Variant => ({
			id,
			label,
			description,
			needs: ["wantAvoidShort"],
			attributeCriteria,
			phrase: { twoPhrases: true, moodGate: true, wider: true },
			build: (r) => {
				const details = need(r.wantAvoidShort).details
				const weights = pick(details, (d) => d.weight >= 0.6 || d.weight <= -1.2, 74)
				return { query: { weights, vector: sparseVector(weights), order: "weighted_sum", genres: [] }, details, notes: [] }
			},
		}),
	),
]

// --- Attributes (shared by every strategy, one request) ----------------------------------

export interface FlagJudgment {
	id: string
	label: string
	required: number
	excluded: number
	decision: "required" | "excluded" | null
}

// TMDB genres, with the movie and TV spellings merged
const GENRES: { id: string; matches: string[] }[] = [
	["Drama"], ["Comedy"], ["Thriller"], ["Action", "Action & Adventure"], ["Crime"], ["Romance"], ["Horror"], ["Mystery"],
	["Animation"], ["Adventure", "Action & Adventure"], ["Family"], ["Science Fiction", "Sci-Fi & Fantasy"],
	["Fantasy", "Sci-Fi & Fantasy"], ["Documentary"], ["History"], ["Music"], ["War", "War & Politics"], ["Western"],
	["Kids"], ["Reality"], ["Talk"], ["Soap"], ["News"],
].map((names) => ({ id: names[0], matches: names }))

// Search phrase candidates: single words and adjacent pairs inside each wanted clause
const phraseCandidates = (request: string) => {
	const candidates: string[] = []
	for (const clause of request.toLowerCase().split(/,|;|\bbut\b/).map((c) => c.trim())) {
		if (!clause || NEGATIONS.test(clause)) continue
		const words = clause.split(/[^a-z0-9'-]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))
		words.forEach((w, i) => {
			candidates.push(w)
			if (i + 1 < words.length) candidates.push(`${w} ${words[i + 1]}`)
		})
	}
	return [...new Set(candidates)].slice(0, 20)
}

// D4+ uses the attribute flags, the concrete-word questions, and the phrase choice. The genre,
// request-shape, and "mention" questions only serve hidden columns, so they are left out.
// Questions can't see one another, so leaving some out doesn't change the remaining answers.
const LEAN_ATTRIBUTES = true
const CONCRETE = 0.6
const contentWords = (request: string) =>
	[...new Set(tropeTerms(request).split(" ").filter(Boolean))].slice(0, 12)

export interface GenreJudgment {
	id: string
	required: number
	excluded: number
	decision: "required" | "excluded" | null
}

// Short criteria: the intro sentence and the meaning of the three answers move into the state,
// which Jev reads once. Each of the 22 questions keeps only the attribute's name and description,
// and its three options carry no description.
const SHORT_ATTRIBUTE_TASK =
	"A person describes what they want to watch in `request`. Each attribute question names one attribute of a movie or show. Answer `required` when the request asks for it, directly or by clear implication. Answer `excluded` when the request rules it out. Answer `not_mentioned` when the request doesn't settle it."

const readFlags = async (request: string, criteria: "full" | "short" = "full") => {
	const usage = newUsage()
	const questions: Record<string, unknown> = {}
	for (const f of FLAGS) {
		questions[f.id] =
			criteria === "short"
				? {
						type: "choice",
						instructions: `What does \`request\` say about the attribute "${f.label}" (${f.description})?`,
						criteria: { required: null, excluded: null, not_mentioned: null },
					}
				: {
						type: "choice",
						instructions: `A person describes what they want to watch in \`request\`. What does the request say about the attribute "${f.label}" (${f.description})?`,
						criteria: {
							required: "The request asks for this attribute, directly or by clear implication",
							excluded: "The request rules this attribute out, directly or by clear implication",
							not_mentioned: "The request says nothing that settles this attribute",
						},
					}
	}
	for (const genre of LEAN_ATTRIBUTES ? [] : GENRES) {
		questions[`genre:${genre.id}`] = {
			type: "choice",
			instructions: `A person describes what they want to watch in \`request\`. What does the request say about the genre "${genre.id}"?`,
			criteria: {
				required: "The request asks for this genre, by name or by clear implication",
				excluded: "The request rules this genre out",
				not_mentioned: "The request neither asks for this genre nor rules it out",
			},
		}
	}
	if (!LEAN_ATTRIBUTES) questions.covered = {
		type: "noul",
		instructions:
			"A person describes what they want to watch in `request`. A search system can only express the request through the qualities in `available_qualities`. Can those qualities express everything the request asks for?",
		criteria: {
			true: "Every part of the request maps onto one or more of the listed qualities",
			false:
				"Some part of the request names a specific thing, motif, plot device, or character type that none of the listed qualities can express",
		},
	}
	if (!LEAN_ATTRIBUTES) questions.specific = {
		type: "noul",
		instructions:
			"A person describes what they want to watch in `request`. Does the request name a concrete thing, motif, plot device, or character type (for example an object, a profession, a story trope), as opposed to only moods, tones, genres, and styles?",
	}
	// Which words name something concrete? Dimension weights absorb mood and style words, and the
	// concrete words go to the text search. About 60 tokens per word, no extra Jev call.
	const words = contentWords(request)
	words.forEach((_, i) => {
		questions[`word:${i}`] = {
			type: "noul",
			instructions: `A person describes what they want to watch in \`request\`. Does the word \`words[${i}]\`, as used in the request, name something that would appear on screen or in the plot of the wanted title?`,
			criteria: {
				true: "It names a concrete thing: an object, vehicle, place, profession, kind of character, creature, event, or plot device",
				false: "It describes mood, tone, pace, intensity, quality, genre, or style, or it describes the viewing situation, such as who is watching or when",
			},
		}
	})
	// D5: would a written description of the ideal title mention this word? Unlike the concrete
	// question, this one follows the direction of the request: "little action" scores low.
	if (!LEAN_ATTRIBUTES) words.forEach((_, i) => {
		questions[`mention:${i}`] = {
			type: "noul",
			instructions: `A person describes what they want to watch in \`request\`. Would a good written description of the ideal title for this request mention the word \`words[${i}]\` or the idea behind it?`,
			criteria: {
				true: "The person wants this in the title, so a description of a fitting title would mention it",
				false: "The person wants little or none of it, or the word only describes the viewing situation",
			},
		}
	})
	// D4: Jev picks the one best search phrase among code-generated candidates, so there is always one
	const candidates = phraseCandidates(request)
	if (candidates.length > 1) {
		questions.phrase = {
			type: "choice",
			instructions:
				"A person describes what they want to watch in `request`. A search engine will look for one phrase in written descriptions of titles. Which phrase is the best search phrase: the one that most specifically names what the person wants to find in the title?",
			criteria: Object.fromEntries(candidates.map((c) => [c, null])),
		}
	}
	const answers = await jev(
		usage,
		LEAN_ATTRIBUTES ? (criteria === "short" ? { task: SHORT_ATTRIBUTE_TASK, request, words } : { request, words }) : { request, available_qualities: VALID_FINGERPRINT_KEYS.map(label).join(", "), words },
		questions,
	)
	const phraseAnswer = answers.phrase as ChoiceAnswer | undefined
	const phrases = candidates
		.map((phrase) => ({ phrase, probability: phraseAnswer ? (phraseAnswer.probabilities[phrase] ?? 0) : 1 }))
		.sort((a, b) => b.probability - a.probability)
	const split = words.map((word, i) => {
		const concrete = (answers[`word:${i}`] as NoulAnswer).noul
		return { word, concrete, isConcrete: concrete >= CONCRETE, mention: (answers[`mention:${i}`] as NoulAnswer | undefined)?.noul ?? 0 }
	})
	const shape = {
		covered: (answers.covered as NoulAnswer | undefined)?.noul ?? 0,
		specific: (answers.specific as NoulAnswer | undefined)?.noul ?? 0,
	}
	const flags: FlagJudgment[] = FLAGS.map((f) => {
		const { probabilities } = answers[f.id] as ChoiceAnswer
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
	const genres: GenreJudgment[] = GENRES.map((genre) => {
		const probabilities = (answers[`genre:${genre.id}`] as ChoiceAnswer | undefined)?.probabilities ?? {}
		const required = probabilities.required ?? 0
		const excluded = probabilities.excluded ?? 0
		return {
			id: genre.id,
			required,
			excluded,
			decision: required >= FLAG_THRESHOLD ? "required" : excluded >= FLAG_THRESHOLD ? "excluded" : null,
		}
	})
	return { request, flags, genres, usage, shape, split, phrases, lean: LEAN_ATTRIBUTES }
}

// Only identity attributes may exclude; audience and context exclusions are over-eager
const qdrantFilter = (flags: FlagJudgment[]) => {
	const must: unknown[] = [{ key: "goodwatch_overall_score_voting_count", range: { gte: MIN_VOTES } }]
	const must_not: unknown[] = []
	for (const judgment of flags) {
		if (!judgment.decision) continue
		const f = FLAGS.find((x) => x.id === judgment.id) as Flag
		const wanted = judgment.decision === "required"
		const soft = f.id.startsWith("suitability_") || f.id.startsWith("context_")
		if (!wanted && soft) continue
		const condition = f.media ? { key: "media_type", match: { value: f.media } } : { key: f.qdrant?.key, match: { value: f.qdrant?.value } }
		;(wanted ? must : must_not).push(condition)
	}
	return { must, must_not }
}

// --- Retrieval ---------------------------------------------------------------------------

let qdrant: QdrantClient | undefined
const getQdrant = () => {
	if (!qdrant) {
		const url = new URL(process.env.QDRANT_URL || "http://localhost:6333")
		if (url.port === "6334") url.port = "6333"
		qdrant = new QdrantClient({ url: url.toString().replace(/\/$/, ""), apiKey: process.env.QDRANT_API_KEY, checkCompatibility: false })
	}
	return qdrant
}

interface Payload {
	title: string
	release_year: number
	poster_path: string | null
	genres: string[] | null
	fingerprint_scores_v1: Record<string, number>
	is_anime: boolean | null
	production_method: string | null
	[flagColumn: string]: unknown
}

export interface TropeMatch {
	name: string
	text: string
	score: number
}

export interface Result {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: number
	poster_path: string | null
	genres: string[]
	rank: number
	weightedSum: number
	cosine: number
	combined: number
	tropes: TropeMatch[]
	reasons: { text: string; kind: "attribute" | "dimension" | "mismatch" }[]
	scores: { key: string; label: string; weight: number; value: number | null }[]
}

// --- Trope layer (Crate full-text, no Jev call) -------------------------------------------

const TROPE_GATE = 0.6
const TROPE_WEIGHT = 1
const NEGATIONS = /^(not|no|non|without|never|nothing|little|less|few|fewer|minimal|low|barely|hardly)\b/
const STOPWORDS = new Set(
	"a an and the but or not no non without with for that this some something any anything to of in on at by my our your i we you it is are be goes go going like want wants very really little lot more less than too also about".split(
		" ",
	),
)

// Negated clauses are dropped: "not funny" must not search for "funny". Jev's dimension
// reading still sees the full request, so the exclusion stays in force there.
export const tropeTerms = (request: string) =>
	request
		.toLowerCase()
		.split(/,|;|\bbut\b/)
		.map((clause) => clause.trim())
		.filter((clause) => clause && !NEGATIONS.test(clause))
		.flatMap((clause) => clause.split(/[^a-z0-9'-]+/))
		.filter((word) => word.length > 2 && !STOPWORDS.has(word))
		.join(" ")

const stripHtml = (html: string) =>
	html
		.replace(/<[^>]+>/g, " ")
		.replace(/&[a-z#0-9]+;/gi, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 300)

interface TropeRow {
	media_tmdb_id: number
	media_type: "movie" | "show"
	name: string
	content: string | null
	_score: number
}

// Tropes are searched only among titles that already passed the dimension reading, so
// "scifi" acts through Futuristic and "sunglasses" acts through the trope match.
// The trope name counts five times as much as the passage. Phrase match first, then all
// terms, then any term. Hits below half of the best score are dropped.
const tropeMatches = async (terms: string, ids: number[]) => {
	const found = new Map<string, TropeMatch[]>()
	if (!terms || !ids.length) return { found, mode: "none" }
	const modes = [
		["phrase", "using phrase"],
		["all terms", "using best_fields with (operator='and')"],
		["any term", ""],
	] as const
	for (const [mode, using] of modes) {
		if (mode === "phrase" && !terms.includes(" ")) continue
		const rows = await query<TropeRow>(
			`SELECT media_tmdb_id, media_type, name, substr(content, 1, 600) AS content, _score FROM trope
			 WHERE match((name 5.0, content 1.0), ?) ${using}
			 AND media_tmdb_id IN (${ids.join(",")})
			 ORDER BY _score DESC LIMIT 400`,
			[terms],
		)
		if (!rows.length) continue
		const best = rows[0]._score
		for (const row of rows) {
			if (row._score < best / 2) break
			const key = `${row.media_type}:${row.media_tmdb_id}`
			const list = found.get(key) ?? []
			if (list.length < 3 && !list.some((t) => t.name === `trope: ${row.name}`)) {
				list.push({ name: `trope: ${row.name}`, text: stripHtml(row.content ?? ""), score: row._score / best })
			}
			found.set(key, list)
		}
		if (found.size >= 5 || mode === "any term") return { found, mode }
	}
	return { found, mode: "none" }
}

const DISPLAY_FIELDS = ["title", "release_year", "poster_path", "genres", "fingerprint_scores_v1", "is_anime", "production_method", ...FLAGS.filter((f) => f.qdrant?.key === f.id).map((f) => f.id)]

interface Query {
	weights: Partial<Record<Key, number>>
	vector: number[]
	order: "weighted_sum" | "cosine"
	// Decided genres shift the normalized score: +GENRE_BOOST per required genre the title has,
	// -GENRE_PENALTY per excluded genre it has. Empty means no genre layer.
	genres: GenreJudgment[]
}
const GENRE_BOOST = 0.3
const GENRE_PENALTY = 0.5

const retrieve = async (reading: Query, flags: FlagJudgment[], tropeQuery: string) => {
	const started = Date.now()
	const empty = { results: [] as Result[], ms: 0, tropeMs: 0, tropeMode: "none", pool: 0 }
	if (reading.vector.every((x) => x === 0)) return empty
	const used = Object.entries(reading.weights) as [Key, number][]
	const wide = reading.order === "weighted_sum" || Boolean(tropeQuery)
	// The pool carries only the used dimensions. Display fields are fetched for the final 20.
	const response = await getQdrant().query(MEDIA_COLLECTION, {
		query: reading.vector,
		using: "fingerprint_v1",
		filter: qdrantFilter(flags) as never,
		limit: wide ? options.pool : RESULTS,
		with_payload: [...used.map(([key]) => `fingerprint_scores_v1.${key}`), ...(reading.genres.length ? ["genres"] : [])],
	})
	const decidedGenres = reading.genres.filter((g) => g.decision)
	const genreShift = (genres: string[] | null | undefined) => {
		let shift = 0
		const matched: string[] = []
		for (const g of decidedGenres) {
			const has = (GENRES.find((x) => x.id === g.id)?.matches ?? []).some((name) => genres?.includes(name))
			if (!has) continue
			shift += g.decision === "required" ? GENRE_BOOST : -GENRE_PENALTY
			if (g.decision === "required") matched.push(g.id)
		}
		return { shift, matched }
	}
	const pool = response.points.map((point) => {
		const scores = (point.payload as unknown as Payload)?.fingerprint_scores_v1 ?? {}
		const { mediaType, tmdbId } = parsePointId(Number(point.id))
		return {
			id: point.id,
			media_type: mediaType,
			tmdb_id: tmdbId,
			cosine: point.score,
			weightedSum: used.reduce((sum, [key, weight]) => sum + weight * (scores[key] ?? 0), 0),
			genre: genreShift((point.payload as unknown as Payload)?.genres),
		}
	})
	const poolMs = Date.now() - started

	const tropeStarted = Date.now()
	const tropes = await tropeMatches(tropeQuery, [...new Set(pool.map((p) => p.tmdb_id))])
	const tropeMs = tropeQuery ? Date.now() - tropeStarted : 0

	// Base score is normalized to 0..1 within the pool, then a trope match adds up to TROPE_WEIGHT
	const base = (p: (typeof pool)[number]) => (reading.order === "weighted_sum" ? p.weightedSum : p.cosine)
	const values = pool.map(base)
	const min = Math.min(...values)
	const span = Math.max(...values) - min || 1
	const ranked = pool
		.map((p) => {
			const matches = tropes.found.get(`${p.media_type}:${p.tmdb_id}`) ?? []
			return { ...p, matches, combined: (base(p) - min) / span + p.genre.shift + TROPE_WEIGHT * (matches[0]?.score ?? 0) }
		})
		.sort((a, b) => b.combined - a.combined || b.cosine - a.cosine)
		.slice(0, RESULTS)

	const displayStarted = Date.now()
	const points = ranked.length
		? await getQdrant().retrieve(MEDIA_COLLECTION, { ids: ranked.map((r) => r.id), with_payload: DISPLAY_FIELDS })
		: []
	const payloads = new Map(points.map((point) => [String(point.id), point.payload as unknown as Payload]))
	const displayMs = Date.now() - displayStarted

	const results = ranked.map((r, i) => {
		const payload = payloads.get(String(r.id)) ?? ({} as Payload)
		const scores = payload.fingerprint_scores_v1 ?? {}
		const has = (f: Flag) =>
			f.media
				? f.media === r.media_type
				: f.id === "animated"
					? payload.production_method === "Animation"
					: f.id === "live_action"
						? payload.production_method === "Live-Action"
						: payload[f.id] === true
		const reasons: Result["reasons"] = []
		for (const judgment of flags) {
			const f = FLAGS.find((x) => x.id === judgment.id) as Flag
			if (judgment.decision === "required" && has(f)) reasons.push({ text: f.label, kind: "attribute" })
		}
		for (const genre of r.genre.matched) reasons.push({ text: `genre: ${genre}`, kind: "attribute" })
		for (const [key, weight] of used) {
			const value = scores[key]
			if (typeof value !== "number") continue
			if (weight > 0 && value >= 7) reasons.push({ text: `${label(key)} ${value}`, kind: "dimension" })
			else if (weight < 0 && value <= 3) reasons.push({ text: `low ${label(key)} ${value}`, kind: "dimension" })
			else if (weight > 0 && value <= 3) reasons.push({ text: `but ${label(key)} only ${value}`, kind: "mismatch" })
			else if (weight < 0 && value >= 7) reasons.push({ text: `but ${label(key)} ${value}`, kind: "mismatch" })
		}
		return {
			tmdb_id: r.tmdb_id,
			media_type: r.media_type,
			title: payload.title ?? `${r.media_type} ${r.tmdb_id}`,
			release_year: payload.release_year,
			poster_path: payload.poster_path ?? null,
			genres: payload.genres ?? [],
			rank: i + 1,
			weightedSum: r.weightedSum,
			cosine: r.cosine,
			combined: r.combined,
			tropes: r.matches,
			reasons,
			scores: used.map(([key, weight]) => ({ key, label: label(key), weight, value: scores[key] ?? null })),
		} satisfies Result
	})
	return { results, ms: poolMs + displayMs, tropeMs, tropeMode: tropes.mode, pool: pool.length }
}

// --- Text evidence channel (Crate full-text, no Jev call) -------------------------------------
// essence_text was written by a language model that knows each title, so it holds the concrete
// facts that the 74 dimensions can't express ("legendary car chases"). Evidence selects the pool,
// and the fingerprint weights rank inside it.

const TEXT_POOL = 300
const TEXT_BLEND = 0.5
const OPTIONAL_BONUS = 0.15

// No stemming in the index: search the word with and without a plural ending
const wordForms = (word: string) =>
	[...new Set([word, word.replace(/s$/, ""), word.replace(/es$/, ""), `${word}s`])].filter((form) => form.length > 2)

const flagSql = (flags: FlagJudgment[], table: "movie" | "show") => {
	const clauses: string[] = []
	for (const judgment of flags) {
		if (!judgment.decision) continue
		const f = FLAGS.find((x) => x.id === judgment.id) as Flag
		const wanted = judgment.decision === "required"
		const soft = f.id.startsWith("suitability_") || f.id.startsWith("context_")
		if (!wanted && soft) continue
		if (f.media) {
			if ((f.media === table) !== wanted) return null
			continue
		}
		const value = typeof f.qdrant?.value === "string" ? `'${f.qdrant.value}'` : String(f.qdrant?.value)
		const clause = `${f.qdrant?.key} = ${value}`
		clauses.push(wanted ? `(${clause})` : `NOT coalesce((${clause}), false)`)
	}
	return clauses.map((c) => ` AND ${c}`).join("")
}

interface TextRow {
	tmdb_id: number
	title: string
	release_year: number
	poster_path: string | null
	genres: string[] | null
	essence_text: string | null
	essence_tags: string[] | null
	fingerprint_scores: Record<string, number> | null
	is_anime: boolean | null
	production_method: string | null
	_score: number
	[flagColumn: string]: unknown
}

const retrieveByText = async (
	words: string[],
	// all: every word must match, which suits a short concrete phrase. any: a long whole request.
	mode: "all" | "any",
	weights: Partial<Record<Key, number>>,
	rank: "text" | "blend",
	flags: FlagJudgment[],
	// Words that don't have to match, but add OPTIONAL_BONUS each when the essence text or tags hold them
	optional: string[] = [],
) => {
	const started = Date.now()
	const used = Object.entries(weights) as [Key, number][]
	// The pool query carries only what ranking needs. Text and display fields come for the final 20.
	const columns = `tmdb_id, essence_tags, ${used.map(([key]) => `fingerprint_scores['${key}'] AS "fp_${key}"`).join(", ")}${used.length ? ", " : ""}_score`
	const fields = "(essence_text 2.0, synopsis)"
	const search = async (predicate: string, params: string[]) =>
		(
			await Promise.all(
				(["movie", "show"] as const).map(async (table) => {
					const filter = flagSql(flags, table)
					if (filter === null) return []
					return (
						await query<TextRow>(
							`SELECT ${columns} FROM ${table}
							 WHERE goodwatch_overall_score_voting_count >= ${MIN_VOTES} AND fingerprint_scores IS NOT NULL
							 AND ${predicate}${filter} ORDER BY _score DESC LIMIT ${TEXT_POOL}`,
							params,
						)
					).map((row) => ({ ...row, media_type: table }))
				}),
			)
		).flat()

	// The exact phrase counts most. Then every word must appear, in its singular or plural form.
	const phrase = words.map((w) => w.replace(/s$/, "")).join(" ")
	const [phraseRows, wordRows] = await Promise.all([
		mode === "all" && words.length > 1 ? search(`match(${fields}, ?) using phrase_prefix with (slop=1)`, [phrase]) : Promise.resolve([]),
		mode === "all"
			? search(words.map(() => `match(${fields}, ?)`).join(" AND "), words.map((w) => wordForms(w).join(" ")))
			: search(`match(${fields}, ?)`, [words.flatMap(wordForms).join(" ")]),
	])
	const best = Math.max(...wordRows.map((r) => r._score), ...phraseRows.map((r) => r._score), 1)
	const merged = new Map<string, TextRow & { media_type: "movie" | "show"; text: number; phrase: boolean }>()
	for (const row of wordRows) merged.set(`${row.media_type}:${row.tmdb_id}`, { ...row, text: row._score / best, phrase: false })
	for (const row of phraseRows) {
		const key = `${row.media_type}:${row.tmdb_id}`
		merged.set(key, { ...row, text: Math.max(merged.get(key)?.text ?? 0, row._score / best) + 1, phrase: true })
	}
	const pool = [...merged.values()]
		.map((row) => ({ row, weightedSum: used.reduce((sum, [key, weight]) => sum + weight * (Number(row[`fp_${key}`]) || 0), 0) }))
	const sums = pool.map((p) => p.weightedSum)
	const min = Math.min(...sums, 0)
	const span = Math.max(...sums, 1) - min || 1
	const forms = words.flatMap(wordForms)
	const optionalHits = (row: TextRow) => {
		const text = (row.essence_tags ?? []).join(" ").toLowerCase()
		return optional.filter((word) => wordForms(word).some((form) => text.includes(form)))
	}
	const ranked = pool
		.map((p) => ({
			...p,
			combined:
				rank === "text"
					? p.row.text
					: (p.weightedSum - min) / span + TEXT_BLEND * Math.min(p.row.text, 2) + OPTIONAL_BONUS * optionalHits(p.row).length,
		}))
		.sort((a, b) => b.combined - a.combined)
		.slice(0, RESULTS)
	const display = new Map<string, TextRow>()
	await Promise.all(
		(["movie", "show"] as const).map(async (table) => {
			const ids = ranked.filter((r) => r.row.media_type === table).map((r) => r.row.tmdb_id)
			if (!ids.length) return
			const rows = await query<TextRow>(
				`SELECT tmdb_id, title, release_year, poster_path, genres, essence_text, fingerprint_scores FROM ${table} WHERE tmdb_id IN (${ids.join(",")})`,
			)
			for (const row of rows) display.set(`${table}:${row.tmdb_id}`, row)
		}),
	)
	const results = ranked.map(({ row: poolRow, weightedSum, combined }, i) => {
			const row = { ...poolRow, ...(display.get(`${poolRow.media_type}:${poolRow.tmdb_id}`) ?? {}) }
			const scores = row.fingerprint_scores ?? {}
			const reasons: Result["reasons"] = []
			for (const [key, weight] of used) {
				const value = scores[key]
				if (typeof value !== "number") continue
				if (weight > 0 && value >= 7) reasons.push({ text: `${label(key)} ${value}`, kind: "dimension" })
				else if (weight < 0 && value <= 3) reasons.push({ text: `low ${label(key)} ${value}`, kind: "dimension" })
				else if (weight > 0 && value <= 3) reasons.push({ text: `but ${label(key)} only ${value}`, kind: "mismatch" })
				else if (weight < 0 && value >= 7) reasons.push({ text: `but ${label(key)} ${value}`, kind: "mismatch" })
			}
			const allForms = [...forms, ...optional.flatMap(wordForms)]
			const tags = (row.essence_tags ?? []).filter((tag) => allForms.some((form) => tag.toLowerCase().includes(form)))
			const evidence: TropeMatch[] = [
				...tags.slice(0, 3).map((tag) => ({ name: `tag: ${tag}`, text: row.essence_text ?? "", score: row.text })),
				...(tags.length ? [] : [{ name: row.phrase ? "text: phrase match" : "text: word match", text: row.essence_text ?? "", score: row.text }]),
			]
			return {
				tmdb_id: row.tmdb_id,
				media_type: row.media_type,
				title: row.title,
				release_year: row.release_year,
				poster_path: row.poster_path,
				genres: row.genres ?? [],
				rank: i + 1,
				weightedSum,
				cosine: 0,
				combined,
				tropes: evidence,
				reasons,
				scores: used.map(([key, weight]) => ({ key, label: label(key), weight, value: scores[key] ?? null })),
			} satisfies Result
		})
	return { results, ms: Date.now() - started, tropeMs: 0, tropeMode: mode === "all" ? "text, all words" : "text, any word", pool: pool.length }
}

// --- D4 family: Jev's phrase finds, B2 ranks, plus optional layers --------------------------------

interface PhraseSpec {
	// Search the second phrase too when Jev gives it SECOND_PHRASE or more. Matching both ranks first.
	twoPhrases?: boolean
	// No text search when the best phrase is one word that Jev marked as not concrete
	moodGate?: boolean
	// When the essence text finds too little: search TMDB keywords and trope names as well
	wider?: boolean
	// Jev selects, among the frequent tags of the first matches, the tags that express the request
	feedback?: boolean
	// Jev reads the request against the essence text of the top JUDGED titles and re-orders them
	judge?: boolean
}
const SECOND_PHRASE = 0.15
const JUDGED = 30
const FEEDBACK_TAGS = 24

interface PoolRow {
	key: string
	media_type: "movie" | "show"
	tmdb_id: number
	tags: string[]
	fp: Record<string, number>
	text: number
	evidence: string[]
}

const FIT_LEVELS = [
	"The evidence contradicts the request: the title is clearly the opposite of what is asked for",
	"Poor fit: the evidence shows little of what the request asks for",
	"Partial fit: some requested aspects are supported, others are missing or unclear",
	"Good fit: the evidence supports most of what the request asks for",
	"Excellent fit: the evidence directly and specifically supports everything the request asks for",
]

const runPhraseVariant = async (
	request: string,
	spec: PhraseSpec,
	attributes: Awaited<ReturnType<typeof readFlags>>,
	vectorQuery: Query,
) => {
	const started = Date.now()
	const notes: string[] = []
	const extra = newUsage()
	const used = Object.entries(vectorQuery.weights) as [Key, number][]
	const fpColumns = used.map(([key]) => `fingerprint_scores['${key}'] AS "fp_${key}"`).join(", ")

	// One pool query per table. `where` returns null to skip a table.
	const poolQuery = async (
		where: (table: "movie" | "show") => { sql: string; params: (string | number)[] } | null,
		scored: boolean,
	) =>
		(
			await Promise.all(
				(["movie", "show"] as const).map(async (table) => {
					const filter = flagSql(attributes.flags, table)
					const clause = where(table)
					if (filter === null || !clause) return []
					const rows = await query<Record<string, unknown>>(
						`SELECT tmdb_id, essence_tags${fpColumns ? `, ${fpColumns}` : ""}${scored ? ", _score" : ""} FROM ${table}
						 WHERE goodwatch_overall_score_voting_count >= ${MIN_VOTES} AND fingerprint_scores IS NOT NULL
						 AND ${clause.sql}${filter}${scored ? " ORDER BY _score DESC" : ""} LIMIT ${TEXT_POOL}`,
						clause.params,
					)
					return rows.map((row) => ({
						key: `${table}:${row.tmdb_id}`,
						media_type: table,
						tmdb_id: Number(row.tmdb_id),
						tags: (row.essence_tags as string[] | null) ?? [],
						fp: Object.fromEntries(used.map(([key]) => [key, Number(row[`fp_${key}`]) || 0])),
						score: Number(row._score) || 0,
					}))
				}),
			)
		).flat()

	const pool = new Map<string, PoolRow>()
	const add = (rows: Awaited<ReturnType<typeof poolQuery>>, text: (score: number) => number, evidence: (key: string) => string) => {
		for (const row of rows) {
			const entry = pool.get(row.key) ?? { ...row, text: 0, evidence: [] }
			entry.text += text(row.score)
			const label = evidence(row.key)
			if (label && !entry.evidence.includes(label)) entry.evidence.push(label)
			pool.set(row.key, entry)
		}
	}

	const fields = "(essence_text 2.0, synopsis)"
	const searchEssence = async (words: string[]) => {
		const phrase = words.map((w) => w.replace(/s$/, "")).join(" ")
		const [phraseRows, wordRows] = await Promise.all([
			words.length > 1
				? poolQuery(() => ({ sql: `match(${fields}, ?) using phrase_prefix with (slop=1)`, params: [phrase] }), true)
				: Promise.resolve([]),
			poolQuery(
				() => ({ sql: words.map(() => `match(${fields}, ?)`).join(" AND "), params: words.map((w) => wordForms(w).join(" ")) }),
				true,
			),
		])
		const best = Math.max(...wordRows.map((r) => r.score), ...phraseRows.map((r) => r.score), 1)
		const before = pool.size
		// A word match adds up to 1, and an exact phrase match adds 1 more
		add(wordRows, (score) => score / best, () => "")
		add(phraseRows, () => 1, () => `text: "${words.join(" ")}"`)
		return pool.size - before
	}

	const phrases = attributes.phrases
	const best = phrases[0]
	const bestWord = best && !best.phrase.includes(" ") ? attributes.split.find((w) => w.word === best.phrase) : undefined
	const gated = Boolean(spec.moodGate && bestWord && !bestWord.isConcrete)
	if (gated) notes.push(`Mood gate: "${best.phrase}" is a single mood word, so no text search runs.`)

	const searched: string[] = []
	if (best && !gated) {
		const first = [best, ...(spec.twoPhrases && phrases[1] && phrases[1].probability >= SECOND_PHRASE ? [phrases[1]] : [])]
		// Both phrases are known up front, so their searches run in parallel
		await Promise.all(first.map((p) => searchEssence(p.phrase.split(" "))))
		for (const p of first) {
			searched.push(p.phrase)
			notes.push(`Searched "${p.phrase}" (${(p.probability * 100).toFixed(0)}%).`)
		}
		// Too few matches: try the next phrases
		for (const p of phrases.slice(first.length, first.length + 3)) {
			if (pool.size >= RESULTS || p.probability < 0.01) break
			const found = await searchEssence(p.phrase.split(" "))
			searched.push(p.phrase)
			notes.push(`Too few matches, so "${p.phrase}" was searched too: ${found} new titles.`)
		}

		if (spec.wider && pool.size < RESULTS) {
			// The essence text holds too little. Search the concrete words alone, because a pair such
			// as "scifi sunglasses" never appears in a keyword or a trope name.
			const concrete = attributes.split.filter((w) => w.isConcrete).map((w) => w.word)
			const words = concrete.length ? concrete : best.phrase.split(" ")
			// Exact keyword values use the array index. A substring scan took 8 seconds.
			const keywordValues = [...new Set([words.join(" "), words.map((w) => w.replace(/s$/, "")).join(" "), ...words.flatMap(wordForms)])]
			const keywordRows = await poolQuery(
				() => ({ sql: `(${keywordValues.map(() => "? = ANY(keywords)").join(" OR ")})`, params: keywordValues }),
				false,
			)
			add(keywordRows, () => 0.8, () => `keyword: ${words.join(" ")}`)
			const tropeRows = await query<{ media_tmdb_id: number; media_type: "movie" | "show"; name: string }>(
				`SELECT media_tmdb_id, media_type, name FROM trope WHERE ${words.map(() => "match(name, ?)").join(" AND ")} LIMIT 5000`,
				words.map((w) => wordForms(w).join(" ")),
			)
			const tropeName = new Map(tropeRows.map((t) => [`${t.media_type}:${t.media_tmdb_id}`, t.name]))
			const titleRows = await poolQuery((table) => {
				const ids = [...new Set(tropeRows.filter((t) => t.media_type === table).map((t) => t.media_tmdb_id))].slice(0, 3000)
				return ids.length ? { sql: `tmdb_id IN (${ids.join(",")})`, params: [] } : null
			}, false)
			add(titleRows, () => 0.8, (key) => `trope: ${tropeName.get(key) ?? ""}`)
			notes.push(`Wider evidence for "${words.join(" ")}": ${keywordRows.length} titles by keyword, ${titleRows.length} by trope name.`)
		}

		if (spec.feedback && pool.size > 0) {
			const words = searched.flatMap((phrase) => phrase.split(" ")).flatMap(wordForms)
			const counts = new Map<string, number>()
			for (const row of [...pool.values()].sort((a, b) => b.text - a.text).slice(0, 50)) {
				for (const tag of row.tags) {
					if (words.some((form) => tag.toLowerCase().includes(form))) continue
					counts.set(tag, (counts.get(tag) ?? 0) + 1)
				}
			}
			const tags = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, FEEDBACK_TAGS).map(([tag]) => tag)
			if (tags.length) {
				const answers = await jev(
					extra,
					{ request, tags },
					Object.fromEntries(
						tags.map((_, i) => [
							`t${i}`,
							{
								type: "noul",
								instructions: `A person describes what they want to watch in \`request\`. Titles carry short descriptive tags. Does the tag \`tags[${i}]\` express the specific thing that the request asks for?`,
								criteria: {
									true: "A title with this tag very likely delivers the specific thing the request names",
									false: "The tag is only a general genre, mood, or quality, or it is about something else",
								},
							},
						]),
					),
				)
				const accepted = tags.filter((_, i) => (answers[`t${i}`] as NoulAnswer).noul >= 0.6)
				if (accepted.length) {
					const tagRows = await poolQuery(
						() => ({ sql: `(${accepted.map(() => "? = ANY(essence_tags)").join(" OR ")})`, params: accepted }),
						false,
					)
					const byKey = new Map(tagRows.map((r) => [r.key, r.tags.filter((t) => accepted.includes(t))]))
					add(tagRows, () => 0.7, (key) => `tag: ${byKey.get(key)?.[0] ?? ""}`)
					notes.push(`Tag feedback: Jev accepted ${accepted.length} of ${tags.length} tags (${accepted.slice(0, 5).join(", ")}). ${tagRows.length} titles carry one.`)
				} else {
					notes.push(`Tag feedback: Jev accepted none of ${tags.length} tags.`)
				}
			}
		}
	}

	// Rank: normalized B2 weighted sum, plus text evidence
	const rows = [...pool.values()].map((row) => ({
		...row,
		weightedSum: used.reduce((sum, [key, weight]) => sum + weight * (row.fp[key] ?? 0), 0),
	}))
	const sums = rows.map((r) => r.weightedSum)
	const min = Math.min(...sums, 0)
	const span = Math.max(...sums, 1) - min || 1
	let ranked = rows
		.map((r) => ({ ...r, combined: (r.weightedSum - min) / span + TEXT_BLEND * Math.min(r.text, 4) }))
		.sort((a, b) => b.combined - a.combined)
		.slice(0, spec.judge ? JUDGED : RESULTS)

	const display = new Map<string, TextRow>()
	await Promise.all(
		(["movie", "show"] as const).map(async (table) => {
			const ids = ranked.filter((r) => r.media_type === table).map((r) => r.tmdb_id)
			if (!ids.length) return
			const found = await query<TextRow>(
				// The essence text and the whole fingerprint made this query 9 times slower (398 ms against
				// 44 ms), so a judged run is the only case that still loads the text.
				`SELECT tmdb_id, title, release_year, poster_path, genres, essence_tags${spec.judge ? ", essence_text" : ""} FROM ${table} WHERE tmdb_id IN (${ids.join(",")})`,
			)
			for (const row of found) display.set(`${table}:${row.tmdb_id}`, row)
		}),
	)

	const fit = new Map<string, number>()
	if (spec.judge && ranked.length) {
		const batches: (typeof ranked)[] = []
		for (let i = 0; i < ranked.length; i += 8) batches.push(ranked.slice(i, i + 8))
		await Promise.all(
			batches.map(async (batch) => {
				const titles = batch.map((r) => {
					const d = display.get(r.key)
					return { media_type: r.media_type === "movie" ? "Movie" : "TV show", genres: d?.genres ?? [], description: d?.essence_text ?? "", tags: d?.essence_tags ?? [] }
				})
				const answers = await jev(
					extra,
					{ request, titles },
					Object.fromEntries(
						batch.map((_, i) => [
							`f${i}`,
							{
								type: "score",
								instructions: `A person describes what they want to watch in \`request\`. Judging only from the evidence in \`titles[${i}]\`, how well does this title fit the request? Don't use outside knowledge about the title.`,
								criteria: FIT_LEVELS,
							},
						]),
					),
				)
				batch.forEach((r, i) => fit.set(r.key, (answers[`f${i}`] as ScoreAnswer).score))
			}),
		)
		// Jev's fit decides, and the earlier order breaks ties
		ranked = ranked
			.map((r, i) => ({ r, i }))
			.sort((a, b) => Math.round((fit.get(b.r.key) ?? 0) * 4) - Math.round((fit.get(a.r.key) ?? 0) * 4) || a.i - b.i)
			.map(({ r }) => r)
			.slice(0, RESULTS)
		// Batches run in parallel, so the wall-clock time is about one request
		extra.ms = Math.round(extra.ms / Math.max(batches.length, 1))
		notes.push(`Jev judged the top ${fit.size} titles in ${batches.length} parallel requests.`)
	}

	const forms = searched.flatMap((phrase) => phrase.split(" ")).flatMap(wordForms)
	const results: Result[] = ranked.map((r, i) => {
		const d = display.get(r.key)
		// The pool rows already hold the stored score of every used dimension
		const scores: Record<string, number> = r.fp
		const reasons: Result["reasons"] = []
		for (const [key, weight] of used) {
			const value = scores[key]
			if (typeof value !== "number") continue
			if (weight > 0 && value >= 7) reasons.push({ text: `${label(key)} ${value}`, kind: "dimension" })
			else if (weight < 0 && value <= 3) reasons.push({ text: `low ${label(key)} ${value}`, kind: "dimension" })
			else if (weight > 0 && value <= 3) reasons.push({ text: `but ${label(key)} only ${value}`, kind: "mismatch" })
			else if (weight < 0 && value >= 7) reasons.push({ text: `but ${label(key)} ${value}`, kind: "mismatch" })
		}
		const tagHits = (d?.essence_tags ?? []).filter((tag) => forms.some((form) => tag.toLowerCase().includes(form))).map((tag) => `tag: ${tag}`)
		const labels = [...new Set([...(fit.has(r.key) ? [`Jev fit ${fit.get(r.key)?.toFixed(1)} of 4`] : []), ...tagHits, ...r.evidence.filter(Boolean)])]
		return {
			tmdb_id: r.tmdb_id,
			media_type: r.media_type,
			title: d?.title ?? r.key,
			release_year: d?.release_year ?? 0,
			poster_path: d?.poster_path ?? null,
			genres: d?.genres ?? [],
			rank: i + 1,
			weightedSum: r.weightedSum,
			cosine: 0,
			combined: r.combined,
			tropes: (labels.length ? labels : ["text: word match"]).slice(0, 4).map((name) => ({ name, text: d?.essence_text ?? "", score: r.text })),
			reasons,
			scores: used.map(([key, weight]) => ({ key, label: label(key), weight, value: scores[key] ?? null })),
		}
	})

	let ms = Date.now() - started - extra.ms
	if (results.length < RESULTS && vectorQuery.vector.some((x) => x !== 0)) {
		const fill = await retrieve(vectorQuery, attributes.flags, "")
		const seen = new Set(results.map((r) => `${r.media_type}:${r.tmdb_id}`))
		const found = results.length
		for (const r of fill.results) {
			if (results.length >= RESULTS) break
			if (!seen.has(`${r.media_type}:${r.tmdb_id}`)) results.push({ ...r, rank: results.length + 1 })
		}
		ms += fill.ms
		if (!gated) notes.push(`Only ${found} titles had evidence. The rest come from the B2 vector search.`)
	}
	return { results, ms, tropeMs: 0, tropeMode: gated ? "vector only" : searched.length ? `text: ${searched.join(" + ")}` : "vector only", pool: pool.size, notes, extra }
}

// --- Entry point -------------------------------------------------------------------------

export const runVectorComparison = async (request: string, chosen: Options) => {
	const started = Date.now()
	options = chosen
	const visible = VARIANTS.filter((v) => !v.hidden)
	const attributeReadings = new Map<"full" | "short", Awaited<ReturnType<typeof readFlags>>>()
	for (const criteria of new Set(visible.map((v) => v.attributeCriteria ?? "full"))) {
		attributeReadings.set(criteria, await readFlags(request, criteria))
	}
	const attributesFor = (v: Variant) => need(attributeReadings.get(v.attributeCriteria ?? "full"))
	// The page's shared sections show the first column's attribute reading
	const attributes = attributesFor(visible[0])
	const tropesActive =
		chosen.tropes === "always" || (chosen.tropes === "auto" && attributes.shape.specific >= TROPE_GATE)
	const tropeQuery = tropeTerms(request)

	// Readings run one after another so that each one's time is its own
	const needed = new Set(visible.flatMap((v) => v.needs))
	const readings: Readings = {
		wanted: needed.has("wanted") ? await readWanted(request) : undefined,
		wantAvoid: needed.has("wantAvoid") ? await readWantAvoid(request, "full") : undefined,
		wantAvoidShort: needed.has("wantAvoidShort") ? await readWantAvoid(request, "short") : undefined,
		archetypes: needed.has("archetypes") ? await readArchetypes(request) : undefined,
		genres: attributes.genres,
		attributes,
	}

	const strategies = []
	for (const variant of visible) {
		const attributes = attributesFor(variant)
		const built = variant.build({ ...readings, genres: attributes.genres, attributes })
		const textWords = built.text?.words ?? []
		if (built.text?.note) built.notes.push(built.text.note)
		const phraseRun = variant.phrase ? await runPhraseVariant(request, variant.phrase, attributes, built.query) : null
		if (phraseRun) built.notes.push(...phraseRun.notes)
		const retrieval = phraseRun
			? phraseRun
			: built.text && textWords.length
				? await retrieveByText(textWords, built.text.mode, built.query.weights, built.text.rank, attributes.flags, built.text.optional)
				: await retrieve(built.query, attributes.flags, tropesActive ? tropeQuery : "")
		// The best phrase found too little: try the next phrases, below the first matches
		for (const words of built.text?.alternatives ?? []) {
			if (!textWords.length || retrieval.results.length >= RESULTS) break
			const more = await retrieveByText(words, "all", built.query.weights, built.text?.rank ?? "blend", attributes.flags)
			const seen = new Set(retrieval.results.map((r) => `${r.media_type}:${r.tmdb_id}`))
			const before = retrieval.results.length
			for (const r of more.results) {
				if (retrieval.results.length >= RESULTS) break
				if (!seen.has(`${r.media_type}:${r.tmdb_id}`)) retrieval.results.push({ ...r, rank: retrieval.results.length + 1 })
			}
			retrieval.ms += more.ms
			built.notes.push(`"${textWords.join(" ")}" found ${before} titles, so "${words.join(" ")}" was searched too.`)
		}
		// Too little text evidence: fill the list from the vector search, below the evidence matches
		if (built.text && textWords.length && retrieval.results.length < RESULTS && built.query.vector.some((x) => x !== 0)) {
			const fill = await retrieve(built.query, attributes.flags, "")
			const seen = new Set(retrieval.results.map((r) => `${r.media_type}:${r.tmdb_id}`))
			const found = retrieval.results.length
			for (const r of fill.results) {
				if (retrieval.results.length >= RESULTS) break
				if (seen.has(`${r.media_type}:${r.tmdb_id}`)) continue
				retrieval.results.push({ ...r, rank: retrieval.results.length + 1 })
			}
			retrieval.ms += fill.ms
			built.notes.push(`Only ${found} titles had text evidence. The rest come from the vector search.`)
		}
		if (built.text) built.notes.push(textWords.length ? `Text search for: ${textWords.join(" ")}` : "No concrete words, so this column uses the B2 vector search.")
		const usages = variant.needs.map((n) => need(readings[n]).usage)
		const extra = phraseRun?.extra ?? newUsage()
		const usage: Usage = {
			requests: usages.reduce((sum, u) => sum + u.requests, 0) + extra.requests,
			questions: usages.reduce((sum, u) => sum + u.questions, 0) + extra.questions,
			tokens: usages.reduce((sum, u) => sum + u.tokens, 0) + extra.tokens,
			usd: usages.reduce((sum, u) => sum + u.usd, 0) + extra.usd,
			// Readings of one variant can run in parallel, so the slowest one counts. Extra Jev
			// requests depend on the first search, so their time adds up.
			ms: Math.max(0, ...usages.map((u) => u.ms)) + extra.ms,
		}
		strategies.push({
			id: variant.id,
			label: variant.label,
			description: variant.description,
			usage,
			order: built.query.order,
			used: Object.entries(built.query.weights)
				.map(([key, weight]) => ({ key, label: label(key), weight: weight as number }))
				.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
			details: [...built.details].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
			notes: built.notes,
			retrievalMs: retrieval.ms,
			tropeMs: retrieval.tropeMs,
			tropeMode: retrieval.tropeMode,
			pool: retrieval.pool,
			searchMs: usage.ms + retrieval.ms + retrieval.tropeMs,
			// A product runs the attribute request and the reading in parallel, then the database
			total: {
				tokens: usage.tokens + attributes.usage.tokens,
				usd: usage.usd + attributes.usage.usd,
				sequentialMs: attributes.usage.ms + usage.ms + retrieval.ms,
				parallelMs: Math.max(attributes.usage.ms, usage.ms) + retrieval.ms,
			},
			results: retrieval.results,
			attributes: {
				criteria: variant.attributeCriteria ?? "full",
				tokens: attributes.usage.tokens,
				ms: attributes.usage.ms,
				decided: attributes.flags.filter((f) => f.decision).map((f) => `${f.decision === "required" ? "must be" : "must not be"} ${f.label}`),
				phrase: attributes.phrases[0]?.phrase ?? "",
				concrete: attributes.split.filter((w) => w.isConcrete).map((w) => w.word),
			},
		})
	}
	return {
		request,
		options: chosen,
		attributes,
		tropesActive,
		tropeTerms: tropeQuery,
		kinds: (readings.archetypes?.scored ?? []).slice(0, 8).map((s) => ({ id: s.archetype.id, score: s.score, size: s.archetype.size, ...s.archetype.description })),
		strategies,
		stats: { ms: Date.now() - started },
	}
}

export type VectorComparison = Awaited<ReturnType<typeof runVectorComparison>>
