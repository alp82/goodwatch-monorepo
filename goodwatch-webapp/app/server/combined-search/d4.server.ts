// Locked D4+ (corrected), extracted from the accepted combined-search baseline.
// Question payloads, thresholds and ranking are preserved. No prototype transport or experiments.
import type {
	SystemOneRequest,
	Questions,
	SystemOneResult,
} from "@typesafe-ai/sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta";
import { MEDIA_COLLECTION, parsePointId } from "~/utils/qdrant";
import { VALID_FINGERPRINT_KEYS } from "../utils/fingerprint";
import { searchQuery as query } from "./catalog.server";
export interface Eligibility {
	includeAdult: boolean;
	lesserKnown: boolean;
}
const RESULTS = 100;
const FLAG_THRESHOLD = 0.6;
type Key = (typeof VALID_FINGERPRINT_KEYS)[number];
const label = (key: string) => FINGERPRINT_META[key]?.label ?? key;
const describe = (key: string) =>
	`"${label(key)}" (${FINGERPRINT_META[key]?.description ?? key})`;

interface Flag {
	id: string;
	label: string;
	description: string;
	qdrant?: { key: string; value: string | boolean };
	media?: "movie" | "show";
}
const flag = (
	id: string,
	label: string,
	description: string,
	qdrant?: Flag["qdrant"],
): Flag => ({
	id,
	label,
	description,
	qdrant: qdrant ?? { key: id, value: true },
});
const FLAGS: Flag[] = [
	{
		id: "movie",
		label: "Movie",
		description: "A feature film, not a series.",
		media: "movie",
	},
	{
		id: "show",
		label: "TV show",
		description: "A series with episodes, not a film.",
		media: "show",
	},
	flag("is_anime", "Anime", "Japanese-style animation (anime)."),
	flag(
		"animated",
		"Animated",
		"Any animated production, as opposed to live action.",
		{ key: "production_method", value: "Animation" },
	),
	flag("live_action", "Live action", "Filmed with real actors, not animated.", {
		key: "production_method",
		value: "Live-Action",
	}),
	flag("suitability_adults", "Adults", "Mature themes, not for kids."),
	flag("suitability_date_night", "Date night", "Great for a romantic evening."),
	flag(
		"suitability_family",
		"Family movie night",
		"Good for watching with the whole family.",
	),
	flag(
		"suitability_friends",
		"Friends night",
		"A fun watch with a group of friends.",
	),
	flag(
		"suitability_group_party",
		"Party vibe",
		"Lively and great for a group setting.",
	),
	flag(
		"suitability_intergenerational",
		"Intergenerational",
		"Enjoyable for a wide range of ages, for example with parents or grandparents.",
	),
	flag("suitability_kids", "Kids", "Made for children."),
	flag(
		"suitability_partner",
		"Partner watch",
		"Good to watch with a significant other.",
	),
	flag(
		"suitability_public_viewing_safe",
		"Public viewing safe",
		"No awkward scenes when watching in public.",
	),
	flag("suitability_solo_watch", "Solo watch", "Best enjoyed alone."),
	flag("suitability_teens", "Teens", "Aimed at a teenage audience."),
	flag(
		"context_is_background_friendly",
		"Background watch",
		"Doesn't require full attention.",
	),
	flag(
		"context_is_binge_friendly",
		"Binge-friendly",
		"Makes you want to watch episode after episode.",
	),
	flag(
		"context_is_comfort_watch",
		"Comfort watch",
		"Cozy, familiar, and reassuring.",
	),
	flag(
		"context_is_drop_in_friendly",
		"Drop-in friendly",
		"Easy to follow even if you miss a bit.",
	),
	flag(
		"context_is_pure_escapism",
		"Pure escapism",
		"Lets you completely disconnect from reality.",
	),
	flag(
		"context_is_thought_provoking",
		"Thought-provoking",
		"Leaves you with a lot to think about.",
	),
];

interface ScoreAnswer {
	type: "score";
	score: number;
	probabilities: Record<string, number>;
	confidence: number;
}
interface NoulAnswer {
	type: "noul";
	noul: number;
}
interface ChoiceAnswer {
	type: "choice";
	choice: string;
	probabilities: Record<string, number>;
	confidence: number;
}
type Answer = ScoreAnswer | NoulAnswer | ChoiceAnswer;

export interface Usage {
	requests: number;
	questions: number;
	tokens: number;
	usd: number;
	ms: number;
}
const newUsage = (): Usage => ({
	requests: 0,
	questions: 0,
	tokens: 0,
	usd: 0,
	ms: 0,
});

const sparseVector = (weights: Partial<Record<Key, number>>) =>
	VALID_FINGERPRINT_KEYS.map((k) => weights[k] ?? 0);

interface Detail {
	key: Key;
	label: string;
	text: string;
	weight: number;
}

const pick = (details: Detail[], keep: (d: Detail) => boolean, max: number) => {
	const weights: Partial<Record<Key, number>> = {};
	const kept = details
		.filter(keep)
		.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
		.slice(0, max);
	// Never return an empty reading: fall back to the single strongest dimension
	const chosen = kept.length
		? kept
		: [...details]
				.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
				.slice(0, 1);
	for (const d of chosen) weights[d.key] = d.weight;
	return weights;
};

