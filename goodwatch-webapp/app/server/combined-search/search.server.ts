import { fetch } from "undici";
import { withBackendTimeout } from "../../utils/backend-timeout.ts";
import {
	aliasMatch,
	blend,
	titleMatch,
	type MatchedAlias,
	type Title,
	type Row,
} from "~/ui/search/search-model";
import {
	attributeRequest,
	describeTitles,
	fingerprintRequest,
	readingFields,
	summarizeReading,
	type Eligibility,
	type ReadingChip,
	type Result,
} from "./reading-retrieval.server";
import { allowsTitle, toCrateSql } from "./search-filters";
import {
	eligible,
	exactCatalogTitles,
	metadataFor,
	searchQuery,
	type Metadata,
} from "./catalog.server";
import { prepareLanguage } from "./language.server";
import { RankingProgress } from "../search-ranking/ranking-progress.server";
import {
	BASIC_SEARCH_MESSAGE,
	keepJevConnectionsWarm,
	runJevStage,
	recordSearchHistory,
	type JevStageInput,
	type JevOutcome,
	translationEnabled,
} from "../search-runtime/runtime.server";
import {
	RankingDeadlineError,
	rankForServing,
	servingFallback,
	startSearchRanking,
	type ServingFallback,
} from "../search-ranking/serve.server";
import {
	type PreparedSearch,
	type RankedSearch,
	prepareSearch,
} from "../search-ranking/rank-search.server";
import { readingsConfigured } from "../search-runtime/limits.server";
import { searchAdmission } from "../search-runtime/admission.server";
import { HEAD_LENGTH } from "../search-ranking/ranking.server";
import { STOPWORDS, words } from "../search-ranking/text-rules.server";
import { ELIGIBLE_VOTES } from "../search-ranking/search-filter.server";
import {
	type CreditScope,
	type LookupPerson,
	type PeopleReading,
	type SearchPerson,
	peopleToShow,
	readPeople,
	startPeopleIndex,
} from "../search-people/people.server";
import { runsSearch } from "../role.server";
import { paletteLookupTitles } from "../command-palette.server";
import { loadedAliasVersion } from "../search-ranking/search-index.server";
import { titleLookupKey } from "./title-lookup-key.server";

// A page instance loads none of it (see role.server.ts).
if (runsSearch()) {
	// The index loads at server start; query models load only when the storage key allows readings.
	startSearchRanking({ queryModels: readingsConfigured() });
	// The names a search can find inside a phrase load at server start too.
	startPeopleIndex();
	// The connections to TypeSafe stay open between searches.
	keepJevConnectionsWarm();
}

export interface SearchBatch {
	q: string;
	rows: Row[];
	// The interpretation the search used; empty when it ran as a basic search.
	reading: ReadingChip[];
	metadata: Metadata[];
	errors: string[];
	// The language step's mode; UNKNOWN_MODE on a batch sent before that step finished.
	mode: string;
	elapsedMs: number;
	chargedNano: number;
	/** Initial results are usable while the original title/person lookup is still running. */
	pendingTitleLookup?: boolean;
	/** The title and people matches are usable while the reading and the ranking are still running. */
	pendingRanking?: boolean;
	// People the query names, shown above the titles.
	people: SearchPerson[];
	creditScope: CreditScope | null;
}
/**
 * What a streaming callback answers for one batch: false when the batch did not reach the person (the stream had
 * closed), anything else when it did. A callback that returns nothing delivered its batch.
 */
export type BatchDelivery = void | boolean;
// Title lookups depend only on the text, the adult policy, and the alias rules version of the
// loaded index (localized names), never on filter chips, so filter-only refetches reuse them.
// Search text is private: entries stay in this process, keyed by a digest, and are never
// written to a shared store or logged.
const TITLE_TTL_MS = 10 * 60 * 1000;
const TITLE_ENTRIES = 200;
interface TitleLookup {
	titles: Title[];
	people: LookupPerson[];
	complete: boolean;
}
const titleCache = new Map<string, { at: number; value: TitleLookup }>();
const titleFlights = new Map<string, Promise<TitleLookup>>();
function titles(
	q: string,
	policy: Eligibility,
	signal: AbortSignal,
): Promise<TitleLookup> {
	const key = titleLookupKey(q, policy.includeAdult, loadedAliasVersion());
	const hit = titleCache.get(key);
	if (hit && Date.now() - hit.at < TITLE_TTL_MS) {
		// Refresh recency so eviction drops the least recently used entry.
		titleCache.delete(key);
		titleCache.set(key, hit);
		return Promise.resolve(hit.value);
	}
	if (hit) titleCache.delete(key);
	let flight = titleFlights.get(key);
	if (!flight) {
		// The shared lookup ignores caller signals: one caller leaving must not fail
		// the others. Only successes are kept; failures are retried by the next call.
		flight = Promise.all([
			lookupTitles(q, policy),
			paletteLookupTitles(q, PALETTE_LOOKUP_TITLES),
		]).then(([tmdb, palette]) => {
			const value = {
				...tmdb,
				titles: withPaletteTitles(tmdb.titles, palette),
			};
			// A timed-out optional page must not turn a partial result into a ten-minute cache hit.
			if (value.complete) titleCache.set(key, { at: Date.now(), value });
			while (titleCache.size > TITLE_ENTRIES)
				titleCache.delete(titleCache.keys().next().value as string);
			return value;
		});
		flight.then(
			() => titleFlights.delete(key),
			() => titleFlights.delete(key),
		);
		titleFlights.set(key, flight);
	}
	const shared = flight;
	return new Promise<TitleLookup>((resolve, reject) => {
		const leave = () => reject(new Error("Search interrupted"));
		if (signal.aborted) return leave();
		signal.addEventListener("abort", leave, { once: true });
		shared
			.then(resolve, reject)
			.finally(() => signal.removeEventListener("abort", leave));
	});
}
// How many of the command palette's matches join the title lookup: more than the palette shows (5), so its titles are
// all there after the search's own filters.
const PALETTE_LOOKUP_TITLES = 20;

