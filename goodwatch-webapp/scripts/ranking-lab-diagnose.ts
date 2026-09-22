// PROTOTYPE - why are expected titles missing from the candidate pools?
import "dotenv/config";
import { MEDIA_COLLECTION } from "../app/utils/qdrant";
import * as Q from "../app/utils/qdrant";
import { searchQuery } from "../app/server/combined-search/catalog.server";
import { prototypeParts as P } from "../app/server/combined-search/d4.server";
const targets: [string, number, string][] = [["show", 1399, "Game of Thrones"], ["movie", 11939, "Dragonheart"], ["movie", 78, "Blade Runner"], ["movie", 18, "The Fifth Element"], ["movie", 76341, "Mad Max: Fury Road"], ["movie", 603, "The Matrix"], ["movie", 36647, "Blade"]];
const dims = ["fantasy", "contemporary_realism", "spectacle", "wonder", "world_immersion", "futuristic", "adrenaline"];
for (const [table, id, name] of targets) {
	const rows = await searchQuery<Record<string, unknown>>(
		`SELECT title, goodwatch_overall_score_voting_count AS votes, adult, essence_text IS NOT NULL AS has_essence, ${dims.map((d) => `fingerprint_scores['${d}'] AS ${d}`).join(", ")},
		 lower(essence_text) LIKE '%dragon%' AS ess_dragon, lower(synopsis) LIKE '%dragon%' AS syn_dragon, lower(essence_text) LIKE '%car%' AS ess_car, lower(synopsis) LIKE '%car%' AS syn_car,
		 lower(synopsis) LIKE '%sci%' AS syn_sci, substr(essence_text, 1, 160) AS ess FROM ${table} WHERE tmdb_id = ${id}`);
	const r = rows[0];
	let inQdrant = "?";
	try {
		const ids = Object.entries(Q).filter(([k]) => /point/i.test(k)).map(([k]) => k);
		const pid = (Q as unknown as Record<string, (t: string, i: number) => number>)[ids.find((k) => /^(to|make|build)?pointId$/i.test(k)) ?? ""]?.(table, id);
		if (pid !== undefined) { const p = await P.getQdrant().retrieve(MEDIA_COLLECTION, { ids: [pid], with_payload: ["title"] }); inQdrant = p.length ? "yes" : "NO"; } else inQdrant = `no id fn (${ids.join(",")})`;
	} catch (e) { inQdrant = `err ${(e as Error).message.slice(0, 60)}`; }
	console.log(`${name}: crate=${r ? "yes" : "NO"} qdrant=${inQdrant} ${r ? JSON.stringify({ ...r, ess: String(r.ess).slice(0, 120) }) : ""}`);
}
// Where does GoT land in the text search for "fantasy dragons" and "dragons"?
for (const words of [["fantasy", "dragons"], ["dragons"]]) {
	const forms = (w: string) => [...new Set([w, w.replace(/s$/, ""), `${w}s`])].join(" ");
	const rows = await searchQuery<{ tmdb_id: number; title: string; _score: number }>(
		`SELECT tmdb_id, title, _score FROM show WHERE goodwatch_overall_score_voting_count >= 2000 AND NOT coalesce(adult, false) AND essence_text IS NOT NULL AND ${words.map(() => "match((essence_text 2.0, synopsis), ?)").join(" AND ")} ORDER BY _score DESC LIMIT 2000`, words.map(forms));
	const i = rows.findIndex((r) => r.tmdb_id === 1399);
	console.log(`show text search ${words.join("+")}: ${rows.length} rows; Game of Thrones at ${i < 0 ? "absent" : i + 1} (pool cap ${300}); top: ${rows.slice(0, 5).map((r) => r.title).join(", ")}`);
}
process.exit(0);