export interface FlagJudgment {
	id: string;
	label: string;
	required: number;
	excluded: number;
	decision: "required" | "excluded" | null;
}

// TMDB genres, with the movie and TV spellings merged
const GENRES: { id: string; matches: string[] }[] = [
	["Drama"],
	["Comedy"],
	["Thriller"],
	["Action", "Action & Adventure"],
	["Crime"],
	["Romance"],
	["Horror"],
	["Mystery"],
	["Animation"],
	["Adventure", "Action & Adventure"],
	["Family"],
	["Science Fiction", "Sci-Fi & Fantasy"],
	["Fantasy", "Sci-Fi & Fantasy"],
	["Documentary"],
	["History"],
	["Music"],
	["War", "War & Politics"],
	["Western"],
	["Kids"],
	["Reality"],
	["Talk"],
	["Soap"],
	["News"],
].map((names) => ({ id: names[0], matches: names }));

// Search phrase candidates: single words and adjacent pairs inside each wanted clause
const phraseCandidates = (request: string) => {
	const candidates: string[] = [];
	for (const clause of request
		.toLowerCase()
		.split(/,|;|\bbut\b/)
		.map((c) => c.trim())) {
		if (!clause || NEGATIONS.test(clause)) continue;
		const words = clause
			.split(/[^a-z0-9'-]+/)
			.filter((w) => w.length > 2 && !STOPWORDS.has(w));
		words.forEach((w, i) => {
			candidates.push(w);
			if (i + 1 < words.length) candidates.push(`${w} ${words[i + 1]}`);
		});
	}
	return [...new Set(candidates)].slice(0, 20);
};

// D4+ uses the attribute flags, the concrete-word questions, and the phrase choice. The genre,
// request-shape, and "mention" questions only serve hidden columns, so they are left out.
// Questions can't see one another, so leaving some out doesn't change the remaining answers.
const LEAN_ATTRIBUTES = true;
const CONCRETE = 0.6;
const contentWords = (request: string) =>
	[...new Set(tropeTerms(request).split(" ").filter(Boolean))].slice(0, 12);

export interface GenreJudgment {
	id: string;
	required: number;
	excluded: number;
	decision: "required" | "excluded" | null;
}

// Short criteria: the intro sentence and the meaning of the three answers move into the state,
// which Jev reads once. Each of the 22 questions keeps only the attribute's name and description,
// and its three options carry no description.
const SHORT_ATTRIBUTE_TASK =
	"A person describes what they want to watch in `request`. Each attribute question names one attribute of a movie or show. Answer `required` when the request asks for it, directly or by clear implication. Answer `excluded` when the request rules it out. Answer `not_mentioned` when the request doesn't settle it.";

export const attributeRequest = (request: string): SystemOneRequest => {
	const criteria = "full" as string;
	const routing = false;
	const usage = newUsage();
	const questions: Questions = {};
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
							required:
								"The request asks for this attribute, directly or by clear implication",
							excluded:
								"The request rules this attribute out, directly or by clear implication",
							not_mentioned:
								"The request says nothing that settles this attribute",
						},
					};
	}
	for (const genre of LEAN_ATTRIBUTES ? [] : GENRES) {
		questions[`genre:${genre.id}`] = {
			type: "choice",
			instructions: `A person describes what they want to watch in \`request\`. What does the request say about the genre "${genre.id}"?`,
			criteria: {
				required:
					"The request asks for this genre, by name or by clear implication",
				excluded: "The request rules this genre out",
				not_mentioned:
					"The request neither asks for this genre nor rules it out",
			},
		};
	}
	if (!LEAN_ATTRIBUTES)
		questions.covered = {
			type: "noul",
			instructions:
				"A person describes what they want to watch in `request`. A search system can only express the request through the qualities in `available_qualities`. Can those qualities express everything the request asks for?",
			criteria: {
				true: "Every part of the request maps onto one or more of the listed qualities",
				false:
					"Some part of the request names a specific thing, motif, plot device, or character type that none of the listed qualities can express",
			},
		};
	if (!LEAN_ATTRIBUTES)
		questions.specific = {
			type: "noul",
			instructions:
				"A person describes what they want to watch in `request`. Does the request name a concrete thing, motif, plot device, or character type (for example an object, a profession, a story trope), as opposed to only moods, tones, genres, and styles?",
		};
	// Which words name something concrete? Dimension weights absorb mood and style words, and the
	// concrete words go to the text search. About 60 tokens per word, no extra Jev call.
	const words = contentWords(request);
	words.forEach((_, i) => {
		questions[`word:${i}`] = {
			type: "noul",
			instructions: `A person describes what they want to watch in \`request\`. Does the word \`words[${i}]\`, as used in the request, name something that would appear on screen or in the plot of the wanted title?`,
			criteria: {
				true: "It names a concrete thing: an object, vehicle, place, profession, kind of character, creature, event, or plot device",
				false:
					"It describes mood, tone, pace, intensity, quality, genre, or style, or it describes the viewing situation, such as who is watching or when",
			},
		};
	});
	// D5: would a written description of the ideal title mention this word? Unlike the concrete
	// question, this one follows the direction of the request: "little action" scores low.
	if (!LEAN_ATTRIBUTES)
		words.forEach((_, i) => {
			questions[`mention:${i}`] = {
				type: "noul",
				instructions: `A person describes what they want to watch in \`request\`. Would a good written description of the ideal title for this request mention the word \`words[${i}]\` or the idea behind it?`,
				criteria: {
					true: "The person wants this in the title, so a description of a fitting title would mention it",
					false:
						"The person wants little or none of it, or the word only describes the viewing situation",
				},
			};
		});
	// D4: Jev picks the one best search phrase among code-generated candidates, so there is always one
	const candidates = phraseCandidates(request);
	if (candidates.length > 1) {
		questions.phrase = {
			type: "choice",
			instructions:
				"A person describes what they want to watch in `request`. A search engine will look for one phrase in written descriptions of titles. Which phrase is the best search phrase: the one that most specifically names what the person wants to find in the title?",
			criteria: Object.fromEntries(candidates.map((c) => [c, null])),
		};
	}
	if (routing)
		questions.search_route = {
			type: "choice",
			instructions:
				"Using only the wording of `request`, which search action is intended? You have no catalog or title knowledge. A short name or fragment can be ambiguous. A comparison to a named work with additional preferences is a description request.",
			criteria: {
				lookup: "Find a particular movie, show, or person by name",
				description:
					"Discover something matching described content, mood, or preferences",
				uncertain:
					"The wording alone does not distinguish a name from a description or unfinished input",
			},
		};

	return { state: { request, words }, questions };
};
const decodeAttributes = (request: string, answers: Record<string, Answer>) => {
	const words = contentWords(request),
		candidates = phraseCandidates(request);
	const phraseAnswer = answers.phrase as ChoiceAnswer | undefined;
	const phrases = candidates
		.map((phrase) => ({
			phrase,
			probability: phraseAnswer ? (phraseAnswer.probabilities[phrase] ?? 0) : 1,
		}))
		.sort((a, b) => b.probability - a.probability);
	const split = words.map((word, i) => {
		const concrete = (answers[`word:${i}`] as NoulAnswer).noul;
		return {
			word,
			concrete,
			isConcrete: concrete >= CONCRETE,
			mention: (answers[`mention:${i}`] as NoulAnswer | undefined)?.noul ?? 0,
		};
	});
	const shape = {
		covered: (answers.covered as NoulAnswer | undefined)?.noul ?? 0,
		specific: (answers.specific as NoulAnswer | undefined)?.noul ?? 0,
	};
	const flags: FlagJudgment[] = FLAGS.map((f) => {
		const { probabilities } = answers[f.id] as ChoiceAnswer;
		const required = probabilities.required ?? 0;
		const excluded = probabilities.excluded ?? 0;
		return {
			id: f.id,
			label: f.label,
			required,
			excluded,
			decision:
				required >= FLAG_THRESHOLD
					? "required"
					: excluded >= FLAG_THRESHOLD
						? "excluded"
						: null,
		};
	});
	const genres: GenreJudgment[] = GENRES.map((genre) => {
		const probabilities =
			(answers[`genre:${genre.id}`] as ChoiceAnswer | undefined)
				?.probabilities ?? {};
		const required = probabilities.required ?? 0;
		const excluded = probabilities.excluded ?? 0;
		return {
			id: genre.id,
			required,
			excluded,
			decision:
				required >= FLAG_THRESHOLD
					? "required"
					: excluded >= FLAG_THRESHOLD
						? "excluded"
						: null,
		};
	});
	return { request, flags, genres, shape, split, phrases };
};