/**
 * TMDB's titles, then the command palette's that TMDB missed. TMDB ranks "lord of" by its own relevance, people
 * included, and its later pages may time out, so titles the palette showed could be missing; the palette's prefix
 * lookup runs over the search index in memory, at no network cost. A TMDB title the palette found by a localized name
 * keeps that name (TMDB answers in English). People stay TMDB's alone.
 */
function withPaletteTitles(tmdb: Title[], palette: Title[]): Title[] {
	const aliases = new Map(
		palette.filter((t) => t.matchedAlias).map((t) => [titleKey(t), t]),
	);
	const known = new Set(tmdb.map(titleKey));
	return [
		...tmdb.map((t) => {
			const matchedAlias = aliases.get(titleKey(t))?.matchedAlias;
			return matchedAlias ? { ...t, matchedAlias } : t;
		}),
		...palette.filter((t) => !known.has(titleKey(t))),
	];
}

/** The title with the catalog's poster when the lookup had none (the palette's titles come without one). */
const withPoster = (t: Title, m: Metadata | undefined): Title => ({
	...t,
	poster: t.poster?.trim() || m?.poster_path?.trim() || null,
});

async function lookupTitles(
	q: string,
	policy: Eligibility,
): Promise<TitleLookup> {
	const page = async (n: number, signal = AbortSignal.timeout(8000)) => {
		const params = new URLSearchParams({
			api_key: process.env.TMDB_API_KEY || "",
			query: q,
			language: "en-US",
			include_adult: String(policy.includeAdult),
			page: String(n),
		});
		const response = await fetch(
			`https://api.themoviedb.org/3/search/multi?${params}`,
			{ signal },
		);
		if (!response.ok) throw new Error("Title lookup unavailable");
		return response.json() as Promise<{
			total_pages?: number;
			results?: {
				id: number;
				title?: string;
				name?: string;
				original_title?: string;
				original_name?: string;
				media_type: string;
				release_date?: string;
				first_air_date?: string;
				poster_path?: string;
				profile_path?: string;
				known_for_department?: string;
				popularity?: number;
				adult?: boolean;
				known_for?: {
					id: number;
					media_type: string;
					title?: string;
					name?: string;
					release_date?: string;
					first_air_date?: string;
					poster_path?: string | null;
					backdrop_path?: string | null;
					adult?: boolean;
				}[];
			}[];
		}>;
	};
	const first = await page(1);
	const rest = await Promise.all(
		Array.from(
			{ length: Math.max(0, Math.min(5, first.total_pages || 1) - 1) },
			// Page one contains the best title/name matches. Additional pages may enrich it, but must not
			// hold those matches behind a slow remote response. Cover body decoding as well as headers.
			(_, i) =>
				withBackendTimeout("TMDB", 200, (signal) => page(i + 2, signal)).catch(
					() => null,
				),
		),
	);
	const results = [first, ...rest]
		.flatMap((p) => p?.results || [])
		.filter((r) => policy.includeAdult || r.adult !== true);
	return {
		complete: rest.every((p) => p !== null),
		titles: results
			.filter((r) => r.media_type === "movie" || r.media_type === "tv")
			.map((r) => ({
				id: r.id,
				title: r.title || r.name || "Untitled",
				original: r.original_title || r.original_name,
				type: r.media_type,
				year: (r.release_date || r.first_air_date || "").slice(0, 4),
				poster: r.poster_path || null,
				popularity: r.popularity || 0,
				adult: r.adult,
			})),
		people: results
			.filter((r) => r.media_type === "person")
			.map((r) => ({
				id: r.id,
				name: r.name || "",
				department: r.known_for_department || "",
				profile: r.profile_path || null,
				popularity: r.popularity || 0,
				knownFor: (r.known_for || [])
					.filter(
						(t) =>
							(t.media_type === "movie" || t.media_type === "tv") &&
							t.poster_path &&
							(policy.includeAdult || t.adult !== true),
					)
					.map((t) => ({
						type:
							t.media_type === "tv" ? ("show" as const) : ("movie" as const),
						id: t.id,
						title: t.title || t.name || "Untitled",
						year: (t.release_date || t.first_air_date || "").slice(0, 4),
						poster: t.poster_path || null,
						backdrop: t.backdrop_path || null,
					})),
			})),
	};
}
// The ranking of the basic search: essence text relevance only (see literal).
const BASIC_RANKER_VERSION = "essence-text-v1";
async function literal(q: string, policy: Eligibility): Promise<Result[]> {
	const groups = await Promise.all(
		(["movie", "show"] as const).map((type) => {
			const chips = toCrateSql(policy.filters, type);
			if (!chips) return Promise.resolve([]);
			return searchQuery<{
				tmdb_id: number;
				title: string;
				release_year: number;
				poster_path: string | null;
				genres: string[];
				_score: number;
			}>(
				`SELECT tmdb_id,title,release_year,poster_path,genres,_score FROM ${type} WHERE essence_text IS NOT NULL AND poster_path IS NOT NULL AND goodwatch_overall_score_normalized_percent IS NOT NULL AND ${policy.lesserKnown ? "true" : `goodwatch_overall_score_voting_count >= ${ELIGIBLE_VOTES}`} AND ${policy.includeAdult ? "true" : "NOT coalesce(adult,false)"}${chips.sql} AND match((essence_text 2.0, synopsis), ?) ORDER BY _score DESC LIMIT 100`,
				[...chips.params, q],
			).then((rows) => rows.map((r) => ({ ...r, media_type: type })));
		}),
	);
	return groups
		.flat()
		.sort((a, b) => b._score - a._score)
		.slice(0, 100)
		.map((r, i) => ({
			...r,
			rank: i + 1,
			weightedSum: 0,
			cosine: 0,
			combined: r._score,
			tropes: [],
			reasons: [],
			scores: [],
		}));
}
/**
 * The text a Jev reading reads, which is also the text in its cache key: lowercase, with each run of whitespace
 * collapsed to one space, so "Slow burn" and "slow  burn" share one reading. The language step runs on the text as
 * typed (capitalized German nouns are a language marker), and the ranking, the title lookup and the history keep it.
 */
