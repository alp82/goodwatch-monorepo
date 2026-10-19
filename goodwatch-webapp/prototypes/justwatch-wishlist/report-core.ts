// Aggregates-only report for a #708 capture bundle. Imported by real-report.ts and the tests.
import { ERROR_CATEGORIES } from "./capture-core.js"
import { type Catalog, runPreview } from "./preview-runner.ts"

export async function buildReport(bundle: any, rawCatalog: Catalog, { reference, catalogLabel = "none (shape check only; every row is unmatched)" }: { reference?: string; catalogLabel?: string } = {}) {
const [first, second] = bundle.watchlistRuns
const file = bundle.sharedFile
// Every catalog statement, from the preview and from the conflict check, passes this counter.
let catalogStatements = 0
const catalog: Catalog = (...args) => {
	catalogStatements++
	return rawCatalog(...args)
}
// The file was converted from this run; identity and membership checks must use it.
const chosenRun = bundle.reconciled?.chosenRun === 2 ? 2 : 1
const chosen = chosenRun === 2 ? second : first
const seenComplete = bundle.seenlist.completeness === "complete"
const errorCounts = new Map<string, number>()
for (const error of [...first.graphqlErrors, ...second.graphqlErrors]) {
	const category = ERROR_CATEGORIES.includes(error?.category) ? error.category : "other"
	errorCounts.set(category, (errorCounts.get(category) ?? 0) + 1)
}
const ids = (run: { members: { id: string }[] }) => new Set(run.members.map((member) => member.id))
const firstIds = ids(first)
const secondIds = ids(second)
const onlyFirst = [...firstIds].filter((id) => !secondIds.has(id)).length
const onlySecond = [...secondIds].filter((id) => !firstIds.has(id)).length
const seenIds = ids(bundle.seenlist)
const evidence = new Map(chosen.members.map((member: any) => [member.id, member]))
const items = file.items as any[]
const wishedAndSeen = items.filter((item) => seenIds.has(item.sourceId)).length
const flaggedNotWished = chosen.members.filter((member: any) => !member.watchlist).length
const trackedNotWished = chosen.members.filter((member: any) => member.tracked && !member.watchlist).length
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
const lines = [
	"# JustWatch real-file round trip (#708), aggregates only",
	"",
	`Captured ${bundle.capturedAt}, country ${bundle.country}, language ${bundle.language}. Catalog: ${catalogLabel}.`,
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
	`- File built from run ${chosenRun}; file completeness reasons: ${(bundle.reconciled?.reasons ?? []).join("; ") || "none"}.`,
	`- Run agreement: ${onlyFirst} only in run 1, ${onlySecond} only in run 2 (of ${firstIds.size} and ${secondIds.size}).`,
	`- Owner's reference count: ${reference ?? "not given"}${reference ? ` (run 1 has ${firstIds.size})` : ""}.`,
	`- Run ${chosenRun} entries without a Watchlist entry (excluded): ${flaggedNotWished}, of which tracked shows: ${trackedNotWished}.`,
	`- Wishes also on the JustWatch Seen list: ${seenComplete ? "" : "at least "}${wishedAndSeen} of ${items.length}${seenComplete ? "" : " (the Seen list capture is incomplete)"}. They stay wishes; the file can't say they are seen.`,
	`- GraphQL errors by category: ${[...errorCounts].map(([category, count]) => `${category} ${count}`).join(", ") || "none"}.`,
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
	`- Partial-coverage warning shown: ${run.preview.warnings.length ? "yes" : "no"}. Catalog statements: ${catalogStatements} (preview ${run.catalogReads}, conflict check ${catalogStatements - run.catalogReads}). Preview time: ${run.durationMs} ms. Library writes: ${run.wishlistWrites}.`,
	"",
]
return {
	lines,
	metrics: { idMismatch, flaggedNotWished, trackedNotWished, wishedAndSeen, idConflicts, listedTwice, unaccounted, previewCatalogReads: run.catalogReads, catalogStatements },
}
}