const SHORT_TASK =
	"A person describes what they want to watch in `request`. Each question names one quality of movies and shows. 'Asks for' includes clear implication. 'Avoid' includes wanting little of it.";
export const fingerprintRequest = (request: string): SystemOneRequest => {
	const wording = "short" as string;
	const usage = newUsage();
	const questions: Questions = {};
	for (const key of wording === "short" ? VALID_FINGERPRINT_KEYS : []) {
		questions[`want:${key}`] = {
			type: "noul",
			instructions: `Does \`request\` ask for ${describe(key)}?`,
		};
		questions[`avoid:${key}`] = {
			type: "noul",
			instructions: `Does \`request\` ask to avoid ${describe(key)}?`,
		};
	}
	for (const key of wording === "full" ? VALID_FINGERPRINT_KEYS : []) {
		questions[`want:${key}`] = {
			type: "noul",
			instructions: `A person describes what they want to watch in \`request\`. Does the request ask for the quality ${describe(key)}, directly or by clear implication?`,
		};
		questions[`avoid:${key}`] = {
			type: "noul",
			instructions: `A person describes what they want to watch in \`request\`. Does the request ask to avoid the quality ${describe(key)}, or to keep it low?`,
		};
	}

	return { state: { task: SHORT_TASK, request }, questions };
};
const decodeFingerprint = (answers: Record<string, Answer>) => {
	const details: Detail[] = VALID_FINGERPRINT_KEYS.map((key) => {
		const want = (answers[`want:${key}`] as NoulAnswer).noul;
		const avoid = (answers[`avoid:${key}`] as NoulAnswer).noul;
		return {
			key,
			label: label(key),
			weight: 2 * (want - avoid),
			text: `want ${(want * 100).toFixed(0)}%, avoid ${(avoid * 100).toFixed(0)}%`,
		};
	});
	return { details };
};