export function readingText(text: string): string {
	return text
		.normalize("NFC")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase()
		.normalize("NFC");
}
const TMDB_ID_RANGE = 1_000_000_000_000;
const DISPLAY_TIMEOUT_MS = 2000;
// How long a search that already showed its title matches keeps completing after its ranking missed the deadline,
// measured from the miss. It covers the rest of the ranking and every display stage after it, up to the built final.
const LATE_COMPLETION_CAP_MS = 15_000;
// The title matches a streaming caller sees before the ranking: every search word in the title, the exact phrase, or
// the exact title (see titleMatch). A weaker match shares only some of the words, so it waits for the ranking. A
// search of stopwords alone ("the") has all of its words in "The Matrix" too: of its matches only the exact title is
// shown early (see onlyStopwords).
const EARLY_TITLE_MATCH = 0.9;
const EXACT_TITLE_MATCH = 2;
const UNKNOWN_MODE = "unknown";
const round1 = (ms: number) => Math.round(ms * 10) / 10;
const titleKey = (t: Title) => `${t.type === "tv" ? "show" : t.type}:${t.id}`;

interface TitleMatches {
	title: { results: Title[]; error?: boolean };
	/** Catalog rows by key; rankedList adds the ranked titles' rows. */
	meta: Map<string, Metadata>;
	/** The title lookup's movies and shows that the filters and the catalog allow. */
	allowedTitles: Title[];
}

/** The title lookup's matches that the ranking may show, with their catalog rows. Needs no reading. */
async function titleMatches(
	titlePromise: Promise<{ results: Title[]; error?: boolean }>,
	policy: Eligibility,
	knownMeta?: Map<string, Metadata>,
	signal?: AbortSignal,
	// Receives each query of the catalog read as it starts (see metadataFor).
	track?: Parameters<typeof metadataFor>[2],
): Promise<TitleMatches> {
	const title = await titlePromise;
	const titleRows = title.results.filter((t) =>
		allowsTitle(policy.filters, titleKey(t)),
	);
	const meta = new Map(knownMeta);
	const titleMeta = await metadataFor(
		[...new Set(titleRows.map(titleKey))].filter((key) => !meta.has(key)),
		signal,
		track,
	);
	for (const m of titleMeta) meta.set(`${m.media_type}:${m.tmdb_id}`, m);
	const allowedTitles = titleRows
		.map((t) => withPoster(t, meta.get(titleKey(t))))
		.filter((t) => eligible(meta.get(titleKey(t)), policy, false, t.poster));
	return { title, meta, allowedTitles };
}

interface ServedList {
	rows: Row[];
	metadata: Metadata[];
	rankerVersion: string;
	titleError: boolean;
	stageMs: Record<string, number>;
	reblend: (titles: Promise<TitleMatches>) => Promise<ServedList>;
}
interface RankedDisplayCache {
	ranked: RankedSearch;
	meta: Map<string, Metadata>;
	display: Map<string, Awaited<ReturnType<typeof describeTitles>>[number]>;
	describedKeys: Set<string>;
}
/** The completion of a search whose ranking missed its deadline after its title matches were shown. */
interface LateCompletion {
	/**
	 * On a deadline miss: the same original ranking to wait for, or null when the basic search serves. `elapsedMs` is
	 * the ranking's measured wall time when the miss arrived.
	 */
	resume: (
		error: RankingDeadlineError,
		elapsedMs: number,
	) => Promise<RankedSearch> | null;
	/** The work, or a rejection once the cap passes or the person leaves. The work itself before a miss. */
	bounded: <T>(work: Promise<T>) => Promise<T>;
	/**
	 * The work itself, counted as this search's own until it has ended. For each read of a group: the group ends at its
	 * first failure, while the reads beside it still run. The late catalog reads pass it to metadataFor for the same
	 * reason, so each table's query is counted too. Counts nothing before a miss.
	 */
	own: <T>(work: Promise<T>) => Promise<T>;
	/**
	 * Throws once the cap has passed or the person has left; does nothing before a miss. Asked before each new read: a
	 * stage that outlasted the window starts nothing after it.
	 */
	checkpoint: () => void;
	/** Ends catalog reads at the cap; undefined before a miss, when the reads keep their own limits. */
	signal: () => AbortSignal | undefined;
	/** The milliseconds left until the cap, at most `ms`; `ms` before a miss. */
	budget: (ms: number) => number;
}

/**
 * The ranked list, in the response's row format: the ranker's blended list, with the title lookup's rows, the display
 * fields and reason chips of each title, and the catalog metadata. Throws when the ranking fails or misses its
 * deadline; the caller then serves the basic search. With `late`, a deadline miss may instead wait for the same
 * ranking (see LateCompletion.resume) and continue here once, with this call's clock and catalog rows.
 */
