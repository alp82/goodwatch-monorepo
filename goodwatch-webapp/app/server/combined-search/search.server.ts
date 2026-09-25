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
	retrieveByReading,
	summarizeReading,
	type Eligibility,
	type ReadingChip,
	type Result,
	READING_RANKER_VERSION,
} from "./reading-retrieval.server";
import { toCrateSql } from "./search-filters";
import {
	eligible,
	metadataFor,
	searchQuery,
	type Metadata,
} from "./catalog.server";
import { prepareLanguage } from "./language.server";
import {
	BASIC_SEARCH_MESSAGE,
	runJevStage,
	recordSearchHistory,
	type JevStageInput,
	type JevOutcome,
	translationEnabled,
} from "../search-runtime/runtime.server";
import { getSearchRankingMode } from "../search-ranking/mode.server";
import {
	shadowRank,
	startShadowRanking,
} from "../search-ranking/shadow.server";
import {
	RankingDeadlineError,
	rankForServing,
	servingFallback,
	type ServingFallback,
} from "../search-ranking/serve.server";

// Modes shadow and on load the new ranking's index and query models at server start. Off by default: then nothing
// loads.
startShadowRanking();

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
	historyRecorded: boolean;
}
// Title lookups depend only on the text and the adult policy, never on filter chips,
// so filter-only refetches reuse them. Search text is private: entries stay in this
// process, keyed by a digest, and are never written to a shared store or logged.
const TITLE_TTL_MS = 10 * 60 * 1000;
const TITLE_ENTRIES = 200;
const titleCache = new Map<string, { at: number; value: Title[] }>();
const titleFlights = new Map<string, Promise<Title[]>>();
function titles(
	q: string,
	policy: Eligibility,
	signal: AbortSignal,
): Promise<Title[]> {
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
	return new Promise<Title[]>((resolve, reject) => {
		const leave = () => reject(new Error("Search interrupted"));
		if (signal.aborted) return leave();
		signal.addEventListener("abort", leave, { once: true });
		shared
			.then(resolve, reject)
			.finally(() => signal.removeEventListener("abort", leave));
	});
}
async function lookupTitles(q: string, policy: Eligibility): Promise<Title[]> {
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
				popularity?: number;
				adult?: boolean;
				known_for?: { title?: string; name?: string }[];
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
	return [first, ...rest]
		.flatMap((p) => p.results || [])
		.filter(
			(r) =>
				["movie", "tv", "person"].includes(r.media_type) &&
				(policy.includeAdult || r.adult !== true),
		)
		.map((r) => ({
			id: r.id,
			title: r.title || r.name || "Untitled",
			original: r.original_title || r.original_name,
			type: r.media_type,
			year: (r.release_date || r.first_air_date || "").slice(0, 4),
			poster: r.poster_path || r.profile_path || null,
			popularity: r.popularity || 0,
			adult: r.adult,
			knownFor: (r.known_for || [])
				.map((t: { title?: string; name?: string }) => t.title || t.name)
				.join(", "),
		}));
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
				`SELECT tmdb_id,title,release_year,poster_path,genres,_score FROM ${type} WHERE essence_text IS NOT NULL AND ${policy.lesserKnown ? "true" : "goodwatch_overall_score_voting_count >= 2000"} AND ${policy.includeAdult ? "true" : "NOT coalesce(adult,false)"}${chips.sql} AND match((essence_text 2.0, synopsis), ?) ORDER BY _score DESC LIMIT 100`,
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
const TMDB_ID_RANGE = 1_000_000_000_000;
const DISPLAY_TIMEOUT_MS = 2000;
const round1 = (ms: number) => Math.round(ms * 10) / 10;
const titleKey = (t: Title) => `${t.type === "tv" ? "show" : t.type}:${t.id}`;

interface ServedList {
	rows: Row[];
	metadata: Metadata[];
	rankerVersion: string;
	titleError: boolean;
	stageMs: Record<string, number>;
}

/**
 * The new ranking's list (SEARCH_RANKING_MODE=on), in the response's row format: the ranker's blended list, with
 * the title lookup's rows, the display fields and reason chips of each title, and the catalog metadata. Throws when
 * the ranking fails or misses its deadline; the caller then serves today's ranking.
 */
async function rankedList(
	q: string,
	language: { text: string; policy: { mode: string } },
	readings: Parameters<typeof readingFields>[1],
	policy: Eligibility,
	titlePromise: Promise<{ results: Title[]; error?: boolean }>,
	signal: AbortSignal,
): Promise<ServedList> {
	const started = performance.now();
	const title = await titlePromise;
	const titleDone = performance.now();
	if (signal.aborted) throw new Error("Search interrupted");
	const titleRows = title.results.filter((t) => t.type !== "person");
	const titleMeta = await metadataFor([...new Set(titleRows.map(titleKey))]);
	const meta = new Map(titleMeta.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]));
	const allowedTitles = titleRows.filter((t) =>
		eligible(meta.get(titleKey(t)), policy, false),
	);
	const lookup = new Map(allowedTitles.map((t) => [titleKey(t), t]));
	const fields = readingFields(
		language.text,
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
		},
		policy,
	);
	const rankDone = performance.now();
	if (signal.aborted) throw new Error("Search interrupted");
	const listed = ranked.results.map((r) => ({
		key: `${r.mediaType}:${r.id % TMDB_ID_RANGE}`,
		tmdbId: r.id % TMDB_ID_RANGE,
		mediaType: r.mediaType,
		blended: r,
	}));
	const [described, rankedMeta] = await Promise.all([
		describeTitles(fields, listed, { timeoutMs: DISPLAY_TIMEOUT_MS }),
		metadataFor(listed.map((r) => r.key).filter((key) => !meta.has(key))),
	]);
	for (const m of rankedMeta) meta.set(`${m.media_type}:${m.tmdb_id}`, m);
	const display = new Map(
		described.map((d) => [`${d.media_type}:${d.tmdb_id}`, d]),
	);
	const identities = new Set<string>();
	const rows: Row[] = [];
	for (const { key, blended } of listed) {
		const found = lookup.get(key);
		const m = meta.get(key);
		const shown = display.get(key);
		// Same checks as today's list: eligibility from the catalog, and one row per IMDb title.
		if (!eligible(m, policy, !found)) continue;
		if (!found && !shown) continue;
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
			knownFor: found?.knownFor,
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
	q: string,
	policy: Eligibility,
	visitor: JevStageInput["visitor"],
	signal: AbortSignal,
	// Called once the interpretation is known and before retrieval, so the caller can
	// show it while the results are still on their way.
	onReading?: (reading: ReadingChip[]) => void,
	// Runs work that must not delay the response (shadow ranking) once the response is sent.
	afterResponse?: (task: () => void) => void,
): Promise<SearchBatch> {
	const started = Date.now(),
		errors: string[] = [];
	let chargedNano = 0;
	// Milliseconds per stage, in order: the language step, the Jev reading, the ranking (with its Qdrant time), the
	// wait for the title lookup that runs alongside, and the display (catalog metadata and the blend).
	const stageMs: Record<string, number> = {};
	let mark = performance.now();
	const lap = (name: string) => {
		const now = performance.now();
		stageMs[name] = Math.round((now - mark) * 10) / 10;
		mark = now;
	};
	const titlePromise = titles(q, policy, signal).then(
		(results) => ({ results }),
		() => ({ results: [] as Title[], error: true }),
	);
	// English/default-off interpretation and native title lookup run in parallel.
	const languagePromise = !translationEnabled()
		? prepareLanguage(q, visitor, signal)
		: titlePromise.then((title) => {
				const exact = title.results.some((r) =>
					[r.title, r.original].some(
						(t) =>
							t?.normalize("NFC").toLocaleLowerCase() ===
							q.normalize("NFC").toLocaleLowerCase(),
					),
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
	const mode = getSearchRankingMode();
	// The eligible title lookup rows, for shadow mode.
	let shadowTitles: Title[] = [];
	const language = await languagePromise;
	lap("language");
	chargedNano += language.chargedNano;
	const outcome: JevOutcome = await runJevStage({
		requestText: q,
		questionVersion: "accepted-d4-corrected-v1",
		language: language.policy,
		requests: [
			attributeRequest(language.text),
			fingerprintRequest(language.text),
		],
		visitor,
		signal,
		admissionAttemptId: language.admissionAttemptId,
	});
	lap("reading");
	chargedNano += outcome.chargedNano;
	let reading: ReadingChip[] = [];
	if (outcome.kind !== "basic") {
		reading = summarizeReading(
			language.text,
			outcome.readings,
			language.policy.mode === "native-vector-only",
		);
		onReading?.(reading);
	}
	// SEARCH_RANKING_MODE=on: the new ranking serves unless it can't (see serve.server.ts); then today's ranking
	// serves, and the reason goes on the history row.
	let fallback: ServingFallback | null = null;
	let served: ServedList | null = null;
	if (mode === "on") {
		fallback = servingFallback({
			hasReading: outcome.kind !== "basic",
			eligibility: policy,
		});
		if (!fallback && outcome.kind !== "basic") {
			const attempt = performance.now();
			try {
				served = await rankedList(
					q,
					language,
					outcome.readings,
					policy,
					titlePromise,
					signal,
				);
				Object.assign(stageMs, served.stageMs);
			} catch (error) {
				if (signal.aborted) throw new Error("Search interrupted");
				fallback = error instanceof RankingDeadlineError ? "timeout" : "error";
				console.error(
					"Search ranking failed; the current ranking serves",
					error,
				);
				stageMs.failedRanking =
					Math.round((performance.now() - attempt) * 10) / 10;
			}
			mark = performance.now();
		}
	}
	const { rows, metadata } = served ?? (await currentList());
	async function currentList() {
		let results: Result[] = [];
		const retrieval: { qdrantMs?: number } = {};
		if (outcome.kind === "basic") {
			errors.push(BASIC_SEARCH_MESSAGE);
			try {
				results = await literal(q, policy);
			} catch {
				errors.push("Description search unavailable");
			}
		} else {
			try {
				results = await retrieveByReading(
					language.text,
					outcome.readings,
					policy,
					language.policy.mode === "native-vector-only",
					retrieval,
				);
			} catch {
				errors.push(BASIC_SEARCH_MESSAGE);
				try {
					results = await literal(q, policy);
				} catch {
					errors.push("Description search unavailable");
				}
			}
		}
		lap("ranking");
		if (retrieval.qdrantMs !== undefined)
			stageMs.rankingQdrant = retrieval.qdrantMs;
		const title = await titlePromise;
		lap("titleLookup");
		if ("error" in title) errors.push("Title lookup unavailable");
		if (signal.aborted) throw new Error("Search interrupted");
		// Catalog metadata is authoritative for eligibility and reliable identity. Fetch before
		// blend so an ineligible discovery hit cannot boost a title's rank or use a snapshot slot.
		const keys = [
			...title.results
				.filter((t) => t.type !== "person")
				.map((t) => `${t.type === "tv" ? "show" : t.type}:${t.id}`),
			...results.map((r) => `${r.media_type}:${r.tmdb_id}`),
		];
		const metadata = await metadataFor([...new Set(keys)]);
		const meta = new Map(
			metadata.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]),
		);
		const allowedTitles = title.results.filter((t) =>
			eligible(
				meta.get(`${t.type === "tv" ? "show" : t.type}:${t.id}`),
				policy,
				false,
			),
		);
		shadowTitles = allowedTitles;
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
	const elapsedMs = Date.now() - started;
	stageMs.total = elapsedMs;
	const servedRankerVersion = served
		? served.rankerVersion
		: errors.includes(BASIC_SEARCH_MESSAGE)
			? BASIC_RANKER_VERSION
			: READING_RANKER_VERSION;
	const history = await recordSearchHistory({
		text: q,
		accountId: visitor.accountId,
		elapsedMs,
		chargedNano,
		outcome: errors.includes(BASIC_SEARCH_MESSAGE) ? "basic" : outcome.kind,
		...(outcome.kind === "basic" ? { reason: outcome.reason } : {}),
		rankerVersion: servedRankerVersion,
		...(fallback ? { rankerFallback: fallback } : {}),
		stageMs,
	});
	// Shadow mode only. In mode on, today's ranking isn't run next to the new one: it would double the Qdrant and
	// Crate work of every search.
	if (mode === "shadow") {
		const shadow = {
			historyId: history.id,
			query: q,
			text: language.text,
			nonEnglish: language.policy.mode !== "english",
			nativeOnly: language.policy.mode === "native-vector-only",
			readings: outcome.kind === "basic" ? null : outcome.readings,
			eligibility: policy,
			titleLookup: shadowTitles,
			servedRankerVersion,
			servedKeys: rows.map((r) => r.key),
		};
		const task = () => shadowRank(shadow);
		if (afterResponse) afterResponse(task);
		else setImmediate(task);
	}
	return {
		q,
		rows,
		reading,
		metadata,
		errors,
		mode: language.policy.mode,
		elapsedMs,
		chargedNano,
		historyRecorded: history.recorded,
	};
}