// Only identity attributes may exclude; audience and context exclusions are over-eager
const qdrantFilter = (flags: FlagJudgment[], eligibility: Eligibility) => {
	const must: unknown[] = eligibility.lesserKnown
		? []
		: [{ key: "goodwatch_overall_score_voting_count", range: { gte: 2000 } }];
	const must_not: unknown[] = eligibility.includeAdult
		? []
		: [{ key: "adult", match: { value: true } }];
	for (const judgment of flags) {
		if (!judgment.decision) continue;
		const f = FLAGS.find((x) => x.id === judgment.id) as Flag;
		const wanted = judgment.decision === "required";
		const soft = f.id.startsWith("suitability_") || f.id.startsWith("context_");
		if (!wanted && soft) continue;
		const condition = f.media
			? { key: "media_type", match: { value: f.media } }
			: { key: f.qdrant?.key, match: { value: f.qdrant?.value } };
		(wanted ? must : must_not).push(condition);
	}
	return { must, must_not };
};

// --- Retrieval ---------------------------------------------------------------------------

let qdrant: QdrantClient | undefined;
const getQdrant = () => {
	if (!qdrant) {
		const url = new URL(process.env.QDRANT_URL || "http://localhost:6333");
		if (url.port === "6334") url.port = "6333";
		qdrant = new QdrantClient({
			url: url.toString().replace(/\/$/, ""),
			apiKey: process.env.QDRANT_API_KEY,
			checkCompatibility: false,
			timeout: 8000,
		});
	}
	return qdrant;
};

interface Payload {
	title: string;
	release_year: number;
	poster_path: string | null;
	genres: string[] | null;
	fingerprint_scores_v1: Record<string, number>;
	is_anime: boolean | null;
	production_method: string | null;
	[flagColumn: string]: unknown;
}

export interface TropeMatch {
	name: string;
	text: string;
	score: number;
}

export interface Result {
	tmdb_id: number;
	media_type: "movie" | "show";
	title: string;
	release_year: number;
	poster_path: string | null;
	genres: string[];
	rank: number;
	weightedSum: number;
	cosine: number;
	combined: number;
	tropes: TropeMatch[];
	reasons: { text: string; kind: "attribute" | "dimension" | "mismatch" }[];
	scores: {
		key: string;
		label: string;
		weight: number;
		value: number | null;
	}[];
}

// --- Trope layer (Crate full-text, no Jev call) -------------------------------------------

const TROPE_GATE = 0.6;
const TROPE_WEIGHT = 1;
const NEGATIONS =
	/^(not|no|non|without|never|nothing|little|less|few|fewer|minimal|low|barely|hardly)\b/;
const STOPWORDS = new Set(
	"a an and the but or not no non without with for that this some something any anything to of in on at by my our your i we you it is are be goes go going like want wants very really little lot more less than too also about".split(
		" ",
	),
);

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
		.join(" ");

