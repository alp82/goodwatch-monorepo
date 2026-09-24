// Search arena: capture the per-query inputs of production search for offline ranking.
// For each query in docs/prototypes/search-arena/queries.json it writes
// data/captures/<id>.json with the Jev reading, the production ranked list, the Crate text
// evidence pool, the TMDB title lookup, and per-stage timings.
//
// Read-only against production. It mirrors combinedSearch step by step but:
// - reads the reading cache with Redis GET and Crate SELECT only (store.lookup would write
//   Redis back, store.claim/finish would write Crate), never calls runJevStage;
// - calls Jev directly on a cache miss and keeps the reading only in the local capture;
// - never calls recordSearchHistory.
// Translation is off in production (SEARCH_TRANSLATION_ENABLED unset), so the language step
// is prepareLanguage's offline routing.
//
// Run from goodwatch-webapp:
//   ARENA_CAPTURE_FETCH=1 npx vite-node --config scripts/arena-vite.config.mjs scripts/arena-capture.ts [--force] [--only id,id]
// Ad-hoc mode (search-arena playground): capture one query that isn't in queries.json to one file,
// without touching queries.json or captures/index.json:
//   ... scripts/arena-capture.ts --adhoc "<query>" --out <path>.json
// Existing captures are skipped unless --force. With --force, a reading that was fetched fresh
// before is reused from the old capture unless the production cache now holds one.
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fetch } from "undici";
import { QdrantClient } from "@qdrant/js-client-rest";
import { TypeSafeClient, type SystemOneRequest } from "@typesafe-ai/sdk";
import {
	attributeRequest,
	fingerprintRequest,
	retrieveD4,
	summarizeReading,
	type Eligibility,
	type Result,
} from "~/server/combined-search/d4.server";
import {
	eligible,
	metadataFor,
	searchQuery,
} from "~/server/combined-search/catalog.server";
import { toCrateSql } from "~/server/combined-search/search-filters";
import { prepareLanguage } from "~/server/combined-search/language.server";
import {
	JEV_DEADLINE_MS,
	JEV_MODEL,
	JEV_NANO_PER_TOKEN,
	getSearchStore,
	translationEnabled,
} from "~/server/search-runtime/runtime.server";
import { blend, type Title } from "~/ui/search/search-model";
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta";
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint";
import { getRedisCluster } from "~/utils/cache";

const ROOT = new URL("../../docs/prototypes/search-arena/", import.meta.url).pathname;
const OUT = `${ROOT}data/captures/`;
const SPEND_CAP_USD = 0.1;
const QUESTION_VERSION = "accepted-d4-corrected-v1"; // as combinedSearch passes it
const MOVIE_BASE = 1_000_000_000_000,
	SHOW_BASE = 2_000_000_000_000; // ~/utils/qdrant point ids
// Mirrors of d4.server.ts tunables used to decode the reading (checked against results below).
const FLAG_DECISION_PROBABILITY = 0.5,
	CONCRETE_WORD_PROBABILITY = 0.6,
	WANT_WEIGHT_MIN = 0.5,
	AVOID_WEIGHT_MIN = 1.2,
	SECOND_PHRASE_PROBABILITY = 0.15;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyArg = args[args.indexOf("--only") + 1];
const ONLY = args.includes("--only") ? new Set(onlyArg.split(",")) : null;
const ADHOC = args.includes("--adhoc") ? args[args.indexOf("--adhoc") + 1] : null;
const ADHOC_OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
if (ADHOC !== null && (!ADHOC.trim() || !ADHOC_OUT?.endsWith(".json")))
	throw new Error('--adhoc "<query>" needs --out <file>.json');

const captured = (globalThis as any).__arenaCaptured as {
	url: string;
	stmt?: string;
	args?: unknown[];
	ms: number;
	json?: any;
}[];
if (!captured) throw new Error("run with ARENA_CAPTURE_FETCH=1");
if (translationEnabled()) throw new Error("capture assumes translation is off, as in production");

