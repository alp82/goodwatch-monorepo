// PROTOTYPE - Jev judges how well candidate titles fit a request, from the essence text only.
// Usage: npx vite-node scripts/ranking-lab-judge.ts tops.jsonl judge.json
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { searchQuery } from "../app/server/combined-search/catalog.server";
import { JEV_MODEL } from "../app/server/search-runtime/runtime.server";
const [topsPath, outPath] = process.argv.slice(2);
const FIT_LEVELS = [
	"The evidence contradicts the request: the title is clearly the opposite of what is asked for",
	"Poor fit: the evidence shows little of what the request asks for",
	"Partial fit: some requested aspects are supported, others are missing or unclear",
	"Good fit: the evidence supports most of what the request asks for",
	"Excellent fit: the evidence directly and specifically supports everything the request asks for",
];
const key = process.env.TYPESAFE_API_KEY; if (!key) throw new Error("TYPESAFE_API_KEY missing");
let tokens = 0, requests = 0;
const jev = async (state: unknown, questions: Record<string, unknown>) => {
	for (let attempt = 0; ; attempt++) {
		const r = await fetch("https://api.typesafe.ai/v1/systemone", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ state, model: JEV_MODEL, questions }) });
		if ((r.status === 429 || r.status === 529) && attempt < 4) { await new Promise((res) => setTimeout(res, 500 * 2 ** attempt)); continue; }
		if (!r.ok) throw new Error(`Jev ${r.status}: ${(await r.text()).slice(0, 300)}`);
		const body = (await r.json()) as { answers: Record<string, { score: number }>; usage: { input_tokens: number } };
		requests += 1; tokens += body.usage.input_tokens; return body.answers;
	}
};
const judge: Record<string, Record<string, number>> = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
const byQuery = new Map<string, Set<string>>();
for (const line of readFileSync(topsPath, "utf8").split("\n").filter(Boolean)) { const { query, keys } = JSON.parse(line) as { query: string; keys: string[] }; const s = byQuery.get(query) ?? new Set(); for (const k of keys) s.add(k); byQuery.set(query, s); }
for (const [query, keys] of byQuery) {
	judge[query] ??= {};
	const todo = [...keys].filter((k) => !(k in judge[query]));
	if (!todo.length) continue;
	const docs = new Map<string, { media_type: string; genres: string[]; description: string; tags: string[] }>();
	for (const table of ["movie", "show"] as const) {
		const ids = todo.filter((k) => k.startsWith(`${table}:`)).map((k) => k.split(":")[1]);
		if (!ids.length) continue;
		const rows = await searchQuery<{ tmdb_id: number; genres: string[] | null; essence_text: string | null; essence_tags: string[] | null }>(`SELECT tmdb_id, genres, essence_text, essence_tags FROM ${table} WHERE tmdb_id IN (${ids.join(",")})`);
		for (const r of rows) docs.set(`${table}:${r.tmdb_id}`, { media_type: table === "movie" ? "Movie" : "TV show", genres: r.genres ?? [], description: r.essence_text ?? "", tags: r.essence_tags ?? [] });
	}
	const batches: string[][] = []; for (let i = 0; i < todo.length; i += 8) batches.push(todo.slice(i, i + 8));
	await Promise.all(batches.map(async (batch) => {
		const titles = batch.map((k) => docs.get(k) ?? { media_type: "Movie", genres: [], description: "", tags: [] });
		const answers = await jev({ request: query, titles }, Object.fromEntries(batch.map((_, i) => [`f${i}`, { type: "score", instructions: `A person describes what they want to watch in \`request\`. Judging only from the evidence in \`titles[${i}]\`, how well does this title fit the request? Don't use outside knowledge about the title.`, criteria: FIT_LEVELS }])));
		batch.forEach((k, i) => { judge[query][k] = answers[`f${i}`].score; });
	}));
	writeFileSync(outPath, JSON.stringify(judge));
	console.log(`${query}: judged ${todo.length} titles (${batches.length} requests); totals ${requests} requests, ${tokens} tokens`);
}
process.exit(0);
