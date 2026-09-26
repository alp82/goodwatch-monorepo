// Search by Jev reading: the two Jev questionnaires (attributes and fingerprint), how their answers are decoded into
// the fields the ranking reads (search-ranking/rank-search.server.ts), the reading chips, and the display fields and
// reason chips of the ranked titles. Question payloads and thresholds are the accepted combined-search baseline. The
// Jev contract and question version strings are cache keys: don't rename them.
import type {
	SystemOneRequest,
	Questions,
	SystemOneResult,
} from "@typesafe-ai/sdk";
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta";
import { MEDIA_COLLECTION } from "~/utils/qdrant";
import { VALID_FINGERPRINT_KEYS } from "../utils/fingerprint";
import { retrievePoints } from "../search-ranking/qdrant-http.server";
import type { SearchFilters } from "./search-filters";
// --- Tunables ----------------------------------------------------------------------------
// The thresholds that decode the reading. Probabilities are Jev outputs in 0..1.

// A flag or genre becomes "required" or "excluded" when Jev's probability for that choice
// reaches this value. Below it, the flag is ignored.
const FLAG_DECISION_PROBABILITY = 0.5;
// A request word counts as concrete (a thing worth a text search) at this probability.
// Mood and style words stay below it and are covered by the fingerprint dimensions instead.
const CONCRETE_WORD_PROBABILITY = 0.6;
// Ask Jev only the attribute flags, the concrete-word questions, and the phrase choice. The
// genre, request-shape, and "mention" questions only serve hidden columns. Questions can't see
// one another, so leaving some out doesn't change the remaining answers.
const LEAN_ATTRIBUTE_QUESTIONS = true;
// A fingerprint dimension weighs 2 * (want - avoid), so it ranges from -2 to 2. It enters the
// query vector when the net want reaches WANT_WEIGHT_MIN or the net avoid reaches
// AVOID_WEIGHT_MIN. Avoiding needs a stronger signal because it excludes more than it finds.
const WANT_WEIGHT_MIN = 0.5;
const AVOID_WEIGHT_MIN = 1.2;
// Upper bound on dimensions in the query vector. Set above the dimension count, so it never cuts.
const MAX_QUERY_DIMENSIONS = 74;
// The second-best phrase counts as searched when Jev gives it this probability.
const SECOND_PHRASE_PROBABILITY = 0.15;
// How many fingerprint dimensions the reading chips show to the person.
const READING_CHIP_DIMENSIONS = 8;
// Fingerprint scores run 0..10. A result gets a reason chip for a wanted dimension at or above
// STRONG_SCORE_MIN, and for an avoided dimension at or below WEAK_SCORE_MAX. The opposite
// cases become "mismatch" reasons, which the UI hides.
const STRONG_SCORE_MIN = 6;
const WEAK_SCORE_MAX = 4;

const isQueryDimension = (d: { weight: number }) =>
	d.weight >= WANT_WEIGHT_MIN || d.weight <= -AVOID_WEIGHT_MIN;

export interface Eligibility {
	includeAdult: boolean;
	lesserKnown: boolean;
	// Chip filters, validated by the route. ANDed with the flags; a chip type overrides a media flag.
	filters?: SearchFilters;
}
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

