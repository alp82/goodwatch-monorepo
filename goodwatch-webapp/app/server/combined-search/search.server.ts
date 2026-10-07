import { createHash } from "node:crypto";
import { fetch } from "undici";
import {
	blend,
	titleMatch,
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
	metadataFor,
	searchQuery,
	type Metadata,
} from "./catalog.server";
import { prepareLanguage } from "./language.server";
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
	prepareSearch,
} from "../search-ranking/rank-search.server";
import { readingsConfigured } from "../search-runtime/limits.server";
import { HEAD_LENGTH } from "../search-ranking/ranking.server";
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

// The index loads at server start; query models load only when the storage key allows readings.
startSearchRanking({ queryModels: readingsConfigured() });
// The names a search can find inside a phrase load at server start too.
startPeopleIndex();
// The connections to TypeSafe stay open between searches.
keepJevConnectionsWarm();

export interface SearchBatch {
	q: string;
	rows: Row[];
	// The interpretation the search used; empty when it ran as a basic search.
	reading: ReadingChip[];
	metadata: Metadata[];
	errors: string[];
	mode: string;
	elapsedMs: number;
	chargedNano: number;
	// People the query names, shown above the titles.
	people: SearchPerson[];
	creditScope: CreditScope | null;
}
// Title lookups depend only on the text and the adult policy, never on filter chips,
// so filter-only refetches reuse them. Search text is private: entries stay in this
// process, keyed by a digest, and are never written to a shared store or logged.
const TITLE_TTL_MS = 10 * 60 * 1000;
const TITLE_ENTRIES = 200;
interface TitleLookup {
	titles: Title[];
	people: LookupPerson[];
}
const titleCache = new Map<string, { at: number; value: TitleLookup }>();
const titleFlights = new Map<string, Promise<TitleLookup>>();
function titles(
	q: string,
	policy: Eligibility,
	signal: AbortSignal,
): Promise<TitleLookup> {
	const key = createHash("sha256")
		.update(`${policy.includeAdult ? 1 : 0}:${q.trim().toLowerCase()}`)
		.digest("hex");
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
		flight = lookupTitles(q, policy).then((value) => {
			titleCache.set(key, { at: Date.now(), value });
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
async function lookupTitles(
	q: string,
	policy: Eligibility,
): Promise<TitleLookup> {
	const page = async (n: number) => {
		const params = new URLSearchParams({
			api_key: process.env.TMDB_API_KEY || "",
			query: q,
			language: "en-US",
			include_adult: String(policy.includeAdult),
			page: String(n),
		});
		const response = await fetch(
			`https://api.themoviedb.org/3/search/multi?${params}`,
			{ signal: AbortSignal.timeout(8000) },
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
			(_, i) => page(i + 2),
		),
	);
	const results = [first, ...rest]
		.flatMap((p) => p.results || [])
		.filter((r) => policy.includeAdult || r.adult !== true);
	return {
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
): Promise<TitleMatches> {
	const title = await titlePromise;
	const titleRows = title.results.filter((t) =>
		allowsTitle(policy.filters, titleKey(t)),
	);
	const titleMeta = await metadataFor([...new Set(titleRows.map(titleKey))]);
	const meta = new Map(titleMeta.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]));
	const allowedTitles = titleRows.filter((t) =>
		eligible(meta.get(titleKey(t)), policy, false),
	);
	return { title, meta, allowedTitles };
}

interface ServedList {
	rows: Row[];
	metadata: Metadata[];
	rankerVersion: string;
	titleError: boolean;
	stageMs: Record<string, number>;
}

/**
 * The ranked list, in the response's row format: the ranker's blended list, with the title lookup's rows, the display
 * fields and reason chips of each title, and the catalog metadata. Throws when the ranking fails or misses its
 * deadline; the caller then serves the basic search.
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
	},
	signal: AbortSignal,
	// How many ranked titles to serve: HEAD_LENGTH for the search page, up to RESULT_LENGTH for Discover.
	length: number,
): Promise<ServedList> {
	const started = performance.now();
	const { title, meta, allowedTitles } = await early.titles;
	const titleDone = performance.now();
	if (signal.aborted) throw new Error("Search interrupted");
	const lookup = new Map(allowedTitles.map((t) => [titleKey(t), t]));
	const fields = readingFields(
		readText,
		readings,
		language.policy.mode === "native-vector-only",
	);
	const rankStarted = performance.now();
	const ranked = await rankForServing(
		fields,
		{
			query: q,
			text: language.text,
			nonEnglish: language.policy.mode !== "english",
			titleLookup: allowedTitles,
			prepared: early.prepared,
		},
		policy,
	);
	const rankDone = performance.now();
	if (signal.aborted) throw new Error("Search interrupted");
	const listed = ranked.results.slice(0, length).map((r) => ({
		key: `${r.mediaType}:${r.id % TMDB_ID_RANGE}`,
		tmdbId: r.id % TMDB_ID_RANGE,
		mediaType: r.mediaType,
		blended: r,
	}));
	const [described, rankedMeta] = await Promise.all([
		// Display fields and reasons for the head only: Discover shows its own cards, and reading 100 titles' payloads
		// doubled the display stage. Titles past the head come with the ranker's title and year.
		describeTitles(fields, listed.slice(0, HEAD_LENGTH), {
			timeoutMs: DISPLAY_TIMEOUT_MS,
		}),
		metadataFor(listed.map((r) => r.key).filter((key) => !meta.has(key))),
	]);
	for (const m of rankedMeta) meta.set(`${m.media_type}:${m.tmdb_id}`, m);
	const display = new Map(
		described.map((d) => [`${d.media_type}:${d.tmdb_id}`, d]),
	);
	const identities = new Set<string>();
	const rows: Row[] = [];
	for (const [at, { key, blended }] of listed.entries()) {
		const found = lookup.get(key);
		const m = meta.get(key);
		const shown = display.get(key);
		// Same checks as today's list: eligibility from the catalog, and one row per IMDb title.
		if (!eligible(m, policy, !found)) continue;
		if (!found && !shown && at < HEAD_LENGTH) continue;
		const identity = m?.imdb_id?.trim() ? `imdb:${m.imdb_id.trim()}` : key;
		if (identities.has(identity)) continue;
		identities.add(identity);
		let match = titleMatch(found?.title ?? blended.title, q);
		const original = titleMatch(found?.original ?? "", q);
		if (original.lexical > match.lexical)
			match = {
				lexical: original.lexical,
				match: `${original.match} (original name)`,
			};
		rows.push({
			key,
			title: found?.title ?? shown?.title ?? blended.title,
			original: found?.original,
			type: blended.mediaType,
			year:
				blended.year ||
				found?.year ||
				(shown?.release_year ? String(shown.release_year) : ""),
			poster: found?.poster ?? shown?.poster_path ?? null,
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
		rows,
		metadata: [...meta.values()],
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
	options: { allTitles?: boolean; rows?: number } = {},
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
	const titlePromise = titles(q, policy, signal).then(
		(lookup) => ({ results: lookup.titles, people: lookup.people }),
		() => ({
			results: [] as Title[],
			people: [] as LookupPerson[],
			error: true,
		}),
	);
	// Runs alongside the search; only the known-for titles of people outside the title lookup need the catalog.
	const shownPeople = titlePromise.then((title) =>
		peopleToShow(query, people, title.people).catch((error) => {
			console.error("People for the search failed", error);
			return [];
		}),
	);
	// English/default-off interpretation and native title lookup run in parallel.
	const languagePromise = !translationEnabled()
		? prepareLanguage(q, visitor, signal)
		: titlePromise.then((title) => {
				const exact = [
					...title.results.flatMap((r) => [r.title, r.original]),
					...title.people.map((p) => p.name),
				].some(
					(t) =>
						t?.normalize("NFC").toLocaleLowerCase() ===
						q.normalize("NFC").toLocaleLowerCase(),
				);
				return exact
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
	const language = await languagePromise;
	lap("language");
	chargedNano += language.chargedNano;
	// Jev reads the normalized text, so the reading and its cache entry don't depend on case or spacing.
	const readText = readingText(language.text);
	// Title matches load now. Preparation waits until a fresh reading is claimed, so basic searches save encoder CPU.
	// The fresh reading's call takes about 300 ms at p50, enough for preparation to fit inside it. A cached reading
	// prepares after the cache lookup instead of alongside it, through rankSearch when prepared is undefined.
	const early: {
		titles: ReturnType<typeof titleMatches>;
		prepared?: Promise<PreparedSearch>;
	} = {
		titles: titleMatches(titlePromise, policy),
	};
	early.titles.catch(() => {});
	const readingSteps: Record<string, number> = {};
	const outcome: JevOutcome = await runJevStage({
		onClaimed: () => {
			if (servingFallback({ hasReading: true })) return;
			early.prepared = prepareSearch({
				query: q,
				text: language.text,
				nonEnglish: language.policy.mode !== "english",
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
	// The ranking serves every search with a reading. The basic search serves the others, and the searches the ranking
	// can't serve (see serve.server.ts); the reason goes on the history row.
	let fallback: ServingFallback | null = servingFallback({
		hasReading: outcome.kind !== "basic",
	});
	let served: ServedList | null = null;
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
			);
			Object.assign(stageMs, served.stageMs);
		} catch (error) {
			if (signal.aborted) throw new Error("Search interrupted");
			fallback = error instanceof RankingDeadlineError ? "timeout" : "error";
			console.error("Search ranking failed; the basic search serves", error);
			stageMs.failedRanking =
				Math.round((performance.now() - attempt) * 10) / 10;
		}
		mark = performance.now();
	}
	const { rows, metadata } = served ?? (await basicList());
	async function basicList() {
		let results: Result[] = [];
		errors.push(BASIC_SEARCH_MESSAGE);
		try {
			results = await literal(q, policy);
		} catch {
			errors.push("Description search unavailable");
		}
		lap("ranking");
		const title = await titlePromise;
		lap("titleLookup");
		if ("error" in title) errors.push("Title lookup unavailable");
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
		const metadata = await metadataFor([...new Set(keys)]);
		const meta = new Map(
			metadata.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]),
		);
		const allowedTitles = titleRows.filter((t) =>
			eligible(meta.get(titleKey(t)), policy, false),
		);
		const description = results.filter((r) =>
			eligible(meta.get(`${r.media_type}:${r.tmdb_id}`), policy, true),
		);
		const identities = new Set<string>();
		const rows = blend(
			allowedTitles,
			{ results: description },
			q,
			"balanced",
		).filter((r) => {
			const m = meta.get(r.key),
				identity = m?.imdb_id?.trim() ? `imdb:${m.imdb_id.trim()}` : r.key;
			if (identities.has(identity)) return false;
			identities.add(identity);
			return true;
		});
		if ("error" in title && errors.includes("Description search unavailable"))
			throw new Error("Search unavailable");
		lap("display");
		return { rows, metadata };
	}
	if (served?.titleError) errors.push("Title lookup unavailable");
	const shown = await shownPeople;
	const elapsedMs = Date.now() - started;
	stageMs.total = elapsedMs;
	// The history row is written after the response: nothing in the results depends on it. When the session check
	// failed, the search records nothing.
	const entry = {
		text: query,
		elapsedMs,
		chargedNano,
		outcome: errors.includes(BASIC_SEARCH_MESSAGE)
			? ("basic" as const)
			: outcome.kind,
		...(outcome.kind === "basic" ? { reason: outcome.reason } : {}),
		rankerVersion: served ? served.rankerVersion : BASIC_RANKER_VERSION,
		...(fallback ? { rankerFallback: fallback } : {}),
		stageMs,
	};
	setImmediate(() => {
		Promise.resolve(visitor.accountId).then(
			(accountId) => recordSearchHistory({ ...entry, accountId }),
			() => {},
		);
	});
	return {
		q: query,
		rows,
		reading,
		metadata,
		errors,
		mode: language.policy.mode,
		elapsedMs,
		chargedNano,
		people: shown,
		creditScope: people.scope
			? { people: people.scope.people, text: people.scope.text }
			: null,
	};
}