const stripHtml = (html: string) =>
	html
		.replace(/<[^>]+>/g, " ")
		.replace(/&[a-z#0-9]+;/gi, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 300);

interface TropeRow {
	media_tmdb_id: number;
	media_type: "movie" | "show";
	name: string;
	content: string | null;
	_score: number;
}

// Tropes are searched only among titles that already passed the dimension reading, so
// "scifi" acts through Futuristic and "sunglasses" acts through the trope match.
// The trope name counts five times as much as the passage. Phrase match first, then all
// terms, then any term. Hits below half of the best score are dropped.
const tropeMatches = async (terms: string, ids: number[]) => {
	const found = new Map<string, TropeMatch[]>();
	if (!terms || !ids.length) return { found, mode: "none" };
	const modes = [
		["phrase", "using phrase"],
		["all terms", "using best_fields with (operator='and')"],
		["any term", ""],
	] as const;
	for (const [mode, using] of modes) {
		if (mode === "phrase" && !terms.includes(" ")) continue;
		const rows = await query<TropeRow>(
			`SELECT media_tmdb_id, media_type, name, substr(content, 1, 600) AS content, _score FROM trope
			 WHERE match((name 5.0, content 1.0), ?) ${using}
			 AND media_tmdb_id IN (${ids.join(",")})
			 ORDER BY _score DESC LIMIT 400`,
			[terms],
		);
		if (!rows.length) continue;
		const best = rows[0]._score;
		for (const row of rows) {
			if (row._score < best / 2) break;
			const key = `${row.media_type}:${row.media_tmdb_id}`;
			const list = found.get(key) ?? [];
			if (
				list.length < 3 &&
				!list.some((t) => t.name === `trope: ${row.name}`)
			) {
				list.push({
					name: `trope: ${row.name}`,
					text: stripHtml(row.content ?? ""),
					score: row._score / best,
				});
			}
			found.set(key, list);
		}
		if (found.size >= 5 || mode === "any term") return { found, mode };
	}
	return { found, mode: "none" };
};

const DISPLAY_FIELDS = [
	"title",
	"release_year",
	"poster_path",
	"genres",
	"fingerprint_scores_v1",
	"is_anime",
	"production_method",
	...FLAGS.filter((f) => f.qdrant?.key === f.id).map((f) => f.id),
];

interface Query {
	weights: Partial<Record<Key, number>>;
	vector: number[];
	order: "weighted_sum" | "cosine";
	// Decided genres shift the normalized score: +GENRE_BOOST per required genre the title has,
	// -GENRE_PENALTY per excluded genre it has. Empty means no genre layer.
	genres: GenreJudgment[];
}
const GENRE_BOOST = 0.3;
const GENRE_PENALTY = 0.5;

const retrieve = async (
	reading: Query,
	flags: FlagJudgment[],
	tropeQuery: string,
	eligibility: Eligibility,
	resultLimit = RESULTS,
) => {
	const started = Date.now();
	const empty = {
		results: [] as Result[],
		ms: 0,
		tropeMs: 0,
		tropeMode: "none",
		pool: 0,
	};
	if (reading.vector.every((x) => x === 0)) return empty;
	const used = Object.entries(reading.weights) as [Key, number][];
	const wide = reading.order === "weighted_sum" || Boolean(tropeQuery);
	// The pool carries only the used dimensions. Display fields are fetched for the final 20.
	const response = await getQdrant().query(MEDIA_COLLECTION, {
		query: reading.vector,
		using: "fingerprint_v1",
		filter: qdrantFilter(flags, eligibility) as never,
		limit: wide ? 2000 : resultLimit,
		with_payload: [
			...used.map(([key]) => `fingerprint_scores_v1.${key}`),
			...(reading.genres.length ? ["genres"] : []),
		],
	});
	const decidedGenres = reading.genres.filter((g) => g.decision);
	const genreShift = (genres: string[] | null | undefined) => {
		let shift = 0;
		const matched: string[] = [];
		for (const g of decidedGenres) {
			const has = (GENRES.find((x) => x.id === g.id)?.matches ?? []).some(
				(name) => genres?.includes(name),
			);
			if (!has) continue;
			shift += g.decision === "required" ? GENRE_BOOST : -GENRE_PENALTY;
			if (g.decision === "required") matched.push(g.id);
		}
		return { shift, matched };
	};
	const pool = response.points.map((point) => {
		const scores =
			(point.payload as unknown as Payload)?.fingerprint_scores_v1 ?? {};
		const { mediaType, tmdbId } = parsePointId(Number(point.id));
		return {
			id: point.id,
			media_type: mediaType,
			tmdb_id: tmdbId,
			cosine: point.score,
			weightedSum: used.reduce(
				(sum, [key, weight]) => sum + weight * (scores[key] ?? 0),
				0,
			),
			genre: genreShift((point.payload as unknown as Payload)?.genres),
		};
	});
	const poolMs = Date.now() - started;

	const tropeStarted = Date.now();
	const tropes = await tropeMatches(tropeQuery, [
		...new Set(pool.map((p) => p.tmdb_id)),
	]);
	const tropeMs = tropeQuery ? Date.now() - tropeStarted : 0;

	// Base score is normalized to 0..1 within the pool, then a trope match adds up to TROPE_WEIGHT
	const base = (p: (typeof pool)[number]) =>
		reading.order === "weighted_sum" ? p.weightedSum : p.cosine;
	const values = pool.map(base);
	const min = Math.min(...values);
	const span = Math.max(...values) - min || 1;
	const ranked = pool
		.map((p) => {
			const matches = tropes.found.get(`${p.media_type}:${p.tmdb_id}`) ?? [];
			return {
				...p,
				matches,
				combined:
					(base(p) - min) / span +
					p.genre.shift +
					TROPE_WEIGHT * (matches[0]?.score ?? 0),
			};
		})
		.sort((a, b) => b.combined - a.combined || b.cosine - a.cosine)
		.slice(0, resultLimit);

	const displayStarted = Date.now();
	const points = ranked.length
		? await getQdrant().retrieve(MEDIA_COLLECTION, {
				ids: ranked.map((r) => r.id),
				with_payload: DISPLAY_FIELDS,
			})
		: [];
	const payloads = new Map(
		points.map((point) => [
			String(point.id),
			point.payload as unknown as Payload,
		]),
	);
	const displayMs = Date.now() - displayStarted;

	const results = ranked.map((r, i) => {
		const payload = payloads.get(String(r.id)) ?? ({} as Payload);
		const scores = payload.fingerprint_scores_v1 ?? {};
		const has = (f: Flag) =>
			f.media
				? f.media === r.media_type
				: f.id === "animated"
					? payload.production_method === "Animation"
					: f.id === "live_action"
						? payload.production_method === "Live-Action"
						: payload[f.id] === true;
		const reasons: Result["reasons"] = [];
		for (const judgment of flags) {
			const f = FLAGS.find((x) => x.id === judgment.id) as Flag;
			if (judgment.decision === "required" && has(f))
				reasons.push({ text: f.label, kind: "attribute" });
		}
		for (const genre of r.genre.matched)
			reasons.push({ text: `genre: ${genre}`, kind: "attribute" });
		for (const [key, weight] of used) {
			const value = scores[key];
			if (typeof value !== "number") continue;
			if (weight > 0 && value >= 7)
				reasons.push({ text: `${label(key)} ${value}`, kind: "dimension" });
			else if (weight < 0 && value <= 3)
				reasons.push({ text: `low ${label(key)} ${value}`, kind: "dimension" });
			else if (weight > 0 && value <= 3)
				reasons.push({
					text: `but ${label(key)} only ${value}`,
					kind: "mismatch",
				});
			else if (weight < 0 && value >= 7)
				reasons.push({ text: `but ${label(key)} ${value}`, kind: "mismatch" });
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
			scores: used.map(([key, weight]) => ({
				key,
				label: label(key),
				weight,
				value: scores[key] ?? null,
			})),
		} satisfies Result;
	});
	return {
		results,
		ms: poolMs + displayMs,
		tropeMs,
		tropeMode: tropes.mode,
		pool: pool.length,
	};
};

const TEXT_POOL = 300;
const TEXT_BLEND = 0.5;
const OPTIONAL_BONUS = 0.15;

// No stemming in the index: search the word with and without a plural ending
const wordForms = (word: string) =>
	[
		...new Set([
			word,
			word.replace(/s$/, ""),
			word.replace(/es$/, ""),
			`${word}s`,
		]),
	].filter((form) => form.length > 2);

const flagSql = (flags: FlagJudgment[], table: "movie" | "show") => {
	const clauses: string[] = [];
	for (const judgment of flags) {
		if (!judgment.decision) continue;
		const f = FLAGS.find((x) => x.id === judgment.id) as Flag;
		const wanted = judgment.decision === "required";
		const soft = f.id.startsWith("suitability_") || f.id.startsWith("context_");
		if (!wanted && soft) continue;
		if (f.media) {
			if ((f.media === table) !== wanted) return null;
			continue;
		}
		const value =
			typeof f.qdrant?.value === "string"
				? `'${f.qdrant.value}'`
				: String(f.qdrant?.value);
		const clause = `${f.qdrant?.key} = ${value}`;
		clauses.push(wanted ? `(${clause})` : `NOT coalesce((${clause}), false)`);
	}
	return clauses.map((c) => ` AND ${c}`).join("");
};

interface TextRow {
	tmdb_id: number;
	title: string;
	release_year: number;
	poster_path: string | null;
	genres: string[] | null;
	essence_text: string | null;
	essence_tags: string[] | null;
	fingerprint_scores: Record<string, number> | null;
	is_anime: boolean | null;
	production_method: string | null;
	_score: number;
	[flagColumn: string]: unknown;
}

interface PhraseSpec {
	// Search the second phrase too when Jev gives it SECOND_PHRASE or more. Matching both ranks first.
	twoPhrases?: boolean;
	// No text search when the best phrase is one word that Jev marked as not concrete
	moodGate?: boolean;
	// When the essence text finds too little: search TMDB keywords and trope names as well
	wider?: boolean;
	// Jev selects, among the frequent tags of the first matches, the tags that express the request
	feedback?: boolean;
	// Jev reads the request against the essence text of the top JUDGED titles and re-orders them
	judge?: boolean;
}
const SECOND_PHRASE = 0.15;
const JUDGED = 30;
const FEEDBACK_TAGS = 24;

interface PoolRow {
	key: string;
	media_type: "movie" | "show";
	tmdb_id: number;
	tags: string[];
	fp: Record<string, number>;
	text: number;
	evidence: string[];
}

const runPhraseVariant = async (
	request: string,
	spec: PhraseSpec,
	attributes: ReturnType<typeof decodeAttributes>,
	vectorQuery: Query,
	eligibility: Eligibility,
	resultLimit = RESULTS,
) => {
	const started = Date.now();
	const notes: string[] = [];
	const extra = newUsage();
	const used = Object.entries(vectorQuery.weights) as [Key, number][];
	const fpColumns = used
		.map(([key]) => `fingerprint_scores['${key}'] AS "fp_${key}"`)
		.join(", ");

	// One pool query per table. `where` returns null to skip a table.
	const poolQuery = async (
		where: (
			table: "movie" | "show",
		) => { sql: string; params: (string | number)[] } | null,
		scored: boolean,
	) =>
		(
			await Promise.all(
				(["movie", "show"] as const).map(async (table) => {
					const filter = flagSql(attributes.flags, table);
					const clause = where(table);
					if (filter === null || !clause) return [];
					const rows = await query<Record<string, unknown>>(
						`SELECT tmdb_id, essence_tags${fpColumns ? `, ${fpColumns}` : ""}${scored ? ", _score" : ""} FROM ${table}
						 WHERE ${eligibility.lesserKnown ? "true" : "goodwatch_overall_score_voting_count >= 2000"} AND ${eligibility.includeAdult ? "true" : "NOT coalesce(adult, false)"} AND essence_text IS NOT NULL
						 AND ${clause.sql}${filter}${scored ? " ORDER BY _score DESC" : ""} LIMIT ${TEXT_POOL}`,
						clause.params,
					);
					return rows.map((row) => ({
						key: `${table}:${row.tmdb_id}`,
						media_type: table,
						tmdb_id: Number(row.tmdb_id),
						tags: (row.essence_tags as string[] | null) ?? [],
						fp: Object.fromEntries(
							used.map(([key]) => [key, Number(row[`fp_${key}`]) || 0]),
						),
						score: Number(row._score) || 0,
					}));
				}),
			)
		).flat();

	const pool = new Map<string, PoolRow>();
	const add = (
		rows: Awaited<ReturnType<typeof poolQuery>>,
		text: (score: number) => number,
		evidence: (key: string) => string,
	) => {
		for (const row of rows) {
			const entry = pool.get(row.key) ?? { ...row, text: 0, evidence: [] };
			entry.text += text(row.score);
			const label = evidence(row.key);
			if (label && !entry.evidence.includes(label)) entry.evidence.push(label);
			pool.set(row.key, entry);
		}
	};

	const fields = "(essence_text 2.0, synopsis)";
	const searchEssence = async (words: string[]) => {
		const phrase = words.map((w) => w.replace(/s$/, "")).join(" ");
		const [phraseRows, wordRows] = await Promise.all([
			words.length > 1
				? poolQuery(
						() => ({
							sql: `match(${fields}, ?) using phrase_prefix with (slop=1)`,
							params: [phrase],
						}),
						true,
					)
				: Promise.resolve([]),
			poolQuery(
				() => ({
					sql: words.map(() => `match(${fields}, ?)`).join(" AND "),
					params: words.map((w) => wordForms(w).join(" ")),
				}),
				true,
			),
		]);
		const best = Math.max(
			...wordRows.map((r) => r.score),
			...phraseRows.map((r) => r.score),
			1,
		);
		const before = pool.size;
		// A word match adds up to 1, and an exact phrase match adds 1 more
		add(
			wordRows,
			(score) => score / best,
			() => "",
		);
		add(
			phraseRows,
			() => 1,
			() => `text: "${words.join(" ")}"`,
		);
		return pool.size - before;
	};

	const phrases = attributes.phrases;
	const best = phrases[0];
	const bestWord =
		best && !best.phrase.includes(" ")
			? attributes.split.find((w) => w.word === best.phrase)
			: undefined;
	const gated = Boolean(spec.moodGate && bestWord && !bestWord.isConcrete);
	if (gated)
		notes.push(
			`Mood gate: "${best.phrase}" is a single mood word, so no text search runs.`,
		);

	const searched: string[] = [];
	if (best && !gated) {
		const first = [
			best,
			...(spec.twoPhrases &&
			phrases[1] &&
			phrases[1].probability >= SECOND_PHRASE
				? [phrases[1]]
				: []),
		];
		// Both phrases are known up front, so their searches run in parallel
		await Promise.all(first.map((p) => searchEssence(p.phrase.split(" "))));
		for (const p of first) {
			searched.push(p.phrase);
			notes.push(
				`Searched "${p.phrase}" (${(p.probability * 100).toFixed(0)}%).`,
			);
		}
		// Too few matches: try the next phrases
		for (const p of phrases.slice(first.length, first.length + 3)) {
			if (pool.size >= resultLimit || p.probability < 0.01) break;
			const found = await searchEssence(p.phrase.split(" "));
			searched.push(p.phrase);
			notes.push(
				`Too few matches, so "${p.phrase}" was searched too: ${found} new titles.`,
			);
		}

		if (spec.wider && pool.size < resultLimit) {
			// The essence text holds too little. Search the concrete words alone, because a pair such
			// as "scifi sunglasses" never appears in a keyword or a trope name.
			const concrete = attributes.split
				.filter((w) => w.isConcrete)
				.map((w) => w.word);
			const words = concrete.length ? concrete : best.phrase.split(" ");
			// Exact keyword values use the array index. A substring scan took 8 seconds.
			const keywordValues = [
				...new Set([
					words.join(" "),
					words.map((w) => w.replace(/s$/, "")).join(" "),
					...words.flatMap(wordForms),
				]),
			];
			const keywordRows = await poolQuery(
				() => ({
					sql: `(${keywordValues.map(() => "? = ANY(keywords)").join(" OR ")})`,
					params: keywordValues,
				}),
				false,
			);
			add(
				keywordRows,
				() => 0.8,
				() => `keyword: ${words.join(" ")}`,
			);
			const tropeRows = await query<{
				media_tmdb_id: number;
				media_type: "movie" | "show";
				name: string;
			}>(
				`SELECT media_tmdb_id, media_type, name FROM trope WHERE ${words.map(() => "match(name, ?)").join(" AND ")} LIMIT 5000`,
				words.map((w) => wordForms(w).join(" ")),
			);
			const tropeName = new Map(
				tropeRows.map((t) => [`${t.media_type}:${t.media_tmdb_id}`, t.name]),
			);
			const titleRows = await poolQuery((table) => {
				const ids = [
					...new Set(
						tropeRows
							.filter((t) => t.media_type === table)
							.map((t) => t.media_tmdb_id),
					),
				].slice(0, 3000);
				return ids.length
					? { sql: `tmdb_id IN (${ids.join(",")})`, params: [] }
					: null;
			}, false);
			add(
				titleRows,
				() => 0.8,
				(key) => `trope: ${tropeName.get(key) ?? ""}`,
			);
			notes.push(
				`Wider evidence for "${words.join(" ")}": ${keywordRows.length} titles by keyword, ${titleRows.length} by trope name.`,
			);
		}
	}

	// Rank: normalized B2 weighted sum, plus text evidence
	const rows = [...pool.values()].map((row) => ({
		...row,
		weightedSum: used.reduce(
			(sum, [key, weight]) => sum + weight * (row.fp[key] ?? 0),
			0,
		),
	}));
	const sums = rows.map((r) => r.weightedSum);
	const min = Math.min(...sums, 0);
	const span = Math.max(...sums, 1) - min || 1;
	let ranked = rows
		.map((r) => ({
			...r,
			combined: (r.weightedSum - min) / span + TEXT_BLEND * Math.min(r.text, 4),
		}))
		.sort((a, b) => b.combined - a.combined)
		.slice(0, resultLimit);

	const display = new Map<string, TextRow>();
	await Promise.all(
		(["movie", "show"] as const).map(async (table) => {
			const ids = ranked
				.filter((r) => r.media_type === table)
				.map((r) => r.tmdb_id);
			if (!ids.length) return;
			const found = await query<TextRow>(
				// The essence text and the whole fingerprint made this query 9 times slower (398 ms against
				// 44 ms), so a judged run is the only case that still loads the text.
				`SELECT tmdb_id, title, release_year, poster_path, genres, essence_tags FROM ${table} WHERE tmdb_id IN (${ids.join(",")})`,
			);
			for (const row of found) display.set(`${table}:${row.tmdb_id}`, row);
		}),
	);

	const forms = searched
		.flatMap((phrase) => phrase.split(" "))
		.flatMap(wordForms);
	const results: Result[] = ranked.map((r, i) => {
		const d = display.get(r.key);
		// The pool rows already hold the stored score of every used dimension
		const scores: Record<string, number> = r.fp;
		const reasons: Result["reasons"] = [];
		for (const [key, weight] of used) {
			const value = scores[key];
			if (typeof value !== "number") continue;
			if (weight > 0 && value >= 7)
				reasons.push({ text: `${label(key)} ${value}`, kind: "dimension" });
			else if (weight < 0 && value <= 3)
				reasons.push({ text: `low ${label(key)} ${value}`, kind: "dimension" });
			else if (weight > 0 && value <= 3)
				reasons.push({
					text: `but ${label(key)} only ${value}`,
					kind: "mismatch",
				});
			else if (weight < 0 && value >= 7)
				reasons.push({ text: `but ${label(key)} ${value}`, kind: "mismatch" });
		}
		const tagHits = (d?.essence_tags ?? [])
			.filter((tag) => forms.some((form) => tag.toLowerCase().includes(form)))
			.map((tag) => `tag: ${tag}`);
		const labels = [...new Set([...tagHits, ...r.evidence.filter(Boolean)])];
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
			tropes: (labels.length ? labels : ["text: word match"])
				.slice(0, 4)
				.map((name) => ({ name, text: d?.essence_text ?? "", score: r.text })),
			reasons,
			scores: used.map(([key, weight]) => ({
				key,
				label: label(key),
				weight,
				value: scores[key] ?? null,
			})),
		};
	});

	let ms = Date.now() - started - extra.ms;
	if (results.length < resultLimit && vectorQuery.vector.some((x) => x !== 0)) {
		const fill = await retrieve(
			vectorQuery,
			attributes.flags,
			"",
			eligibility,
			resultLimit,
		);
		const seen = new Set(results.map((r) => `${r.media_type}:${r.tmdb_id}`));
		const found = results.length;
		for (const r of fill.results) {
			if (results.length >= resultLimit) break;
			if (!seen.has(`${r.media_type}:${r.tmdb_id}`))
				results.push({ ...r, rank: results.length + 1 });
		}
		ms += fill.ms;
		if (!gated)
			notes.push(
				`Only ${found} titles had evidence. The rest come from the B2 vector search.`,
			);
	}
	return {
		results,
		ms,
		tropeMs: 0,
		tropeMode: gated
			? "vector only"
			: searched.length
				? `text: ${searched.join(" + ")}`
				: "vector only",
		pool: pool.size,
		notes,
		extra,
	};
};

export async function retrieveD4(
	request: string,
	readings: [SystemOneResult<Questions>, SystemOneResult<Questions>],
	eligibility: Eligibility,
	nativeOnly: boolean,
) {
	const attributes = decodeAttributes(
		request,
		readings[0].answers as Record<string, Answer>,
	);
	const reading = decodeFingerprint(
		readings[1].answers as Record<string, Answer>,
	);
	const weights = pick(
		reading.details,
		(d) => d.weight >= 0.6 || d.weight <= -1.2,
		74,
	);
	const vectorQuery: Query = {
		weights,
		vector: sparseVector(weights),
		order: "weighted_sum",
		genres: [],
	};
	if (nativeOnly)
		return (await retrieve(vectorQuery, attributes.flags, "", eligibility))
			.results;
	return (
		await runPhraseVariant(
			request,
			{ twoPhrases: true, moodGate: true, wider: true },
			attributes,
			vectorQuery,
			eligibility,
		)
	).results;
}
