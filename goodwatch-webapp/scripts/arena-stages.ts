// Search arena: time each downstream stage of production search for cached readings.
// Read-only: the reading cache is read (Redis GET, Crate SELECT) without writing back;
// a missing reading is fetched straight from Jev without persisting it.
// Run: ARENA_TIMED_FETCH=1 npx vite-node --config scripts/arena-vite.config.mjs scripts/arena-stages.ts
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { fetch } from "undici";
import { QdrantClient } from "@qdrant/js-client-rest";
import { TypeSafeClient, type SystemOneRequest } from "@typesafe-ai/sdk";
import {
	attributeRequest,
	fingerprintRequest,
	retrieveByReading,
	type Eligibility,
} from "~/server/combined-search/reading-retrieval.server";
import { metadataFor, searchQuery } from "~/server/combined-search/catalog.server";
import { LANGUAGE_VERSION, nonEnglish } from "~/server/combined-search/language.server";
import { JEV_MODEL, getSearchStore } from "~/server/search-runtime/runtime.server";
import { getRedisCluster } from "~/utils/cache";

const calls = (globalThis as any).__arenaCalls as { label: string; ms: number; rows?: number }[];
if (!calls) throw new Error("run with ARENA_TIMED_FETCH=1");
// Qdrant uses its own undici Agent: time the client methods instead.
for (const method of ["query", "retrieve"] as const) {
	const original = (QdrantClient.prototype as any)[method];
	(QdrantClient.prototype as any)[method] = async function (...args: unknown[]) {
		const t = performance.now();
		if (method === "query") ((globalThis as any).__qdrantArgs ??= []).push(args[1]);
		const r = await original.apply(this, args);
		calls.push({
			label: `qdrant.${method}`,
			ms: performance.now() - t,
			rows: method === "query" ? r.points.length : r.length,
		});
		return r;
	};
}

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value && typeof value === "object")
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
			.join(",")}}`;
	return JSON.stringify(value);
}
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

async function reading(q: string) {
	const language = {
		mode: nonEnglish(q) ? "native-vector-only" : "english",
		version: LANGUAGE_VERSION,
	};
	const requests = [attributeRequest(q), fingerprintRequest(q)].map((r) => ({
		state: r.state,
		questions: r.questions,
		model: JEV_MODEL,
	})) as [SystemOneRequest, SystemOneRequest];
	const contract = `d4+/${JEV_MODEL}/accepted-d4-corrected-v1/${language.mode}/${language.version}`;
	const key = store.digest(
		canonical({ contract, language, requests, text: q.trim().normalize("NFC") }),
	);
	const t = performance.now();
	const fast = await getRedisCluster()
		?.get(`{goodwatch-search-v2}:interpretation:${key}`)
		.catch(() => null);
	const redisMs = performance.now() - t;
	let ciphertext = fast ?? undefined;
	let source = fast ? "redis" : "";
	if (!ciphertext) {
		const [row] = await searchQuery<{ status: string; ciphertext: string }>(
			"SELECT status, ciphertext FROM doc.search_interpretations WHERE cache_key = ?",
			[key],
		);
		if (row?.status === "ready") {
			ciphertext = row.ciphertext;
			source = "crate";
		}
	}
	const cacheMs = performance.now() - t;
	if (ciphertext)
		return { source, redisMs, cacheMs, readings: store.unseal(ciphertext) as any, jev: null };
	const jev: Record<string, number> = {};
	const readings = await Promise.all(
		requests.map(async (r, i) => {
			const s = performance.now();
			const out = await client.systemOne(r);
			jev[i ? "fingerprintMs" : "attributeMs"] = performance.now() - s;
			jev[i ? "fingerprintTokens" : "attributeTokens"] = out.usage.input_tokens;
			return out;
		}),
	);
	return { source: "jev", redisMs, cacheMs, readings: readings as any, jev };
}

// Copy of search.server.ts lookupTitles network shape: page 1, then up to 4 more pages in parallel.
async function titles(q: string) {
	const page = async (n: number) => {
		const params = new URLSearchParams({
			api_key: process.env.TMDB_API_KEY || "",
			query: q,
			language: "en-US",
			include_adult: "false",
			page: String(n),
		});
		const r = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`, {
			signal: AbortSignal.timeout(8000),
		});
		return (await r.json()) as { total_pages?: number; results?: any[] };
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
		.filter((r) => ["movie", "tv"].includes(r.media_type));
}

const queries = [
	"fantasy with dragons",
	"scifi with cars",
	"like groundhog day",
	"feel good cooking show",
	"tense heist thriller, not bleak",
	"slow burn space horror",
	"scifi with sunglasses",
	"dark comedy about a wedding",
];
const policy: Eligibility = { includeAdult: false, lesserKnown: false };
const rows: unknown[] = [];
const VECTOR_ONLY = process.env.VECTOR_ONLY === "1";
const cachedOnly = VECTOR_ONLY ? queries.slice(0, 6) : queries;
for (const pass of VECTOR_ONLY ? [1, 2, 3] : [1, 2]) {
	for (const q of cachedOnly) {
		calls.length = 0;
		const r = await reading(q);
		calls.length = 0;
		const t0 = performance.now();
		// Production runs the title lookup in parallel with the reading; time both here.
		const titlePromise = (async () => {
			const s = performance.now();
			const t = await titles(q);
			return { t, ms: performance.now() - s };
		})();
		const s = performance.now();
		const results = await retrieveByReading(q, r.readings, policy, VECTOR_ONLY);
		const retrieveMs = performance.now() - s;
		const title = await titlePromise;
		const m = performance.now();
		const keys = [
			...title.t.map((t) => `${t.media_type === "tv" ? "show" : "movie"}:${t.id}`),
			...results.map((x) => `${x.media_type}:${x.tmdb_id}`),
		];
		await metadataFor([...new Set(keys)]);
		const metadataMs = performance.now() - m;
		const row = {
			pass,
			q,
			source: r.source,
			cacheMs: Math.round(r.cacheMs),
			jev: r.jev,
			retrieveMs: Math.round(retrieveMs),
			titleMs: Math.round(title.ms),
			metadataMs: Math.round(metadataMs),
			afterReadingMs: Math.round(performance.now() - t0),
			results: results.length,
			calls: calls.map((c) => ({ ...c, ms: Math.round(c.ms) })),
		};
		rows.push(row);
		console.log(JSON.stringify(row));
	}
}
writeFileSync(process.env.OUT || "/dev/null", JSON.stringify(rows, null, 2));
if (process.env.QARGS) writeFileSync(process.env.QARGS, JSON.stringify((globalThis as any).__qdrantArgs ?? []));
process.exit(0);
