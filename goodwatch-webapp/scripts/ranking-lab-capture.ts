// PROTOTYPE - capture candidate pools per query for docs/prototypes/ranking-lab/index.html
// Usage: npx vite-node scripts/ranking-lab-capture.ts out.json "query" ...
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { MEDIA_COLLECTION, parsePointId } from "../app/utils/qdrant";
import { searchQuery } from "../app/server/combined-search/catalog.server";
import { runJevStage } from "../app/server/search-runtime/runtime.server";
import { prepareLanguage } from "../app/server/combined-search/language.server";
import { attributeRequest, fingerprintRequest, prototypeParts as P } from "../app/server/combined-search/d4.server";

const [out, ...queries] = process.argv.slice(2);
const visitor = { accountId: null, networkIdentity: "127.0.0.1" };
const eligibility = { includeAdult: false, lesserKnown: false };
const captures: unknown[] = [];
const keyOf = (id: unknown) => { const { mediaType, tmdbId } = parsePointId(Number(id)); return `${mediaType}:${tmdbId}`; };
type Row = { key: string; fp: Record<string, number>; text: number; evidence: string[] };

for (const q of queries) {
	const signal = new AbortController().signal;
	const language = await prepareLanguage(q, visitor, signal);
	const outcome = await runJevStage({ requestText: q, questionVersion: "accepted-d4-corrected-v1", language: language.policy, requests: [attributeRequest(language.text), fingerprintRequest(language.text)], visitor, signal });
	if (outcome.kind === "basic") { console.log(`skip ${q}: basic`); continue; }
	const answers = outcome.readings.map((r) => r.answers as Record<string, never>);
	const attributes = P.decodeAttributes(language.text, answers[0]);
	const reading = P.decodeFingerprint(answers[1]);
	const weights = P.pick(reading.details, P.isQueryDimension, P.MAX_QUERY_DIMENSIONS);
	const used = Object.entries(weights) as [string, number][];
	const n = used.length;
	const vector = P.sparseVector(weights);
	const filter = P.qdrantFilter(attributes.flags, eligibility) as { must: unknown[]; must_not: unknown[] };
	const cond = used.map(([k, w]) => ({ key: `fingerprint_scores_v1.${k}`, range: w > 0 ? { gte: 6 } : { lte: 4 } }));
	const payload = used.map(([k]) => `fingerprint_scores_v1.${k}`);
	const fpOf = (p: { payload?: unknown }) => { const s = (p.payload as { fingerprint_scores_v1?: Record<string, number> })?.fingerprint_scores_v1 ?? {}; return Object.fromEntries(used.map(([k]) => [k, s[k] ?? 0])); };
	// Candidates A: plain cosine prefetch (today's pool)
	const t0 = Date.now();
	const cos = await P.getQdrant().query(MEDIA_COLLECTION, { query: vector, using: "fingerprint_v1", filter: filter as never, limit: P.PREFETCH_LIMIT, with_payload: payload });
	const vectorMs = Date.now() - t0;
	// Candidates B: three in-range tiers (n, n-1, n-2 hits), 1000 each by cosine, formula-ranked
	const tiers = [n, n - 1, n - 2].filter((k) => k >= 1);
	const t1 = Date.now();
	const tier = await P.getQdrant().query(MEDIA_COLLECTION, {
		prefetch: tiers.map((k) => ({ query: vector, using: "fingerprint_v1", filter: { ...filter, min_should: { min_count: k, conditions: cond } } as never, limit: 1000 })),
		query: { formula: { sum: cond } } as never, limit: 3000, with_payload: payload,
	});
	const tierMs = Date.now() - t1;
	const pool = new Map<string, { key: string; cosine: number | null; fp: Record<string, number>; src: string }>();
	for (const p of cos.points) pool.set(keyOf(p.id), { key: keyOf(p.id), cosine: p.score, fp: fpOf(p), src: "cosine" });
	for (const p of tier.points) { const k = keyOf(p.id); const e = pool.get(k); if (e) e.src = "both"; else pool.set(k, { key: k, cosine: null, fp: fpOf(p), src: "tier" }); }
	const vectorPool = [...pool.values()];
	// Text pool as today, then with keyword and trope evidence forced on
	const vectorQuery = { weights, vector, order: "weighted_sum" as const, genres: [] };
	const t2 = Date.now();
	const plain = await P.runPhraseVariant(language.text, { twoPhrases: true, moodGate: true, wider: true }, attributes, vectorQuery, eligibility);
	const textMs = Date.now() - t2;
	const t3 = Date.now();
	const wide = await P.runPhraseVariant(language.text, { twoPhrases: true, moodGate: true, wider: true, widerAlways: true }, attributes, vectorQuery, eligibility);
	const widerMs = Date.now() - t3;
	const plainRows = new Map((plain.textPool as Row[]).map((r) => [r.key, r]));
	const textPool = (wide.textPool as Row[]).map((r) => { const p = plainRows.get(r.key); return { key: r.key, fp: r.fp, text: p?.text ?? 0, textWide: r.text, evidence: r.evidence, wider: !p }; });
	// Titles and votes for every candidate
	const keys = [...new Set([...vectorPool.map((r) => r.key), ...textPool.map((r) => r.key)])];
	const titles: Record<string, { title: string; year: number; votes: number }> = {};
	for (const table of ["movie", "show"] as const) {
		const ids = keys.filter((k) => k.startsWith(`${table}:`)).map((k) => k.split(":")[1]);
		for (let i = 0; i < ids.length; i += 1000) {
			const rows = await searchQuery<{ tmdb_id: number; title: string; release_year: number; votes: number }>(`SELECT tmdb_id, title, release_year, goodwatch_overall_score_voting_count AS votes FROM ${table} WHERE tmdb_id IN (${ids.slice(i, i + 1000).join(",")})`);
			for (const r of rows) titles[`${table}:${r.tmdb_id}`] = { title: r.title, year: r.release_year, votes: Number(r.votes) || 0 };
		}
	}
	const split = attributes.split as { word: string; isConcrete: boolean }[];
	const phrases = (attributes.phrases as { phrase: string; probability: number }[]).slice(0, 2).map((p) => ({ ...p, concrete: p.phrase.split(" ").some((w) => split.find((x) => x.word === w)?.isConcrete) }));
	captures.push({ query: q, language: language.policy.mode, used, flags: attributes.flags.filter((f) => f.decision), phrases, split, gated: plain.gated, tropeMode: plain.tropeMode, notes: plain.notes, widerNotes: wide.notes, vectorMs, tierMs, textMs, widerMs, tiers: tier.points.length, vectorPool, textPool, titles });
	console.log(`${q}: charged ${outcome.chargedNano}; cosine ${cos.points.length} (${vectorMs} ms), tiers ${tier.points.length} (${tierMs} ms), union ${vectorPool.length}; text ${plainRows.size} (${textMs} ms), with wider ${textPool.length} (${widerMs} ms)`);
	writeFileSync(out, JSON.stringify(captures));
}
process.exit(0);