async function rankedList(
	q: string,
	language: { text: string; policy: { mode: string } },
	// The text the Jev reading read (see readingText): its word and phrase answers refer to it.
	readText: string,
	readings: Parameters<typeof readingFields>[1],
	policy: Eligibility,
	// Title matches start early; the prepared part starts only when a fresh reading is claimed.
	early: {
		titles: Promise<TitleMatches>;
		prepared?: Promise<PreparedSearch>;
		progress?: RankingProgress;
	},
	signal: AbortSignal,
	// How many ranked titles to serve: HEAD_LENGTH for the search page, up to RESULT_LENGTH for Discover.
	length: number,
	reuse?: RankedDisplayCache,
	late?: LateCompletion,
): Promise<ServedList> {
	const started = performance.now();
	const { title, meta, allowedTitles } = await early.titles;
	const responseMetadataKeys = new Set(
		title.results
			.filter((t) => allowsTitle(policy.filters, titleKey(t)))
			.map(titleKey),
	);
	if (reuse)
		for (const [key, value] of reuse.meta)
			if (!meta.has(key)) meta.set(key, value);
	const titleDone = performance.now();
	if (signal.aborted) throw new Error("Search interrupted");
	// A reblend's title matches may have outlasted the late window: nothing is ranked or read after it.
	late?.checkpoint();
	const lookup = new Map(allowedTitles.map((t) => [titleKey(t), t]));
	const fields = readingFields(
		readText,
		readings,
		language.policy.mode === "native-vector-only",
	);
	const rankStarted = performance.now();
	const ranked = reuse
		? { ...reuse.ranked, results: reuse.ranked.reblend(allowedTitles) }
		: await rankForServing(
				fields,
				{
					query: q,
					text: language.text,
					nonEnglish: language.policy.mode !== "english",
					titleLookup: allowedTitles,
					prepared: early.prepared,
					progress: early.progress,
				},
				policy,
			).catch((error) => {
				const original =
					error instanceof RankingDeadlineError
						? late?.resume(error, performance.now() - rankStarted)
						: null;
				if (!original) throw error;
				return original;
			});
	// After a late completion this still counts from rankStarted: the ranking's whole wall time, the wait included.
	const rankDone = performance.now();
	if (signal.aborted) throw new Error("Search interrupted");
	late?.checkpoint();
	const listed = ranked.results.slice(0, length).map((r) => ({
		key: `${r.mediaType}:${r.id % TMDB_ID_RANGE}`,
		tmdbId: r.id % TMDB_ID_RANGE,
		mediaType: r.mediaType,
		blended: r,
	}));
	const display =
		reuse?.display ??
		new Map<string, Awaited<ReturnType<typeof describeTitles>>[number]>();
	const describedKeys = reuse?.describedKeys ?? new Set<string>();
	const toDescribe = listed
		.slice(0, HEAD_LENGTH)
		.filter((row) => !describedKeys.has(row.key));
	toDescribe.forEach((row) => describedKeys.add(row.key));
	// Each read is counted on its own: when one fails, the list fails at once and the other is still running. The
	// catalog read is two queries, one per table, and fails the same way, so it counts each of its queries as well.
	// A function declaration: a generic arrow function reads as JSX where this file is transpiled as TSX.
	function own<T>(work: Promise<T>): Promise<T> {
		return late?.own(work) ?? work;
	}
	const displayed = Promise.all([
		// Display fields and reasons for the head only: Discover shows its own cards, and reading 100 titles' payloads
		// doubled the display stage. Titles past the head come with the ranker's title and year.
		toDescribe.length
			? own(
					describeTitles(fields, toDescribe, {
						timeoutMs: late?.budget(DISPLAY_TIMEOUT_MS) ?? DISPLAY_TIMEOUT_MS,
					}),
				)
			: Promise.resolve([]),
		own(
			metadataFor(
				listed.map((r) => r.key).filter((key) => !meta.has(key)),
				late?.signal(),
				own,
			),
		),
	]);
	const [described, rankedMeta] = await (late?.bounded(displayed) ?? displayed);
	for (const m of rankedMeta) meta.set(`${m.media_type}:${m.tmdb_id}`, m);
	for (const row of listed) responseMetadataKeys.add(row.key);
	for (const d of described) display.set(`${d.media_type}:${d.tmdb_id}`, d);
	const identities = new Set<string>();
	const rows: Row[] = [];
	for (const [at, { key, blended }] of listed.entries()) {
		const found = lookup.get(key);
		const m = meta.get(key);
		const shown = display.get(key);
		const poster =
			found?.poster?.trim() || shown?.poster_path?.trim() || m?.poster_path?.trim() || null;
		// Same checks as today's list: eligibility from the catalog, and one row per IMDb title.
		if (!eligible(m, policy, !found, poster)) continue;
		if (!found && !shown && at < HEAD_LENGTH) continue;
		const identity = m?.imdb_id?.trim() ? `imdb:${m.imdb_id.trim()}` : key;
		if (identities.has(identity)) continue;
		identities.add(identity);
		let match: { lexical: number; match: string; matchedAlias?: MatchedAlias } =
			titleMatch(found?.title ?? blended.title, q);
		const original = titleMatch(found?.original ?? "", q);
		if (original.lexical > match.lexical)
			match = {
				lexical: original.lexical,
				match: `${original.match} (original name)`,
			};
		match =
			aliasMatch(
				found?.matchedAlias ?? blended.matchedAlias,
				q,
				match.lexical,
			) ?? match;
		rows.push({
			key,
			title: found?.title ?? shown?.title ?? blended.title,
			original: found?.original,
			type: blended.mediaType,
			year:
				blended.year ||
				found?.year ||
				(shown?.release_year ? String(shown.release_year) : ""),
			poster,
			adult: found?.adult,
			popularity: found?.popularity ?? 0,
			...(shown ? { discovery: { ...shown, rank: rows.length + 1 } } : {}),
			...match,
			score: blended.score,
		});
	}
	const done = performance.now();
	const stageMs: Record<string, number> = {
		titleLookup: round1(titleDone - started),
		ranking: round1(rankDone - rankStarted),
		rankingQdrant: round1(ranked.rounds.reduce((sum, r) => sum + r.wallMs, 0)),
		rankingQdrantServer: round1(
			ranked.rounds.reduce((sum, r) => sum + r.serverMs, 0),
		),
		display: round1(rankStarted - titleDone + (done - rankDone)),
	};
	// The ranker's own stages (encode, round1, round2, score, blend, ...); its total is `ranking`.
	for (const [name, ms] of Object.entries(ranked.timings))
		if (name !== "total")
			stageMs[`ranking${name[0].toUpperCase()}${name.slice(1)}`] = round1(ms);
	return {
		reblend: (titles) =>
			rankedList(
				q,
				language,
				readText,
				readings,
				policy,
				{ titles },
				signal,
				length,
				{ ranked, meta, display, describedKeys },
				late,
			),
		rows,
		metadata: [...responseMetadataKeys].flatMap((key) =>
			meta.has(key) ? [meta.get(key)!] : [],
		),
		rankerVersion: ranked.rankerVersion,
		titleError: "error" in title,
		stageMs,
	};
}

