// Writes titles.json: movie page paths for the title page misses, from one read-only SELECT on Crate. Run inside the
// measurement image, which has the Crate settings in its environment. Each run takes a fresh slice of the list, so
// every miss has a cold data cache in the measurement's own Valkey.
//   node titles.mjs <out file> [count]
import { writeFileSync } from "node:fs"
const [out, count = "40000"] = process.argv.slice(2)
const host = process.env.CRATE_HOSTS.split(",")[0]
const response = await fetch(`http://${host}:${process.env.CRATE_PORT || "4200"}/_sql`, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		Authorization: `Basic ${Buffer.from(`${process.env.CRATE_USER || ""}:${process.env.CRATE_PASS || ""}`).toString("base64")}`,
	},
	// Titles with a poster and some votes, so that the page is a full title page. The order is arbitrary but stable.
	body: JSON.stringify({
		stmt: "SELECT tmdb_id FROM movie WHERE poster_path IS NOT NULL AND goodwatch_overall_score_voting_count >= 20 AND tmdb_id <> 603 ORDER BY tmdb_id % 9973, tmdb_id LIMIT ?",
		args: [Number(count)],
	}),
})
if (!response.ok) throw new Error(`Crate answered ${response.status}: ${(await response.text()).slice(0, 300)}`)
const { rows } = await response.json()
writeFileSync(out, JSON.stringify(rows.map(([id]) => `/movie/${id}`)))
console.log(JSON.stringify({ titles: rows.length }))