// Qdrant uses its own undici Agent: time its client methods instead.
const qdrantCalls: { label: string; ms: number; rows: number; limit?: number }[] = [];
for (const method of ["query", "retrieve"] as const) {
	const original = (QdrantClient.prototype as any)[method];
	(QdrantClient.prototype as any)[method] = async function (...a: any[]) {
		const t = performance.now();
		const r = await original.apply(this, a);
		qdrantCalls.push({
			label: `qdrant.${method}`,
			ms: Math.round(performance.now() - t),
			rows: method === "query" ? r.points.length : r.length,
			limit: a[1]?.limit,
		});
		return r;
	};
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const ms = (t: number) => Math.round(performance.now() - t);
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value && typeof value === "object")
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
			.join(",")}}`;
	return JSON.stringify(value);
}
const rowsOf = (json: any) =>
	(json?.rows ?? []).map((row: unknown[]) =>
		Object.fromEntries((json.cols as string[]).map((c, i) => [c, row[i]])),
	) as Record<string, any>[];

const store = getSearchStore();
const client = new TypeSafeClient({
	fetch: fetch as unknown as typeof globalThis.fetch,
	apiKey: process.env.TYPESAFE_API_KEY!,
	baseURL: "https://api.typesafe.ai",
	defaultModel: JEV_MODEL,
	timeout: 15000,
	retry: { maxRetries: 0 },
	logLevel: "off",
});

// --- Reading: cache lookup (read-only) or a direct Jev call --------------------------------
let spentNano = 0;
async function reading(
	requestText: string,
	language: Awaited<ReturnType<typeof prepareLanguage>>,
	previous: any,
) {
	const timings: Record<string, number> = {};
	const requests = [attributeRequest(language.text), fingerprintRequest(language.text)].map(
		(r) => ({ state: r.state, questions: r.questions, model: JEV_MODEL }),
	) as [SystemOneRequest, SystemOneRequest];
	if (requests.some((r) => Buffer.byteLength(JSON.stringify(r), "utf8") > 65536))
		return { requests, timings, basic: "input" as const };
	const contract = `d4+/${JEV_MODEL}/${QUESTION_VERSION}/${language.policy.mode}/${language.policy.version}`;
	const cacheKey = store.digest(
		canonical({
			contract,
			language: language.policy,
			requests,
			text: requestText.trim().normalize("NFC"),
		}),
	);
	let t = performance.now();
	const fast = await getRedisCluster()
		?.get(`{goodwatch-search-v2}:interpretation:${cacheKey}`)
		.catch(() => null);
	timings.cacheRedisMs = ms(t);
	let ciphertext = fast ?? undefined;
	let cache = fast ? "redis" : "";
	if (!ciphertext) {
		t = performance.now();
		const [row] = await searchQuery<{ status: string; ciphertext: string }>(
			"SELECT status, ciphertext FROM doc.search_interpretations WHERE cache_key = ?",
			[cacheKey],
		);
		timings.cacheCrateMs = ms(t);
		if (row?.status === "ready") {
			ciphertext = row.ciphertext;
			cache = "crate";
		}
	}
	if (ciphertext)
		return {
			requests,
			timings,
			source: "cache" as const,
			cache,
			readings: store.unseal(ciphertext) as any[],
		};
	if (previous?.reading?.raw && previous.reading.source === "fresh")
		return {
			requests,
			timings: { ...previous.timings?.reading, reusedLocal: 1 },
			source: "fresh" as const,
			reusedLocal: true,
			readings: previous.reading.raw,
			jev: previous.reading.jev,
		};
	const reserve = 2 * 4500 * JEV_NANO_PER_TOKEN; // generous per-call estimate
	if ((spentNano + reserve) / 1e9 > SPEND_CAP_USD)
		return { requests, timings, basic: "spend-cap" as const };
	const jev: Record<string, number> = {};
	t = performance.now();
	try {
		const readings = await Promise.all(
			requests.map(async (r, i) => {
				const s = performance.now();
				const out = await client.systemOne(r);
				jev[i ? "fingerprintMs" : "attributeMs"] = ms(s);
				jev[i ? "fingerprintTokens" : "attributeTokens"] = out.usage.input_tokens;
				spentNano += out.usage.input_tokens * JEV_NANO_PER_TOKEN;
				return out;
			}),
		);
		timings.jevMs = ms(t);
		jev.usd = round(((jev.attributeTokens + jev.fingerprintTokens) * JEV_NANO_PER_TOKEN) / 1e9, 6);
		// Production would have given up at JEV_DEADLINE_MS and fallen back to basic search.
		const wouldMissDeadline = timings.jevMs > JEV_DEADLINE_MS;
		const valid = readings.every(
			(result, index) =>
				result.model === JEV_MODEL &&
				Object.keys(requests[index].questions).every(
					(key) => (result.answers as any)?.[key]?.type === requests[index].questions[key].type,
				),
		);
		if (!valid) return { requests, timings, basic: "contract" as const, jev };
		return { requests, timings, source: "fresh" as const, readings, jev, wouldMissDeadline };
	} catch (e) {
		timings.jevMs = ms(t);
		return { requests, timings, basic: "provider" as const, jev, error: String(e) };
	}
}

// --- Decode the reading into the named parts retrieveD4 uses --------------------------------
const label = (key: string) => FINGERPRINT_META[key]?.label ?? key;
function decode(requests: SystemOneRequest[], readings: any[]) {
	const [attrReq] = requests;
	const a = readings[0].answers,
		f = readings[1].answers;
	const questions = attrReq.questions as Record<string, any>;
	const flagIds = Object.keys(questions).filter((k) => !k.startsWith("word:") && k !== "phrase");
	const flags = flagIds.map((id) => {
		const p = a[id].probabilities as Record<string, number>;
		const required = p.required ?? 0,
			excluded = p.excluded ?? 0;
		const decision =
			required >= FLAG_DECISION_PROBABILITY
				? "required"
				: excluded >= FLAG_DECISION_PROBABILITY
					? "excluded"
					: null;
		const soft = id.startsWith("suitability_") || id.startsWith("context_");
		return {
			id,
			label: /attribute "([^"]+)"/.exec(questions[id].instructions)?.[1] ?? id,
			kind: id === "movie" || id === "show" ? "media_type" : soft ? "soft" : "identity",
			choice: a[id].choice,
			probabilities: p,
			decision,
			// Soft flags only filter when required; an excluded soft flag is ignored.
			filters: decision === "required" || (decision === "excluded" && !soft),
		};
	});
	const words = (attrReq.state as any).words as string[];
	const concreteWords = words.map((word, i) => ({
		word,
		concrete: a[`word:${i}`].noul,
		isConcrete: a[`word:${i}`].noul >= CONCRETE_WORD_PROBABILITY,
	}));
	const phraseQ = questions.phrase;
	const candidates: string[] = phraseQ ? Object.keys(phraseQ.criteria) : words.slice(0, 1);
	const phrases = candidates
		.map((phrase) => ({
			phrase,
			probability: phraseQ ? (a.phrase.probabilities[phrase] ?? 0) : 1,
		}))
		.sort((x, y) => y.probability - x.probability);
	const best = phrases[0];
	const bestWord = best && !best.phrase.includes(" ") ? concreteWords.find((w) => w.word === best.phrase) : undefined;
	const moodGated = Boolean(bestWord && !bestWord.isConcrete);
	const searchedPhrases =
		best && !moodGated
			? [best, ...(phrases[1] && phrases[1].probability >= SECOND_PHRASE_PROBABILITY ? [phrases[1]] : [])]
			: [];
	const want: Record<string, number> = {},
		avoid: Record<string, number> = {},
		net: Record<string, number> = {};
	for (const key of VALID_FINGERPRINT_KEYS) {
		want[key] = f[`want:${key}`].noul;
		avoid[key] = f[`avoid:${key}`].noul;
		net[key] = 2 * (want[key] - avoid[key]); // unrounded: thresholds are float-sensitive
	}
	const byStrength = Object.entries(net).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
	let chosen = byStrength.filter(([, w]) => w >= WANT_WEIGHT_MIN || w <= -AVOID_WEIGHT_MIN);
	const fallbackSingleDimension = !chosen.length;
	if (!chosen.length) chosen = byStrength.slice(0, 1);
	return {
		flags,
		concreteWords,
		phrases,
		bestPhrase: best ?? null,
		moodGated,
		searchedPhrases,
		dimensions: {
			labels: Object.fromEntries(VALID_FINGERPRINT_KEYS.map((k) => [k, label(k)])),
			want,
			avoid,
			net,
			// The query weights retrieveD4 uses: 2 * (want - avoid), kept when >= 0.5 or <= -1.2.
			weights: Object.fromEntries(chosen),
			fallbackSingleDimension,
		},
	};
}

// --- TMDB title lookup: verbatim copy of search.server.ts lookupTitles (not exported) -------
async function lookupTitles(q: string, policy: Eligibility): Promise<Title[]> {
	const page = async (n: number) => {
		const params = new URLSearchParams({
			api_key: process.env.TMDB_API_KEY || "",
			query: q,
			language: "en-US",
			include_adult: String(policy.includeAdult),
			page: String(n),
		});
		const response = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`, {
			signal: AbortSignal.timeout(8000),
		});
		if (!response.ok) throw new Error("Title lookup unavailable");
		return response.json() as Promise<{ total_pages?: number; results?: any[] }>;
	};
	const first = await page(1);
	const rest = await Promise.all(
		Array.from({ length: Math.max(0, Math.min(5, first.total_pages || 1) - 1) }, (_, i) => page(i + 2)),
	);
	return [first, ...rest]
		.flatMap((p) => p.results || [])
		.filter(
			(r) => ["movie", "tv", "person"].includes(r.media_type) && (policy.includeAdult || r.adult !== true),
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
			knownFor: (r.known_for || []).map((t: { title?: string; name?: string }) => t.title || t.name).join(", "),
		}));
}

