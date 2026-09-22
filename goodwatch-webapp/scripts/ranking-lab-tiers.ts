// PROTOTYPE - tiered min_should prefetch: membership of missing titles and latency
import "dotenv/config";
import { readFileSync } from "node:fs";
import { MEDIA_COLLECTION, parsePointId } from "../app/utils/qdrant";
import { prototypeParts as P } from "../app/server/combined-search/d4.server";
const caps = JSON.parse(readFileSync(process.argv[2], "utf8")) as { query: string; used: [string, number][] }[];
const qd = P.getQdrant();
const base = { must: [{ key: "goodwatch_overall_score_voting_count", range: { gte: 2000 } }], must_not: [{ key: "adult", match: { value: true } }] };
const cond = (used: [string, number][]) => used.map(([k, w]) => ({ key: `fingerprint_scores_v1.${k}`, range: w > 0 ? { gte: 6 } : { lte: 4 } }));
const targets: Record<string, string[]> = { "fantasy with dragons": ["show:1399"], "scifi with cars": ["movie:78", "movie:18", "movie:76341"], "sunglasses at night": ["movie:603"], "like groundhog day": ["movie:137"], "complete nonsense": ["show:1962"], "tarkovsky": ["movie:1398"] };
const keyOf = (id: unknown) => { const { mediaType, tmdbId } = parsePointId(Number(id)); return `${mediaType}:${tmdbId}`; };
for (const c of caps) {
	if (!(c.query in targets)) continue;
	const used = c.used, n = used.length, vector = P.sparseVector(Object.fromEntries(used) as never);
	const formula = (P as unknown as { rankingFormula?: (u: [string, number][]) => unknown }).rankingFormula;
	const q = formula ? formula(used) : { formula: { sum: cond(used) } };
	const tiers = [n, n - 1, n - 2].filter((k) => k >= 1);
	// A: single min_should prefetch at the top tier; B: three tier prefetches, union, formula; C: cosine only (today)
	const runs: [string, unknown][] = [
		["single top tier", { prefetch: { query: vector, using: "fingerprint_v1", filter: { ...base, min_should: { min_count: n, conditions: cond(used) } }, limit: 2000 }, query: q, limit: 2000 }],
		["three tiers", { prefetch: tiers.map((k) => ({ query: vector, using: "fingerprint_v1", filter: { ...base, min_should: { min_count: k, conditions: cond(used) } }, limit: 1000 })), query: q, limit: 3000 }],
		["cosine only", { prefetch: { query: vector, using: "fingerprint_v1", filter: base, limit: 2000 }, query: q, limit: 2000 }],
	];
	console.log(`\n=== ${c.query} (${n} dims)`);
	for (const [name, body] of runs) {
		const times: number[] = []; let res: { points: { id: unknown; score: number }[] } = { points: [] };
		for (let i = 0; i < 3; i++) { const t = Date.now(); res = await qd.query(MEDIA_COLLECTION, body as never); times.push(Date.now() - t); }
		const ranks = targets[c.query].map((k) => { const i = res.points.findIndex((p) => keyOf(p.id) === k); return `${k}@${i < 0 ? "absent" : i + 1}`; });
		console.log(`  ${name.padEnd(16)} ${res.points.length} candidates, ${times.join("/")} ms, top score ${res.points[0]?.score.toFixed(2)}, ${ranks.join(" ")}`);
	}
}
process.exit(0);
