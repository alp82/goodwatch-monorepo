// Re-exports undici with a fetch that records wall time (through body parse) per call.
import * as undici from "/home/alp/dev/projects/goodwatch/goodwatch-monorepo/goodwatch-webapp/node_modules/undici/index.js";
export * from "/home/alp/dev/projects/goodwatch/goodwatch-monorepo/goodwatch-webapp/node_modules/undici/index.js";
export const calls: { label: string; ms: number; rows?: number }[] = [];
(globalThis as any).__arenaCalls = calls;
const labelFor = (url: string, body: string) => {
	if (url.includes("themoviedb")) return "tmdb.page";
	if (body.includes("search_interpretations")) return "cache.crate";
	if (body.includes("phrase_prefix")) return "crate.phrase";
	if (body.includes("ANY(keywords)")) return "crate.keyword";
	if (body.includes("FROM trope WHERE match(name")) return "crate.tropeName";
	if (body.includes("AND tmdb_id IN")) return "crate.tropeTitles";
	if (body.includes("match((essence_text 2.0, synopsis)")) return "crate.words";
	if (body.includes("essence_tags FROM")) return "crate.display";
	if (body.includes("goodwatch_overall_score_voting_count, '")) return "crate.metadata";
	return "other";
};
export const fetch = async (input: any, init?: any) => {
	const label = labelFor(String(input), typeof init?.body === "string" ? init.body : "");
	const t = performance.now();
	const res: any = await (undici.fetch as any)(input, init);
	const json = res.json.bind(res);
	res.json = async () => {
		const v = await json();
		calls.push({ label, ms: performance.now() - t, rows: Array.isArray(v?.rows) ? v.rows.length : undefined });
		return v;
	};
	return res;
};