// Verbatim copy of search.server.ts literal (not exported): the basic-search fallback.
async function literal(q: string, policy: Eligibility): Promise<Result[]> {
	const groups = await Promise.all(
		(["movie", "show"] as const).map((type) => {
			const chips = toCrateSql(policy.filters, type);
			if (!chips) return Promise.resolve([]);
			return searchQuery<any>(
				`SELECT tmdb_id,title,release_year,poster_path,genres,_score FROM ${type} WHERE essence_text IS NOT NULL AND ${policy.lesserKnown ? "true" : "goodwatch_overall_score_voting_count >= 2000"} AND ${policy.includeAdult ? "true" : "NOT coalesce(adult,false)"}${chips.sql} AND match((essence_text 2.0, synopsis), ?) ORDER BY _score DESC LIMIT 100`,
				[...chips.params, q],
			).then((rows) => rows.map((r) => ({ ...r, media_type: type })));
		}),
	);
	return groups
		.flat()
		.sort((a, b) => b._score - a._score)
		.slice(0, 100)
		.map((r, i) => ({ ...r, rank: i + 1, weightedSum: 0, cosine: 0, combined: r._score, tropes: [], reasons: [], scores: [] }));
}

// --- Text pool: rebuilt from the Crate calls runPhraseVariant made --------------------------
function classify(stmt: string) {
	if (stmt.includes("search_interpretations")) return "cache";
	if (stmt.includes("phrase_prefix")) return "phrase";
	if (stmt.includes("ANY(keywords)")) return "keyword";
	if (stmt.includes("FROM trope WHERE match(name")) return "tropeName";
	if (/FROM trope\s+WHERE match\(\(name/.test(stmt)) return "tropeLayer";
	if (stmt.startsWith("SELECT tmdb_id,title,release_year")) return "literal";
	if (stmt.includes("SELECT tmdb_id, title, release_year, poster_path, genres, essence_tags")) return "display";
	if (stmt.includes("goodwatch_overall_score_voting_count, '")) return "metadata";
	if (stmt.includes("match((essence_text 2.0, synopsis)")) return "word";
	if (stmt.includes("essence_tags") && stmt.includes("tmdb_id IN (")) return "tropeTitles";
	return "other";
}
function textPool(calls: typeof captured, weights: Record<string, number>) {
	type Cand = {
		key: string;
		media_type: string;
		tmdb_id: number;
		phrase: Record<string, number>;
		word: Record<string, { score: number; normalized: number }>;
		keyword: string | null;
		trope: string | null;
		text: number;
		fp: Record<string, number>;
		tags: string[];
	};
	const pool = new Map<string, Cand>();
	const log: { kind: string; table?: string; params: unknown[]; rows: number; ms: number }[] = [];
	const tableOf = (stmt: string) => /FROM (movie|show)\b/.exec(stmt)?.[1] as "movie" | "show";
	const entry = (table: string, row: Record<string, any>) => {
		const key = `${table}:${row.tmdb_id}`;
		const c =
			pool.get(key) ??
			({
				key,
				media_type: table,
				tmdb_id: Number(row.tmdb_id),
				phrase: {},
				word: {},
				keyword: null,
				trope: null,
				text: 0,
				fp: Object.fromEntries(Object.keys(weights).map((k) => [k, Number(row[`fp_${k}`]) || 0])),
				tags: row.essence_tags ?? [],
			} as Cand);
		pool.set(key, c);
		return c;
	};
	const sql = calls.filter((c) => c.stmt);
	// Pair each word call with its phrase call (same searchEssence) to get production's `best`.
	const essence = new Map<string, { phrase: Record<string, any>[][]; word: Record<string, any>[][]; label: string }>();
	const groupKey = (words: string[]) => words.map((w) => w.replace(/s$/, "")).join(" ");
	let tropeNames = new Map<string, string>();
	let concreteWords = "";
	for (const c of sql) {
		const kind = classify(c.stmt!);
		const table = tableOf(c.stmt!);
		const rows = rowsOf(c.json);
		const params = c.args ?? [];
		log.push({ kind, table, params, rows: rows.length, ms: Math.round(c.ms) });
		if (kind === "phrase" || kind === "word") {
			// The phrase call's param is already the s-stripped phrase; the word call's params are the
			// word forms, whose first entry is the word itself.
			const g =
				kind === "phrase" ? String(params.at(-1)) : groupKey(params.map((p) => String(p).split(" ")[0]));
			const e = essence.get(g) ?? { phrase: [], word: [], label: g };
			if (kind === "word") e.label = params.map((p) => String(p).split(" ")[0]).join(" ");
			(kind === "phrase" ? e.phrase : e.word).push(rows.map((r) => ({ ...r, _table: table })));
			essence.set(g, e);
		} else if (kind === "keyword") {
			concreteWords = String(params[0] ?? "");
			for (const r of rows) {
				const cand = entry(table, r);
				cand.keyword = concreteWords;
				cand.text += 0.8;
			}
		} else if (kind === "tropeName") {
			tropeNames = new Map(rows.map((t) => [`${t.media_type}:${t.media_tmdb_id}`, t.name]));
		} else if (kind === "tropeTitles") {
			for (const r of rows) {
				const cand = entry(table, r);
				cand.trope = tropeNames.get(`${table}:${r.tmdb_id}`) ?? "";
				cand.text += 0.8;
			}
		}
	}
	for (const e of essence.values()) {
		const phrase = e.label;
		const wordRows = e.word.flat(),
			phraseRows = e.phrase.flat();
		const best = Math.max(...wordRows.map((r) => Number(r._score) || 0), ...phraseRows.map((r) => Number(r._score) || 0), 1);
		for (const r of wordRows) {
			const c = entry(r._table, r);
			const s = Number(r._score) || 0;
			c.word[phrase] = { score: round(s), normalized: round(s / best) };
			c.text += s / best;
		}
		for (const r of phraseRows) {
			const c = entry(r._table, r);
			c.phrase[phrase] = round(Number(r._score) || 0);
			c.text += 1;
		}
	}
	const candidates = [...pool.values()]
		.map((c) => ({ ...c, text: round(c.text) }))
		.sort((a, b) => b.text - a.text);
	return {
		note: "Per-source raw Crate _score (phrase: phrase_prefix slop 1; word: all words AND). keyword/trope fallbacks are unscored matches (production adds 0.8). `text` is production's summed evidence before the cap of 4 and the 0.5 weight. fp holds the used dimensions only.",
		calls: log.filter((l) => ["phrase", "word", "keyword", "tropeName", "tropeTitles", "tropeLayer"].includes(l.kind)),
		size: candidates.length,
		candidates,
	};
}

// --- Main loop -------------------------------------------------------------------------------
const queries = (
	ADHOC !== null
		? [{ id: `adhoc-${basename(ADHOC_OUT!, ".json")}`, query: ADHOC }]
		: JSON.parse(readFileSync(`${ROOT}queries.json`, "utf8"))
) as any[];
mkdirSync(ADHOC_OUT ? dirname(ADHOC_OUT) : OUT, { recursive: true });
// Wait for the Redis cluster the app connects on import, so the fast cache path is used.
for (let i = 0; i < 30 && !getRedisCluster(); i++) await new Promise((r) => setTimeout(r, 100));
console.log(`redis ${getRedisCluster() ? "ready" : "unavailable, Crate only"}`);

const policy: Eligibility = { includeAdult: false, lesserKnown: false };
const visitor = { accountId: null, networkIdentity: "arena-capture" };
const failures: { id: string; error: string }[] = [];
for (const q of queries) {
	if (ONLY && !ONLY.has(q.id)) continue;
	const path = ADHOC_OUT ?? `${OUT}${q.id}.json`;
	const previous = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
	if (previous && !FORCE) continue;
	try {
		captured.length = 0;
		qdrantCalls.length = 0;
		const signal = new AbortController().signal;
		const timings: Record<string, any> = {};
		const started = performance.now();
		// combinedSearch starts the title lookup first and runs it alongside everything else.
		const titleStarted = performance.now();
		const titlePromise = lookupTitles(q.query, policy).then(
			(results) => ({ results, ms: ms(titleStarted) }),
			(e) => ({ results: [] as Title[], error: String(e), ms: ms(titleStarted) }),
		);
		let t = performance.now();
		const language = await prepareLanguage(q.query, visitor, signal);
		timings.languageMs = ms(t);
		const vectorOnly = language.policy.mode === "native-vector-only";
		t = performance.now();
		const r = await reading(q.query, language, previous);
		timings.readingMs = ms(t);
		timings.reading = r.timings;
		const errors: string[] = [];
		let results: Result[] = [];
		let decoded: ReturnType<typeof decode> | null = null;
		let chips: unknown[] = [];
		let path_ = "";
		const retrieveFrom = captured.length;
		t = performance.now();
		if ("basic" in r && r.basic) {
			errors.push(`basic:${r.basic}`);
			path_ = "literal";
			results = await literal(q.query, policy);
		} else {
			decoded = decode(r.requests, r.readings);
			chips = summarizeReading(language.text, r.readings as any, vectorOnly);
			try {
				results = await retrieveD4(language.text, r.readings as any, policy, vectorOnly);
				path_ = vectorOnly ? "vector-only" : "phrase";
			} catch (e) {
				errors.push(`retrieve failed, basic: ${e}`);
				path_ = "literal";
				results = await literal(q.query, policy);
			}
		}
		timings.retrieveMs = ms(t);
		const retrieveCalls = captured.slice(retrieveFrom).filter((c) => c.stmt);
		const title = await titlePromise;
		timings.titleLookupMs = title.ms;
		if ("error" in title) errors.push("Title lookup unavailable");
		t = performance.now();
		const keys = [
			...title.results.filter((x) => x.type !== "person").map((x) => `${x.type === "tv" ? "show" : x.type}:${x.id}`),
			...results.map((x) => `${x.media_type}:${x.tmdb_id}`),
		];
		const metadata = await metadataFor([...new Set(keys)]);
		timings.metadataMs = ms(t);
		t = performance.now();
		const meta = new Map(metadata.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]));
		const allowedTitles = title.results.filter((x) =>
			eligible(meta.get(`${x.type === "tv" ? "show" : x.type}:${x.id}`), policy, false),
		);
		const description = results.filter((x) => eligible(meta.get(`${x.media_type}:${x.tmdb_id}`), policy, true));
		const identities = new Set<string>();
		const rows = blend(allowedTitles, { results: description }, q.query, "balanced").filter((row) => {
			const m = meta.get(row.key),
				identity = m?.imdb_id?.trim() ? `imdb:${m.imdb_id.trim()}` : row.key;
			if (identities.has(identity)) return false;
			identities.add(identity);
			return true;
		});
		timings.blendMs = ms(t);
		timings.totalMs = ms(started);
		timings.retrieveCalls = [
			...retrieveCalls.map((c) => ({ label: `crate.${classify(c.stmt!)}`, ms: Math.round(c.ms), rows: c.json?.rows?.length })),
			...qdrantCalls,
		];
		timings.note = "Dev machine to production stores; Crate/Qdrant round trips are 2-3x slower than from the app server. Qdrant calls are listed after Crate calls, not in call order.";

		const titleKeys = new Set(allowedTitles.map((x) => `${x.type === "tv" ? "show" : x.type}:${x.id}`));
		const prod = rows.map((row, i) => {
			const [media_type, id] = row.key.split(":");
			const d = row.discovery;
			// Text results always carry an evidence label; the Qdrant fill carries none (its cosine
			// can be 0 for sparse negative-only query vectors, so cosine can't tell them apart).
			const source = !d ? "title" : path_ === "literal" ? "literal" : d.tropes.length && !vectorOnly ? "text" : "vector";
			return {
				rank: i + 1,
				key: row.key,
				point_id: (media_type === "show" ? SHOW_BASE : MOVIE_BASE) + Number(id),
				tmdb_id: Number(id),
				media_type,
				title: row.title,
				year: row.year,
				score: round(row.score),
				source,
				titleHit: titleKeys.has(row.key),
				lexical: row.lexical,
				match: row.match,
				reasons: d?.reasons ?? [],
				evidence: (d?.tropes ?? []).map((x) => x.name),
				discovery: d
					? { rank: d.rank, combined: round(d.combined), weightedSum: round(d.weightedSum), cosine: round(d.cosine), text: d.tropes[0]?.score ?? null, scores: d.scores }
					: null,
			};
		});
		// Sanity check: the decoded query weights must equal what retrieveD4 used.
		if (decoded && results[0]?.scores?.length) {
			const used = Object.fromEntries(results[0].scores.map((s) => [s.key, round(s.weight, 6)]));
			const mine = Object.fromEntries(Object.entries(decoded.dimensions.weights).map(([k, w]) => [k, round(w, 6)]));
			if (canonical(used) !== canonical(mine)) errors.push("decoded weights differ from retrieveD4");
		}
		const capture = {
			id: q.id,
			query: q.query,
			capturedAt: new Date().toISOString(),
			policy,
			language: {
				text: language.text,
				mode: language.policy.mode,
				version: language.policy.version,
				detectedNonEnglish: vectorOnly,
				vectorOnly,
				translationEnabled: false,
			},
			reading:
				"basic" in r && r.basic
					? { source: null, basic: r.basic, jev: (r as any).jev ?? null, error: (r as any).error ?? null }
					: {
							source: r.source,
							cache: (r as any).cache ?? null,
							reusedLocal: (r as any).reusedLocal ?? false,
							jev: (r as any).jev ?? null,
							wouldMissDeadline: (r as any).wouldMissDeadline ?? false,
							model: JEV_MODEL,
							questionVersion: QUESTION_VERSION,
							...decoded,
							chips,
							raw: r.readings,
						},
			fallbackToBasic: path_ === "literal",
			path: path_,
			errors,
			prod,
			titleLookup: title.results.map((x) => {
				const key = `${x.type === "tv" ? "show" : x.type}:${x.id}`;
				return { ...x, key, eligible: x.type !== "person" && titleKeys.has(key) };
			}),
			retrieveD4: {
				returned: results.length,
				eligible: description.length,
			},
			textPool: path_ === "phrase" ? textPool(retrieveCalls, decoded?.dimensions.weights ?? {}) : null,
			timings,
		};
		writeFileSync(path, JSON.stringify(capture));
		console.log(
			`${q.id} ${capture.reading.source ?? "BASIC"} ${path_} pool=${capture.textPool?.size ?? "-"} rows=${prod.length} ${timings.totalMs}ms ${errors.join("; ")} spent=$${(spentNano / 1e9).toFixed(5)}`,
		);
	} catch (e) {
		failures.push({ id: q.id, error: String(e) });
		console.error(`${q.id} FAILED ${e}`);
	}
}

