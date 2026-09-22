// PROTOTYPE - capture candidate pools per query for docs/prototypes/ranking-lab/index.html
// Usage: npx vite-node scripts/ranking-lab-capture.ts out.json "query" ...
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { MEDIA_COLLECTION, parsePointId } from "../app/utils/qdrant";
import { searchQuery } from "../app/server/combined-search/catalog.server";
import { runJevStage } from "../app/server/search-runtime/runtime.server";
import { prepareLanguage } from "../app/server/combined-search/language.server";
import {
	attributeRequest,
	fingerprintRequest,
	retrieveD4,
	prototypeParts as P,
} from "../app/server/combined-search/d4.server";

const [out, ...queries] = process.argv.slice(2);
const visitor = { accountId: null, networkIdentity: "127.0.0.1" };
const eligibility = { includeAdult: false, lesserKnown: false };
const captures: unknown[] = [];

for (const q of queries) {
	const signal = new AbortController().signal;
	const language = await prepareLanguage(q, visitor, signal);
	const outcome = await runJevStage({
		requestText: q,
		questionVersion: "accepted-d4-corrected-v1",
		language: language.policy,
		requests: [attributeRequest(language.text), fingerprintRequest(language.text)],
		visitor,
		signal,
	});
	if (outcome.kind === "basic") { console.log(`skip ${q}: basic`); continue; }
	const answers = outcome.readings.map((r) => r.answers as Record<string, never>);
	const attributes = P.decodeAttributes(language.text, answers[0]);
	const reading = P.decodeFingerprint(answers[1]);
	const weights = P.pick(reading.details, P.isQueryDimension, P.MAX_QUERY_DIMENSIONS);
	const used = Object.entries(weights) as [string, number][];
	const vector = P.sparseVector(weights);
	const filter = P.qdrantFilter(attributes.flags, eligibility);
	// Vector pool: plain cosine prefetch, as retrieve does before ranking
	const t0 = Date.now();
	const response = await P.getQdrant().query(MEDIA_COLLECTION, {
		query: vector, using: "fingerprint_v1", filter: filter as never, limit: P.PREFETCH_LIMIT,
		with_payload: used.map(([k]) => `fingerprint_scores_v1.${k}`),
	});
	const vectorMs = Date.now() - t0;
	const vectorPool = response.points.map((p) => {
		const { mediaType, tmdbId } = parsePointId(Number(p.id));
		const scores = (p.payload as { fingerprint_scores_v1?: Record<string, number> })?.fingerprint_scores_v1 ?? {};
		return { key: `${mediaType}:${tmdbId}`, cosine: p.score, fp: Object.fromEntries(used.map(([k]) => [k, scores[k] ?? 0])) };
	});
	// Text pool: what runPhraseVariant assembled (branch-only field)
	const t1 = Date.now();
	const textRun = (await retrieveD4(language.text, outcome.readings, eligibility, false)) as unknown as {
		textPool?: { key: string; fp: Record<string, number>; text: number; evidence: string[] }[]; gated?: boolean; notes?: string[]; tropeMode: string;
	};
	const textMs = Date.now() - t1;
	const textPool = (textRun.textPool ?? []).map((r) => ({ key: r.key, fp: r.fp, text: r.text, evidence: r.evidence }));
	// Titles for every candidate
	const keys = [...new Set([...vectorPool.map((r) => r.key), ...textPool.map((r) => r.key)])];
	const titles: Record<string, { title: string; year: number }> = {};
	for (const table of ["movie", "show"] as const) {
		const ids = keys.filter((k) => k.startsWith(`${table}:`)).map((k) => k.split(":")[1]);
		for (let i = 0; i < ids.length; i += 1000) {
			const rows = await searchQuery<{ tmdb_id: number; title: string; release_year: number }>(
				`SELECT tmdb_id, title, release_year FROM ${table} WHERE tmdb_id IN (${ids.slice(i, i + 1000).join(",")})`,
			);
			for (const r of rows) titles[`${table}:${r.tmdb_id}`] = { title: r.title, year: r.release_year };
		}
	}
	captures.push({
		query: q, language: language.policy.mode, used, flags: attributes.flags.filter((f) => f.decision),
		gated: textRun.gated ?? null, tropeMode: textRun.tropeMode, notes: textRun.notes ?? [], vectorMs, textMs,
		vectorPool, textPool, titles,
	});
	console.log(`${q}: vector ${vectorPool.length} (${vectorMs} ms), text ${textPool.length} (${textMs} ms), gated ${textRun.gated}`);
	writeFileSync(out, JSON.stringify(captures));
}
process.exit(0);
