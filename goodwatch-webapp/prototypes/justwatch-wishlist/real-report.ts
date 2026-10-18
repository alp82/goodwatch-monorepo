// #708 real-file round trip. Prints aggregates only: no titles, native IDs or catalog IDs.
// Run from goodwatch-webapp:
//   node prototypes/justwatch-wishlist/real-report.ts ~/goodwatch-private/708/justwatch-708-capture.json [--reference=<count>] [--catalog=crate --env=<path to .env>]
// With --catalog=crate the preview's own catalog SELECTs (movie/show by TMDB ID, IMDb ID or exact title+year)
// go to production Crate read-only. Nothing else leaves the process; the import journal is in memory.
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Catalog, type CatalogRow, memoryCatalog, runPreview } from "./preview-runner.ts"

const args = process.argv.slice(2)
const path = args.find((arg) => !arg.startsWith("--"))
if (!path) throw new Error("Pass the capture file path.")
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1]
const bundle = JSON.parse(readFileSync(path, "utf8"))
if (bundle.kind !== "goodwatch-708-justwatch-capture") throw new Error("Not a #708 capture file.")

const ALLOWED = /^SELECT tmdb_id, imdb_id, title, release_year FROM (movie|show) WHERE (tmdb_id IN \(\?(?:,\?)*\)|imdb_id IN \(\?(?:,\?)*\)|lower\(title\) = lower\(\?\) AND release_year = \? LIMIT 2)$/
function crateCatalog(envPath: string): Catalog {
	const env = Object.fromEntries(
		readFileSync(envPath, "utf8")
			.split("\n")
			.flatMap((line) => {
				const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
				return match ? [[match[1], match[2].replace(/^["']|["']$/g, "")]] : []
			}),
	)
	const hosts = String(env.CRATE_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean)
	const port = env.CRATE_PORT || "4200"
	const auth = `Basic ${Buffer.from(`${env.CRATE_USER || "crate"}:${env.CRATE_PASS || ""}`).toString("base64")}`
	return async (_table, sql, params) => {
		if (!ALLOWED.test(sql)) throw new Error("Refused a catalog statement outside the read-only allowlist.")
		let lastError: unknown
		for (const host of hosts) {
			try {
				const response = await fetch(`http://${host}:${port}/_sql`, {
					method: "POST",
					headers: { "content-type": "application/json", authorization: auth },
					body: JSON.stringify({ stmt: sql, args: params }),
					signal: AbortSignal.timeout(10_000),
				})
				if (!response.ok) throw new Error(`Crate HTTP ${response.status}`)
				const body = (await response.json()) as { cols: string[]; rows: unknown[][] }
				return body.rows.map((row) => Object.fromEntries(body.cols.map((col, index) => [col, row[index]])) as CatalogRow)
			} catch (error) {
				lastError = error
			}
		}
		throw lastError
	}
}

const catalog = option("catalog") === "crate" ? crateCatalog(option("env") ?? "../../goodwatch-monorepo/goodwatch-webapp/.env") : memoryCatalog({ movie: [], show: [] })
const [first, second] = bundle.watchlistRuns
const file = bundle.sharedFile
const ids = (run: { members: { id: string }[] }) => new Set(run.members.map((member) => member.id))
const firstIds = ids(first)
const secondIds = ids(second)
const onlyFirst = [...firstIds].filter((id) => !secondIds.has(id)).length
const onlySecond = [...secondIds].filter((id) => !firstIds.has(id)).length
const seenIds = ids(bundle.seenlist)
const evidence = new Map(first.members.map((member: any) => [member.id, member]))
const items = file.items as any[]
const wishedAndSeen = items.filter((item) => seenIds.has(item.sourceId)).length
const flaggedNotWished = first.members.filter((member: any) => !member.watchlist).length
const trackedNotWished = first.members.filter((member: any) => member.tracked && !member.watchlist).length
const idMismatch = items.filter((item) => {
	const member: any = evidence.get(item.sourceId)
	const tmdb = member?.tmdb == null || member.tmdb === "" ? undefined : Number(member.tmdb)
	return (item.tmdbId !== undefined && item.tmdbId !== tmdb) || (item.imdbId !== undefined && item.imdbId !== member?.imdb)
}).length
const types = { movie: 0, show: 0, unknown: 0 } as Record<string, number>
for (const item of items) types[item.mediaType]++
const idCoverage = {
	both: items.filter((item) => item.tmdbId && item.imdbId).length,
	tmdbOnly: items.filter((item) => item.tmdbId && !item.imdbId).length,
	imdbOnly: items.filter((item) => !item.tmdbId && item.imdbId).length,
	none: items.filter((item) => !item.tmdbId && !item.imdbId).length,
}

const run = await runPreview(new TextEncoder().encode(JSON.stringify(file)), catalog, { seenMovies: [], watchingShows: [], wishes: [] })
const rows = run.items as any[]
const bySource = new Map<string, number>()
for (const row of rows) if (row.wishlistEvidence?.sourceId) bySource.set(row.wishlistEvidence.sourceId, (bySource.get(row.wishlistEvidence.sourceId) ?? 0) + 1)
const unaccounted = items.filter((item) => bySource.get(item.sourceId) !== 1).length
const listedTwice = rows.filter((row) => row.outcome === "unsupported" && /twice/i.test(row.reason ?? "")).length
// Provider TMDB ID that points at a catalog title with a different IMDb ID than the provider gave.
let idConflicts = 0
const fileBySource = new Map(items.map((item) => [item.sourceId, item]))
for (const table of ["movie", "show"] as const) {
	const matched = rows.filter((row) => row.mediaType === table && row.tmdbId && fileBySource.get(row.wishlistEvidence?.sourceId)?.imdbId)
	for (let start = 0; start < matched.length; start += 400) {
		const batch = matched.slice(start, start + 400)
		const tmdbIds = [...new Set(batch.map((row) => row.tmdbId))]
		const found = await catalog(table, `SELECT tmdb_id, imdb_id, title, release_year FROM ${table} WHERE tmdb_id IN (${tmdbIds.map(() => "?").join(",")})`, tmdbIds)
		const imdbOf = new Map(found.map((row) => [Number(row.tmdb_id), row.imdb_id]))
		for (const row of batch) {
			const imdb = imdbOf.get(row.tmdbId)
			if (imdb && imdb !== fileBySource.get(row.wishlistEvidence.sourceId).imdbId) idConflicts++
		}
	}
}
const reference = option("reference")
const lines = [
	"# JustWatch real-file round trip (#708), aggregates only",
	"",
	`Captured ${bundle.capturedAt}, country ${bundle.country}, language ${bundle.language}. Catalog: ${option("catalog") === "crate" ? "production, read-only" : "none (shape check only; every row is unmatched)"}.`,
	"",
	"## Capture",
	"",
	"| Run | Query | Stop reason | Completeness | Titles | Reported total | Pages | Requests | Duplicates | Skipped | GraphQL errors | Seconds |",
	"| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
	...[
		["Watchlist 1", first],
		["Watchlist 2", second],
		["Seen list", bundle.seenlist],
	].map(([label, r]: any) => `| ${label} | ${r.query} | ${r.terminal} | ${r.completeness} | ${r.members.length} | ${r.totals.join(" → ")} | ${r.pages.length} | ${r.requests} | ${r.duplicates} | ${r.skipped} | ${r.graphqlErrors.length} | ${(r.durationMs / 1000).toFixed(1)} |`),
	"",
	`- Completeness reasons, run 1: ${first.completenessReasons.join("; ") || "none"}`,
	`- Run agreement: ${onlyFirst} only in run 1, ${onlySecond} only in run 2 (of ${firstIds.size} and ${secondIds.size}).`,
	`- Owner's reference count: ${reference ?? "not given"}${reference ? ` (run 1 has ${firstIds.size})` : ""}.`,
	`- Watchlist response entries without a Watchlist entry (excluded): ${flaggedNotWished}, of which tracked shows: ${trackedNotWished}.`,
	`- Wishes also on the JustWatch Seen list: ${wishedAndSeen} of ${items.length}. They stay wishes; the file can't say they are seen.`,
	`- GraphQL error codes: ${[...new Set([...first.graphqlErrors, ...second.graphqlErrors].map((error: any) => error.code || "none"))].join(", ") || "none"}.`,
	"",
	"## Conversion",
	"",
	`- Wishes in the file: ${items.length}. Movies ${types.movie}, shows ${types.show}, unknown ${types.unknown}.`,
	`- Provider IDs: both ${idCoverage.both}, TMDB only ${idCoverage.tmdbOnly}, IMDb only ${idCoverage.imdbOnly}, none ${idCoverage.none}.`,
	`- File IDs that differ from what JustWatch returned: ${idMismatch}.`,
	`- File completeness: ${file.completeness}.`,
	"",
	"| Source field | Count | What happens |",
	"| --- | ---: | --- |",
	...Object.entries(bundle.loss).map(([field, { count, note }]: [string, any]) => `| \`${field}\` | ${count} | ${note} |`),
	"",
	"## Preview",
	"",
	`- Parsed observations: ${run.parsed.observations.length}; preview rows: ${rows.length}; wishes without exactly one preview row: ${unaccounted}.`,
	`- Outcomes: ${Object.entries(run.preview.counts).map(([key, value]) => `${key} ${value}`).join(", ")}.`,
	`- Dropped as "listed twice": ${listedTwice}. Provider TMDB ID contradicts the provider IMDb ID in the catalog: ${idConflicts}.`,
	`- Partial-coverage warning shown: ${run.preview.warnings.length ? "yes" : "no"}. Catalog reads: ${run.catalogReads}. Preview time: ${run.durationMs} ms. Library writes: ${run.wishlistWrites}.`,
	"",
]
const out = join(dirname(path), "real-report.md")
writeFileSync(out, lines.join("\n"))
console.log(lines.join("\n"))
console.log(`\nSaved ${out}`)