if (ADHOC !== null) {
	console.log(JSON.stringify({ jevUsdThisRun: spentNano / 1e9, failures }));
	process.exit(failures.length ? 1 : 0);
}

// --- Index -----------------------------------------------------------------------------------
const index: Record<string, unknown> = {};
let totalUsd = 0;
const anchorTotals = { queries: 0, must: 0, top10: 0, top50: 0 };
for (const q of queries) {
	const path = `${OUT}${q.id}.json`;
	if (!existsSync(path)) {
		index[q.id] = { missing: true };
		continue;
	}
	const c = JSON.parse(readFileSync(path, "utf8"));
	const jevUsd = c.reading?.jev?.usd ?? 0;
	totalUsd += jevUsd;
	const rank = new Map<string, number>(c.prod.map((p: any) => [p.key, p.rank as number]));
	const must = (q.anchors?.must ?? []) as any[];
	const anchors = must.length
		? {
				must: must.length,
				top10: must.filter((m) => (rank.get(`${m.media_type}:${m.tmdb_id}`) ?? 999) <= 10).length,
				top50: must.filter((m) => (rank.get(`${m.media_type}:${m.tmdb_id}`) ?? 999) <= 50).length,
				ranks: Object.fromEntries(must.map((m) => [m.title, rank.get(`${m.media_type}:${m.tmdb_id}`) ?? null])),
			}
		: null;
	if (anchors) {
		anchorTotals.queries++;
		anchorTotals.must += anchors.must;
		anchorTotals.top10 += anchors.top10;
		anchorTotals.top50 += anchors.top50;
	}
	index[q.id] = {
		query: q.query,
		readingSource: c.reading?.source ?? null,
		fallbackToBasic: c.fallbackToBasic,
		path: c.path,
		errors: c.errors,
		jevUsd,
		prodTop10: c.prod.slice(0, 10).map((p: any) => `${p.title} (${p.year})`),
		anchors,
	};
}
writeFileSync(
	`${OUT}index.json`,
	JSON.stringify({ generatedAt: new Date().toISOString(), jevUsdTotal: round(totalUsd, 6), anchorTotals, queries: index }, null, 1),
);
console.log(JSON.stringify({ jevUsdThisRun: spentNano / 1e9, jevUsdTotal: totalUsd, anchorTotals, failures }));
process.exit(0);