// The search uses the attribute flags, the concrete-word questions, and the phrase choice. The genre,
// request-shape, and "mention" questions only serve hidden columns, so they are left out.
// Questions can't see one another, so leaving some out doesn't change the remaining answers.
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
	for (const genre of LEAN_ATTRIBUTE_QUESTIONS ? [] : GENRES) {
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
	if (!LEAN_ATTRIBUTE_QUESTIONS)
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
	if (!LEAN_ATTRIBUTE_QUESTIONS)
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
	// Would a written description of the ideal title mention this word? Unlike the concrete
	// question, this one follows the direction of the request: "little action" scores low.
	if (!LEAN_ATTRIBUTE_QUESTIONS)
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
	// Jev picks the one best search phrase among code-generated candidates, so there is always one
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
			isConcrete: concrete >= CONCRETE_WORD_PROBABILITY,
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
				required >= FLAG_DECISION_PROBABILITY
					? "required"
					: excluded >= FLAG_DECISION_PROBABILITY
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
				required >= FLAG_DECISION_PROBABILITY
					? "required"
					: excluded >= FLAG_DECISION_PROBABILITY
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

// --- Display fields ------------------------------------------------------------------------

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

// A result's reason chips: the required flags it has, the required genres it matched, and each used fingerprint
// dimension that is strong where wanted or weak where avoided ("mismatch" for the opposite, which the UI hides).
function payloadReasons(
	payload: Payload,
	mediaType: "movie" | "show",
	flags: FlagJudgment[],
	matchedGenres: string[],
	used: [Key, number][],
): Result["reasons"] {
	const scores = payload.fingerprint_scores_v1 ?? {};
	const has = (f: Flag) =>
		f.media
			? f.media === mediaType
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
	for (const genre of matchedGenres)
		reasons.push({ text: `genre: ${genre}`, kind: "attribute" });
	for (const [key, weight] of used) {
		const value = scores[key];
		if (typeof value !== "number") continue;
		if (weight > 0 && value >= STRONG_SCORE_MIN)
			reasons.push({ text: `${label(key)} ${value}`, kind: "dimension" });
		else if (weight < 0 && value <= WEAK_SCORE_MAX)
			reasons.push({ text: `low ${label(key)} ${value}`, kind: "dimension" });
		else if (weight > 0 && value <= WEAK_SCORE_MAX)
			reasons.push({
				text: `but ${label(key)} only ${value}`,
				kind: "mismatch",
			});
		else if (weight < 0 && value >= STRONG_SCORE_MIN)
			reasons.push({ text: `but ${label(key)} ${value}`, kind: "mismatch" });
	}
	return reasons;
}

/**
 * The display fields and reason chips of a list another ranker ranked, in its order: one Qdrant read of the titles'
 * payloads. The ranks follow the list; the score fields other rankers don't have stay 0.
 */
export async function describeTitles(
	fields: ReadingFields,
	titles: { tmdbId: number; mediaType: "movie" | "show" }[],
	options: { timeoutMs?: number } = {},
): Promise<Result[]> {
	if (!titles.length) return [];
	const pointIdOf = (t: (typeof titles)[number]) =>
		(t.mediaType === "show" ? 2 : 1) * 1_000_000_000_000 + t.tmdbId;
	const points = await retrievePoints(
		MEDIA_COLLECTION,
		{ ids: titles.map(pointIdOf), with_payload: DISPLAY_FIELDS },
		options,
	);
	const payloads = new Map(
		points.map((point) => [
			Number(point.id),
			point.payload as unknown as Payload,
		]),
	);
	const used = Object.entries(fields.weights) as [Key, number][];
	return titles.flatMap((t, i) => {
		const payload = payloads.get(pointIdOf(t));
		if (!payload) return [];
		const scores = payload.fingerprint_scores_v1 ?? {};
		return [
			{
				tmdb_id: t.tmdbId,
				media_type: t.mediaType,
				title: payload.title ?? `${t.mediaType} ${t.tmdbId}`,
				release_year: payload.release_year,
				poster_path: payload.poster_path ?? null,
				genres: payload.genres ?? [],
				rank: i + 1,
				weightedSum: 0,
				cosine: 0,
				combined: 0,
				tropes: [],
				reasons: payloadReasons(payload, t.mediaType, fields.flags, [], used),
				scores: used.map(([key, weight]) => ({
					key,
					label: label(key),
					weight,
					value: scores[key] ?? null,
				})),
			} satisfies Result,
		];
	});
}

export interface ReadingChip {
	text: string;
	// attribute: a required flag; excluded: a ruled-out flag; want/avoid: a fingerprint
	// dimension the retrieval weights; phrase: text that the essence search looks for.
	kind: "attribute" | "excluded" | "want" | "avoid" | "phrase";
}
// The phrases the text search looks for: Jev's best phrase and, when it reaches
// SECOND_PHRASE_PROBABILITY, the second one. None when the best phrase is a single word that Jev
// marked as not concrete (a mood word, which the fingerprint dimensions cover).
const searchedPhrases = (attributes: ReturnType<typeof decodeAttributes>) => {
	const best = attributes.phrases[0];
	const bestWord =
		best && !best.phrase.includes(" ")
			? attributes.split.find((w) => w.word === best.phrase)
			: undefined;
	const gated = Boolean(bestWord && !bestWord.isConcrete);
	if (!best || gated) return [];
	return [
		best,
		...(attributes.phrases[1] &&
		attributes.phrases[1].probability >= SECOND_PHRASE_PROBABILITY
			? [attributes.phrases[1]]
			: []),
	];
};

// The interpretation shown to the person before results arrive. It uses the same
// decisions, thresholds, and phrase rule as readingFields, so the chips describe what
// the search actually looks for.
export function summarizeReading(
	request: string,
	readings: [SystemOneResult<Questions>, SystemOneResult<Questions>],
	nativeOnly: boolean,
): ReadingChip[] {
	const attributes = decodeAttributes(
		request,
		readings[0].answers as Record<string, Answer>,
	);
	const reading = decodeFingerprint(
		readings[1].answers as Record<string, Answer>,
	);
	const weights = pick(reading.details, isQueryDimension, MAX_QUERY_DIMENSIONS);
	const chips: ReadingChip[] = [];
	for (const judgment of attributes.flags) {
		if (!judgment.decision) continue;
		const f = FLAGS.find((x) => x.id === judgment.id) as Flag;
		const soft = f.id.startsWith("suitability_") || f.id.startsWith("context_");
		if (judgment.decision === "excluded" && soft) continue;
		if (judgment.decision === "required")
			chips.push({ text: f.label, kind: "attribute" });
		else chips.push({ text: `Not ${f.label.toLowerCase()}`, kind: "excluded" });
	}
	const dimensions = (Object.entries(weights) as [Key, number][])
		.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
		.slice(0, READING_CHIP_DIMENSIONS);
	for (const [key, weight] of dimensions)
		chips.push({
			text: weight > 0 ? label(key) : `Low ${label(key).toLowerCase()}`,
			kind: weight > 0 ? "want" : "avoid",
		});
	if (!nativeOnly)
		for (const p of searchedPhrases(attributes))
			chips.push({ text: `“${p.phrase}”`, kind: "phrase" });
	return chips;
}

// What a flag decision filters on, and how: "media" (movie or show), "identity" (anime,
// animation, live action: required and excluded both filter) or "soft" (audience and context:
// only a required decision filters).
export type FlagKind = "media" | "identity" | "soft";
export interface ReadingFlag extends FlagJudgment {
	kind: FlagKind;
	// The Qdrant payload condition the flag stands for.
	condition: { key: string; value: string | boolean };
}
export interface ReadingFields {
	flags: ReadingFlag[];
	// The request words Jev judged; isConcrete marks words that name something on screen.
	concreteWords: { word: string; concrete: number; isConcrete: boolean }[];
	// The phrases the text search looks for (see searchedPhrases), whatever the language mode.
	searchedPhrases: { phrase: string; probability: number }[];
	// The fingerprint query weights: 2 * (want - avoid) per used dimension.
	weights: Partial<Record<Key, number>>;
	// The same weights as a vector in fingerprint dimension order (fingerprint_v1 and fingerprint_v1_raw).
	vector: number[];
	chips: ReadingChip[];
}

const flagKind = (f: Flag): FlagKind =>
	f.media
		? "media"
		: f.id.startsWith("suitability_") || f.id.startsWith("context_")
			? "soft"
			: "identity";

// The decoded reading, for the ranking.
export function readingFields(
	request: string,
	readings: [SystemOneResult<Questions>, SystemOneResult<Questions>],
	nativeOnly: boolean,
): ReadingFields {
	const attributes = decodeAttributes(
		request,
		readings[0].answers as Record<string, Answer>,
	);
	const reading = decodeFingerprint(
		readings[1].answers as Record<string, Answer>,
	);
	const weights = pick(reading.details, isQueryDimension, MAX_QUERY_DIMENSIONS);
	return {
		flags: attributes.flags.map((judgment) => {
			const f = FLAGS.find((x) => x.id === judgment.id) as Flag;
			return {
				...judgment,
				kind: flagKind(f),
				condition: f.media
					? { key: "media_type", value: f.media }
					: {
							key: f.qdrant?.key as string,
							value: f.qdrant?.value as string | boolean,
						},
			};
		}),
		concreteWords: attributes.split.map(({ word, concrete, isConcrete }) => ({
			word,
			concrete,
			isConcrete,
		})),
		searchedPhrases: searchedPhrases(attributes),
		weights,
		vector: sparseVector(weights),
		chips: summarizeReading(request, readings, nativeOnly),
	};
}