export async function combinedSearch(
	query: string,
	eligibility: Eligibility,
	visitor: JevStageInput["visitor"],
	signal: AbortSignal,
	// Called once the interpretation is known and before retrieval, so the caller can
	// show it while the results are still on their way.
	onReading?: (reading: ReadingChip[]) => void,
	// allTitles: search all titles even when the query names people inside a longer phrase. rows: how many ranked
	// titles to serve (Discover's search mode asks for up to RESULT_LENGTH); the search page's HEAD_LENGTH by default.
	options: {
		allTitles?: boolean;
		rows?: number;
		onProgress?: (batch: SearchBatch) => BatchDelivery | Promise<BatchDelivery>;
		onComplete?: (batch: SearchBatch) => BatchDelivery | Promise<BatchDelivery>;
	} = {},
): Promise<SearchBatch> {
	const started = Date.now(),
		errors: string[] = [];
	let chargedNano = 0;
	// Awaited before the paid call and the history row; this keeps an early rejection from counting as unhandled.
	Promise.resolve(visitor.accountId).catch(() => {});
	// Milliseconds per stage, in order: the people step, the language step, the Jev reading, the wait for the title
	// lookup that runs alongside, the ranking (with its Qdrant time and its own stages), and the display (catalog
	// metadata, display fields and the blend).
	const stageMs: Record<string, number> = {};
	let mark = performance.now();
	const lap = (name: string) => {
		const now = performance.now();
		stageMs[name] = Math.round((now - mark) * 10) / 10;
		mark = now;
	};
	// Names inside a longer phrase ("funny brad pitt movies") narrow the search to the titles of those people, ranked
	// by the words left over ("funny movies"). From here on, q is the text that is searched.
	const people = await readPeople(query, !options.allTitles).catch(
		(): PeopleReading => ({ named: [], offered: [], scope: null }),
	);
	lap("people");
	const q = people.scope?.text ?? query;
	const policy: Eligibility = people.scope
		? {
				...eligibility,
				filters: { ...eligibility.filters, onlyTitles: people.scope.titles },
			}
		: eligibility;
	let titleSettled = false;
	const titlePromise = titles(q, policy, signal)
		.then(
			(lookup) => ({ results: lookup.titles, people: lookup.people }),
			() => ({
				results: [] as Title[],
				people: [] as LookupPerson[],
				error: true,
			}),
		)
		.then((value) => {
			titleSettled = true;
			return value;
		});
	let pendingTitleLookup = false;
	// Only streaming callers opt in. Keep the shared remote lookup alive for the authoritative final update.
	const initialTitlePromise = options.onProgress
		? (async () => {
				let timer: ReturnType<typeof setTimeout> | undefined;
				const lookup = await Promise.race([
					titlePromise,
					new Promise<null>((resolve) => {
						timer = setTimeout(() => resolve(null), 200);
					}),
				]).finally(() => clearTimeout(timer));
				if (lookup) return lookup;
				const catalog = new AbortController();
				const result = await Promise.race([
					titlePromise.then((lookup) => ({ lookup, remote: true })),
					exactCatalogTitles(q, catalog.signal).then((results) => ({
						lookup: { results, people: [] as LookupPerson[] },
						remote: false,
					})),
				]);
				pendingTitleLookup = !result.remote;
				if (result.remote) catalog.abort();
				return result.lookup;
			})()
		: titlePromise;
	// Runs alongside the search; only the known-for titles of people outside the title lookup need the catalog.
	const peopleFor = (title: Awaited<typeof titlePromise>) =>
		peopleToShow(query, people, title.people).catch((error) => {
			console.error("People for the search failed", error);
			return [];
		});
	// The people step is this search's own work from its start until it has ended: a search that is rejected while it
	// runs keeps a place in line for it (see the catch below). A search rejected before the title lookup answered starts
	// no people step.
	const peopleStep: { rejected: boolean; running?: Promise<SearchPerson[]> } = {
		rejected: false,
	};
	const shownPeople = initialTitlePromise.then((title) => {
		if (peopleStep.rejected) return [];
		const running = peopleFor(title);
		peopleStep.running = running;
		const ended = () => {
			peopleStep.running = undefined;
		};
		running.then(ended, ended);
		return running;
	});
	// English/default-off interpretation and native title lookup run in parallel.
	const languagePromise = !translationEnabled()
		? prepareLanguage(q, visitor, signal)
		: initialTitlePromise.then(async (initial) => {
				const exactMatch = (title: Awaited<typeof titlePromise>) =>
					[
						...title.results.flatMap((r) => [r.title, r.original]),
						...title.people.map((p) => p.name),
					].some(
						(t) =>
							t?.normalize("NFC").toLocaleLowerCase() ===
							q.normalize("NFC").toLocaleLowerCase(),
					);
				// Translation is paid and determines the reading. An incomplete miss must not change that decision:
				// wait for the original lookup when the catalog cannot affirm an exact native title/person.
				const title = exactMatch(initial) ? initial : await titlePromise;
				return exactMatch(title)
					? {
							text: q,
							policy: {
								mode: "english" as const,
								version: "exact-native-title-v1",
							},
							chargedNano: 0,
							admissionAttemptId: undefined,
						}
					: prepareLanguage(q, visitor, signal);
			});
	// Title matches load now. Preparation waits until a fresh reading is claimed, so basic searches save encoder CPU.
	// The fresh reading's call takes about 300 ms at p50, enough for preparation to fit inside it. A cached reading
	// prepares after the cache lookup instead of alongside it, through rankSearch when prepared is undefined.
	const early: {
		titles: ReturnType<typeof titleMatches>;
		prepared?: Promise<PreparedSearch>;
		progress?: RankingProgress;
	} = {
		titles: titleMatches(initialTitlePromise, policy),
		progress: new RankingProgress(),
	};
	early.titles.catch(() => {});
	// What the history row needs, kept outside the guarded search below: a search that fails after it has shown results
	// still writes its row.
	let languageMode = UNKNOWN_MODE;
	let read: JevOutcome | undefined;
	let fallback: ServingFallback | null = null;
	let served: ServedList | null = null;
	let historyQueued = false;
	const queueHistory = (elapsedMs: number) => {
		if (historyQueued) return;
		historyQueued = true;
		const entry = {
			text: query,
			elapsedMs,
			chargedNano,
			// Without a reading (the search failed before one began), the results that were shown had none.
			outcome:
				errors.includes(BASIC_SEARCH_MESSAGE) || !read
					? ("basic" as const)
					: read.kind,
			...(read?.kind === "basic" ? { reason: read.reason } : {}),
			rankerVersion: served ? served.rankerVersion : BASIC_RANKER_VERSION,
			...(fallback ? { rankerFallback: fallback } : {}),
			stageMs: { ...stageMs, total: elapsedMs },
		};
		setImmediate(() => {
			Promise.resolve(visitor.accountId).then(
				(accountId) => recordSearchHistory({ ...entry, accountId }),
				() => {},
			);
		});
	};
	// Streaming callers get the strong title matches and the named people while the language step, the reading and the
	// ranking still run. Nothing here starts a query: the matches, their catalog rows and the people are the search's
	// own, and the ranked list replaces them.
	const earlyBatch: {
		closed: boolean;
		sending?: Promise<void>;
		failure?: { error: unknown };
		// Set only once the callback answered that the batch reached the person.
		delivered?: boolean;
	} = { closed: false };
	// A search whose early batch reached the person does not swap it for the basic search when the ranking misses its
	// deadline: it waits for that same ranking, up to the cap, and the ranked final replaces the early batch. Every
	// other search (no early batch, a declined one, one still being sent) keeps the basic search.
	const lateState: {
		window?: {
			missedAt: number;
			signal: AbortSignal;
			capped: AbortSignal;
			expired: Promise<never>;
			clear: () => void;
		};
	} = {};
	// The deadline's own snapshot, under rankingDeadline<Name>: how far the ranking was at the miss. The completed
	// ranking's stages keep ranking<Name>, so a span that was pending at the miss never reads as a completed stage.
	const deadlineStageMs: Record<string, number> = {};
	// Display work started in the window and not yet ended; the ranking is not here, it holds its own place.
	const lateWork = new Set<Promise<unknown>>();
	const late: LateCompletion = {
		resume(error, elapsedMs) {
			if (
				!error.ranking ||
				!earlyBatch.delivered ||
				signal.aborted ||
				lateState.window
			)
				return null;
			const missedAt = performance.now();
			const cap = new AbortController();
			const timer = setTimeout(() => cap.abort(), LATE_COMPLETION_CAP_MS);
			const either = AbortSignal.any([signal, cap.signal]);
			const expired = new Promise<never>((_, reject) => {
				either.addEventListener(
					"abort",
					() =>
						reject(
							new Error(
								signal.aborted
									? "Search interrupted"
									: "Search ranking did not complete",
							),
						),
					{ once: true },
				);
			});
			expired.catch(() => {});
			lateState.window = {
				missedAt,
				signal: either,
				capped: cap.signal,
				expired,
				clear: () => clearTimeout(timer),
			};
			for (const [name, ms] of Object.entries(error.timings))
				deadlineStageMs[
					`rankingDeadline${name[0].toUpperCase()}${name.slice(1)}`
				] = ms;
			// The ranking's wall time when the miss arrived, measured from its start: not the configured deadline.
			deadlineStageMs.rankingDeadlineElapsed = round1(elapsedMs);
			Object.assign(stageMs, deadlineStageMs);
			return Promise.race([error.ranking, expired]);
		},
		own(work) {
			if (!lateState.window) return work;
			lateWork.add(work);
			const ended = () => lateWork.delete(work);
			work.then(ended, ended);
			return work;
		},
		bounded(work) {
			const window = lateState.window;
			if (!window) return work;
			return Promise.race([late.own(work), window.expired]);
		},
		checkpoint() {
			if (!lateState.window?.signal.aborted) return;
			throw new Error(
				signal.aborted ? "Search interrupted" : "Search ranking did not complete",
			);
		},
		signal: () => lateState.window?.signal,
		budget: (ms) => {
			const window = lateState.window;
			if (!window) return ms;
			const left =
				window.missedAt + LATE_COMPLETION_CAP_MS - performance.now();
			return Math.max(1, Math.min(ms, left));
		},
	};
	const onProgress = options.onProgress;
	if (onProgress)
		Promise.all([early.titles, shownPeople])
			.then(([matches, named]) => {
				// Once the ranked results are on their way, or the person has left, this batch is not sent late.
				if (earlyBatch.closed || signal.aborted) return;
				const identities = new Set<string>();
				// The ranking's own stopwords: a search without a content word is no evidence for a title it only occurs in.
				const onlyStopwords = words(q).every((word) => STOPWORDS.has(word));
				const rows = blend(
					matches.allowedTitles,
					{ results: [] },
					q,
					"balanced",
				).filter((r) => {
					if (r.lexical < EARLY_TITLE_MATCH) return false;
					if (onlyStopwords && r.lexical < EXACT_TITLE_MATCH) return false;
					const m = matches.meta.get(r.key),
						identity = m?.imdb_id?.trim() ? `imdb:${m.imdb_id.trim()}` : r.key;
					if (identities.has(identity)) return false;
					identities.add(identity);
					return true;
				});
				// The named people go out without a title row too, whichever titles the search covers: both pages show
				// them above the titles.
				if (!rows.length && !named.length) return;
				// A failed delivery is kept for the search's own checkpoint. Rejecting here would free the caller's place
				// in line while the reading and the ranking still run.
				earlyBatch.sending = (async () => {
					const delivered = await onProgress({
						q: query,
						rows,
						reading: [],
						metadata: rows.flatMap((r) => {
							const m = matches.meta.get(r.key);
							return m ? [m] : [];
						}),
						errors: [],
						mode: languageMode,
						elapsedMs: Date.now() - started,
						chargedNano,
						people: named,
						creditScope: people.scope
							? { people: people.scope.people, text: people.scope.text }
							: null,
						pendingTitleLookup: pendingTitleLookup && !titleSettled,
						pendingRanking: true,
					});
					// Only a batch that reached the person counts as first results: a declined one was an attempt.
					if (delivered !== false && !signal.aborted) {
						stageMs.firstResults ??= Date.now() - started;
						earlyBatch.delivered = true;
					}
				})().catch((error) => {
					earlyBatch.failure = { error };
				});
			})
			.catch(() => {});
	try {
		const language = await languagePromise;
		lap("language");
		languageMode = language.policy.mode;
		chargedNano += language.chargedNano;
		// Jev reads the normalized text, so the reading and its cache entry don't depend on case or spacing.
		const readText = readingText(language.text);
		const readingSteps: Record<string, number> = {};
		const outcome: JevOutcome = await runJevStage({
			onClaimed: () => {
				if (servingFallback({ hasReading: true })) return;
				early.prepared = prepareSearch({
					query: q,
					text: language.text,
					nonEnglish: language.policy.mode !== "english",
					progress: early.progress,
				});
				early.prepared.catch(() => {});
			},
			timings: readingSteps,
			requestText: readingText(q),
			questionVersion: "accepted-d4-corrected-v1",
			language: language.policy,
			requests: [attributeRequest(readText), fingerprintRequest(readText)],
			visitor,
			signal,
			admissionAttemptId: language.admissionAttemptId,
		});
		read = outcome;
		lap("reading");
		// The reading's own steps: readingLookup, readingClaim, readingDispatch, readingCall, readingFinish.
		for (const [name, ms] of Object.entries(readingSteps))
			stageMs[`reading${name[0].toUpperCase()}${name.slice(1)}`] = ms;
		chargedNano += outcome.chargedNano;
		let reading: ReadingChip[] = [];
		if (outcome.kind !== "basic") {
			reading = summarizeReading(
				readText,
				outcome.readings,
				language.policy.mode === "native-vector-only",
			);
			onReading?.(reading);
		}
		// The ranking serves every search with a reading. The basic search serves the others, and the searches the
		// ranking can't serve (see serve.server.ts); the reason goes on the history row.
		fallback = servingFallback({
			hasReading: outcome.kind !== "basic",
		});
		if (!fallback && outcome.kind !== "basic") {
			const attempt = performance.now();
			try {
				served = await rankedList(
					q,
					language,
					readText,
					outcome.readings,
					policy,
					early,
					signal,
					options.rows ?? HEAD_LENGTH,
					undefined,
					late,
				);
				Object.assign(stageMs, served.stageMs, deadlineStageMs);
			} catch (error) {
				if (lateState.window) {
					// The early batch stays what the person has: no basic search replaces it. The ranking never served,
					// and the checkpoint below records the delivery with its completion flag.
					fallback =
						signal.aborted || lateState.window.capped.aborted
							? "timeout"
							: "error";
					stageMs.failedRanking =
						Math.round((performance.now() - attempt) * 10) / 10;
					throw signal.aborted ? new Error("Search interrupted") : error;
				}
				if (signal.aborted) throw new Error("Search interrupted");
				fallback = error instanceof RankingDeadlineError ? "timeout" : "error";
				console.error("Search ranking failed; the basic search serves", {
					reason: fallback,
				});
				const progress =
					error instanceof RankingDeadlineError
						? error.timings
						: early.progress?.snapshot();
				for (const [name, ms] of Object.entries(progress ?? {}))
					stageMs[`ranking${name[0].toUpperCase()}${name.slice(1)}`] = ms;
				stageMs.failedRanking =
					Math.round((performance.now() - attempt) * 10) / 10;
			}
			mark = performance.now();
		}
		let basicResults: Promise<Result[]> | undefined;
		const basicMetadata = new Map<string, Metadata>();
		const basicList = async (lookup = initialTitlePromise) => {
			let results: Result[] = [];
			const firstBasicList = basicResults === undefined;
			if (!errors.includes(BASIC_SEARCH_MESSAGE))
				errors.push(BASIC_SEARCH_MESSAGE);
			try {
				basicResults ??= literal(q, policy);
				results = await basicResults;
			} catch {
				if (!errors.includes("Description search unavailable"))
					errors.push("Description search unavailable");
			}
			if (firstBasicList) lap("ranking");
			const title = await lookup;
			if (firstBasicList) lap("titleLookup");
			if ("error" in title && !errors.includes("Title lookup unavailable"))
				errors.push("Title lookup unavailable");
			if (signal.aborted) throw new Error("Search interrupted");
			// Catalog metadata is authoritative for eligibility and reliable identity. Fetch before
			// blend so an ineligible discovery hit cannot boost a title's rank or use a snapshot slot.
			const titleRows = title.results.filter((t) =>
				allowsTitle(policy.filters, titleKey(t)),
			);
			const keys = [
				...titleRows.map(titleKey),
				...results.map((r) => `${r.media_type}:${r.tmdb_id}`),
			];
			for (const m of await metadataFor(
				[...new Set(keys)].filter((key) => !basicMetadata.has(key)),
			))
				basicMetadata.set(`${m.media_type}:${m.tmdb_id}`, m);
			const metadata = [...new Set(keys)].flatMap((key) =>
				basicMetadata.has(key) ? [basicMetadata.get(key)!] : [],
			);
			const meta = new Map(
				metadata.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]),
			);
			const allowedTitles = titleRows
				.map((t) => withPoster(t, meta.get(titleKey(t))))
				.filter((t) => eligible(meta.get(titleKey(t)), policy, false, t.poster));
			const description = results.filter((r) =>
				eligible(meta.get(`${r.media_type}:${r.tmdb_id}`), policy, true),
			);
			const identities = new Set<string>();
			const rows = blend(
				allowedTitles,
				{ results: description },
				q,
				"balanced",
			).map((r) => ({
				...r,
				poster: r.poster?.trim() || meta.get(r.key)?.poster_path?.trim() || null,
			})).filter((r) => {
				const m = meta.get(r.key),
					identity = m?.imdb_id?.trim() ? `imdb:${m.imdb_id.trim()}` : r.key;
				if (identities.has(identity)) return false;
				identities.add(identity);
				return true;
			});
			if ("error" in title && errors.includes("Description search unavailable"))
				throw new Error("Search unavailable");
			if (firstBasicList) lap("display");
			return { rows, metadata };
		};
		let { rows, metadata } = served ?? (await basicList(initialTitlePromise));
		if (served?.titleError) errors.push("Title lookup unavailable");
		let shown = await shownPeople;
		// The early batch is out by now or is never sent: after the ranked results it would be obsolete. A failed
		// delivery surfaces here, once the reading and the ranking are done.
		earlyBatch.closed = true;
		await earlyBatch.sending;
		if (earlyBatch.failure) throw earlyBatch.failure.error;
		if (signal.aborted) throw new Error("Search interrupted");
		if (options.onProgress && pendingTitleLookup) {
			if (!titleSettled && (rows.length || shown.length)) {
				const firstResultsBuilt = Date.now() - started;
				const delivered = await options.onProgress({
					q: query,
					rows,
					reading,
					metadata,
					errors: [...new Set(errors)],
					mode: language.policy.mode,
					elapsedMs: firstResultsBuilt,
					chargedNano,
					people: shown,
					creditScope: people.scope
						? { people: people.scope.people, text: people.scope.text }
						: null,
					pendingTitleLookup: true,
					pendingRanking: false,
				});
				if (signal.aborted) throw new Error("Search interrupted");
				if (delivered !== false) stageMs.firstResults ??= Date.now() - started;
			}
			const completionStarted = performance.now();
			// The shared lookup is not this search's own work: past the cap the search stops waiting for it.
			const finalTitle = await (lateState.window
				? Promise.race([titlePromise, lateState.window.expired])
				: titlePromise);
			stageMs.titleCompletion = round1(performance.now() - completionStarted);
			if (signal.aborted) throw new Error("Search interrupted");
			// A lookup that answered as the cap passed wins the race above: its catalog read does not start.
			late.checkpoint();
			const finalDisplayStarted = performance.now();
			if (served) {
				const knownMeta = new Map(
					served.metadata.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]),
				);
				const refreshed = await late.bounded(
					served.reblend(
						titleMatches(
							Promise.resolve(finalTitle),
							policy,
							knownMeta,
							late.signal(),
							// The reblend ends at this read's first failed query; the query beside it stays counted.
							late.own,
						),
					),
				);
				rows = refreshed.rows;
				metadata = refreshed.metadata;
				served.titleError = refreshed.titleError;
				if (
					refreshed.titleError &&
					!errors.includes("Title lookup unavailable")
				)
					errors.push("Title lookup unavailable");
			} else {
				({ rows, metadata } = await basicList(Promise.resolve(finalTitle)));
			}
			late.checkpoint();
			shown = await late.bounded(peopleFor(finalTitle));
			stageMs.finalDisplay = round1(performance.now() - finalDisplayStarted);
		}
		// The final is built: the cap ends here. Delivering it (the route's member taste) has its own limits.
		if (lateState.window) {
			lateState.window.clear();
			stageMs.lateCompletion = round1(
				performance.now() - lateState.window.missedAt,
			);
		}
		const elapsedMs = Date.now() - started;
		stageMs.total = elapsedMs;
		// The history row is written after the response: nothing in the results depends on it. When the session check
		// failed, the search records nothing.
		const batch: SearchBatch = {
			q: query,
			rows,
			reading,
			metadata,
			errors,
			mode: language.policy.mode,
			elapsedMs,
			chargedNano,
			...(options.onProgress
				? { pendingTitleLookup: false, pendingRanking: false }
				: {}),
			people: shown,
			creditScope: people.scope
				? { people: people.scope.people, text: people.scope.text }
				: null,
		};
		// Streaming final delivery may await member taste. Measure first usable results after it is actually enqueued,
		// while elapsedMs/total retain the full search-computation duration independently of the consumer callback.
		const delivered = await options.onComplete?.(batch);
		if (signal.aborted) throw new Error("Search interrupted");
		// A declined final is not a completed search. The checkpoint below writes no row when nothing reached the
		// person, and marks the completion failed when an earlier batch did.
		if (delivered === false) throw new Error("Search results were not delivered");
		stageMs.firstResults ??= options.onComplete
			? Date.now() - started
			: elapsedMs;
		queueHistory(elapsedMs);
		return batch;
	} catch (error) {
		// The caller frees its place in line when this search rejects. The work this search tracks as its own is accounted
		// for by then: it was awaited, or it holds a place until it has ended. That is the work named here and no more: a
		// catalog read outside the late window is not counted per query, so a table's query still running when the other
		// one failed is not held.
		// The reading and the ranking were awaited above; a ranking past its deadline holds its own place (see
		// rankForServing), also when the late completion stopped waiting for it. Display work the cap or the person
		// leaving cut short is aborted where it can be, and holds one place until it has ended. So does a display read
		// that is still running when the read beside it failed, and each table's query of a late catalog read whose other
		// query failed. A reblend held here is still at its title matches' catalog read: once that read ends it starts
		// nothing more (see LateCompletion.checkpoint), so the place is not freed ahead of work that begins later.
		// The initial people step is held the same way while it runs: a search that fails at its language step or reading
		// is rejected at once, and the place stays taken until the step has ended. That covers what the step itself
		// waits for, within those reads' own time limits. It does not cover a credit or known-for read still running
		// after the read beside it failed (the step ends then, without known-for titles), nor credit loads other
		// searches share through the process cache.
		earlyBatch.closed = true;
		peopleStep.rejected = true;
		lateState.window?.clear();
		const unended: Promise<unknown>[] = [...lateWork];
		if (peopleStep.running) unended.push(peopleStep.running);
		if (unended.length) searchAdmission.hold(Promise.allSettled(unended));
		await Promise.allSettled([
			earlyBatch.sending,
			early.titles,
			early.prepared,
		]);
		// A usable batch remains a served search if completion fails or the person leaves. Preserve its
		// delivery and charge once, with a completion flag so acceptance cannot count a late failure as success.
		if (stageMs.firstResults !== undefined) {
			stageMs[signal.aborted ? "completionAborted" : "completionFailed"] = 1;
			queueHistory(stageMs.total ?? Date.now() - started);
		}
		throw error;
	}
}
