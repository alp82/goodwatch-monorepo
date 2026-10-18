// #708 synthetic round trip: fake JustWatch → capture → shared JSON v1 → real parser → real preview.
// Run from goodwatch-webapp: node prototypes/justwatch-wishlist/synthetic.ts
import { writeFileSync } from "node:fs"
import { captureList, reconcileRuns, toSharedWishlist } from "./capture-core.js"
import { fakeJustWatch } from "./fake-justwatch.js"
import { catalog, lateAddition, library, negativeControls, watchlist } from "./fixture.js"
import { memoryCatalog, runPreview } from "./preview-runner.ts"

type Truth = { type: string; tmdb: number | null; case: string; outcome?: string; providerIdWrong?: boolean }
const scenarios: { name: string; faults?: Record<string, number>; maxPages?: number }[] = [
	{ name: "clean, 47 titles over 3 pages" },
	{ name: "repeated cursor on page 2", faults: { repeatCursorAtPage: 2 } },
	{ name: "missing cursor on page 1", faults: { missingCursorAtPage: 1 } },
	{ name: "GraphQL field error on page 2 (IDs lost)", faults: { graphqlErrorAtPage: 2 } },
	{ name: "HTTP 500 on page 3 after retries", faults: { httpErrorAtPage: 3 } },
	{ name: "session expired on page 2", faults: { authAtPage: 2 } },
	{ name: "title added during capture (offset shift)", faults: { insertAfterPage: 1 } },
	{ name: "title removed during capture (offset shift)", faults: { removeAfterPage: 1 } },
	{ name: "one added and one removed during capture", faults: { swapAfterPage: 1 } },
	{ name: "empty page claiming more", faults: { emptyPageAt: 2 } },
	{ name: "seen-only title leaks into Watchlist response", faults: { contaminateAtPage: 1 } },
	{ name: "page limit reached", maxPages: 2 },
	{ name: "totalCount overstates by 2", faults: { extraTotal: 2 } },
]

const truthById = new Map<string, Truth>(watchlist.map(([node, truth]) => [node.id, truth as Truth]))
truthById.set(lateAddition[0].id as string, lateAddition[1] as Truth)
const nodeById = new Map<string, any>([...watchlist.map(([node]) => [node.id, node] as const), [lateAddition[0].id, lateAddition[0]]])
const negativeIds = new Set(negativeControls.map((node) => node.id))
const catalogImdb = new Map<string, string>()
for (const table of ["movie", "show"] as const) for (const [tmdb, imdb] of catalog[table]) catalogImdb.set(`${table}:${tmdb}`, imdb)

const results = []
for (const scenario of scenarios) {
	const server = fakeJustWatch(scenario.faults)
	const single = await captureList({ request: server.request, country: "US", listType: "WATCHLIST", maxPages: scenario.maxPages })
	const again = await captureList({ request: server.request, country: "US", listType: "WATCHLIST", maxPages: scenario.maxPages })
	const reconciled = reconcileRuns(single, again)
	const capture = reconciled.capture
	const { file, loss, excluded } = toSharedWishlist(capture, { exportedAt: "2026-10-19T12:00:00Z" })
	const singleIds = new Set(single.nodes.map((node: any) => node.id))
	const bytes = new TextEncoder().encode(JSON.stringify(file))
	const reference = new Set(watchlist.map(([node]) => node.id as string))
	if (scenario.faults?.insertAfterPage) reference.add(lateAddition[0].id as string)
	// The member removed the newest wish mid-capture; it is no longer part of the reference.
	if (scenario.faults?.removeAfterPage || scenario.faults?.swapAfterPage) reference.delete(watchlist[0][0].id as string)
	if (scenario.faults?.swapAfterPage) reference.add(lateAddition[0].id as string)
	const capturedIds = new Set(capture.nodes.map((node: any) => node.id))
	const fileIds = file.items.map((item: any) => item.sourceId)
	const recallHits = [...reference].filter((id) => capturedIds.has(id)).length
	const actuallyComplete = recallHits === reference.size
	const contamination = fileIds.filter((id: string) => negativeIds.has(id))
	// Captured while on the list, then removed by the member before the capture ended.
	const stale = fileIds.filter((id: string) => !negativeIds.has(id) && !reference.has(id))
	// V1, V2, V3
	const scopeErrors = file.items.filter((item: any) => item.mediaType !== truthById.get(item.sourceId)?.type)
	const guessed = file.items.filter((item: any) => {
		const ids = nodeById.get(item.sourceId)?.content?.externalIds ?? {}
		const provided = ids.tmdbId == null || ids.tmdbId === "" ? undefined : Number(ids.tmdbId)
		return (item.tmdbId !== undefined && item.tmdbId !== provided) || (item.imdbId !== undefined && item.imdbId !== ids.imdbId)
	})
	const objectIdAsTmdb = file.items.filter((item: any) => item.tmdbId !== undefined && item.tmdbId === nodeById.get(item.sourceId)?.objectId && nodeById.get(item.sourceId)?.content?.externalIds?.tmdbId == null)
	const uniqueFileIds = new Set(fileIds).size === fileIds.length
	const run = await runPreview(bytes, memoryCatalog(catalog as never), library as never)
	const rowsBySource = new Map<string, any[]>()
	for (const item of run.items) {
		const id = item.wishlistEvidence?.sourceId
		if (id) rowsBySource.set(id, [...(rowsBySource.get(id) ?? []), item])
	}
	const unaccounted = fileIds.filter((id: string) => rowsBySource.get(id)?.length !== 1)
	let correct = 0
	let wrong = 0
	let abstained = 0
	let outcomeMismatches: string[] = []
	const idConflicts: string[] = []
	let providerWrongMatched = 0
	const fileById = new Map(file.items.map((item: any) => [item.sourceId, item]))
	for (const id of fileIds) {
		const truth = truthById.get(id)
		const row = rowsBySource.get(id)?.[0]
		if (!truth || !row) continue
		const expectedOutcome = truth.outcome ?? "new"
		const fileItem: any = fileById.get(id)
		const idsLost = !fileItem.tmdbId && !fileItem.imdbId
		if (row.outcome !== expectedOutcome && !(idsLost && row.outcome === "unmatched"))
			outcomeMismatches.push(`${truth.case}: expected ${expectedOutcome}, got ${row.outcome} ("${row.reason}", matched TMDB ${row.tmdbId} instead of ${truth.tmdb})`)
		if (row.tmdbId && fileItem.imdbId) {
			const imdb = catalogImdb.get(`${row.mediaType}:${row.tmdbId}`)
			if (imdb && imdb !== fileItem.imdbId) idConflicts.push(truth.case)
		}
		if (truth.providerIdWrong) {
			if (row.tmdbId && row.tmdbId !== truth.tmdb) providerWrongMatched++
			continue
		}
		if (truth.tmdb === null) continue
		if (!row.tmdbId || ["unmatched", "invalid"].includes(row.outcome)) abstained++
		else if (row.tmdbId === truth.tmdb && row.mediaType === truth.type) correct++
		else wrong++
	}
	const partialWarned = run.preview.warnings?.some((warning: string) => warning.includes("part of your list")) ?? false
	results.push({
		scenario: scenario.name,
		capture: {
			terminal: capture.terminal,
			singleClaimed: single.completeness,
			singleFalseComplete: single.completeness === "complete" && ![...reference].every((id) => singleIds.has(id)),
			chosenRun: reconciled.chosen,
			claimed: capture.completeness,
			reasons: capture.completenessReasons,
			requests: single.requests + again.requests,
			pages: capture.pages.length,
			reference: reference.size,
			captured: recallHits,
			duplicates: capture.duplicates.length,
			falseComplete: capture.completeness === "complete" && !actuallyComplete,
			excluded: excluded.length,
		},
		conversion: {
			items: file.items.length,
			contamination: contamination.length,
			stale: stale.length,
			scopeErrors: scopeErrors.length,
			guessedIds: guessed.length,
			objectIdAsTmdb: objectIdAsTmdb.length,
			uniqueSourceIds: uniqueFileIds,
		},
		preview: {
			rows: run.items.length,
			counts: run.preview.counts,
			unaccounted: unaccounted.length,
			correct,
			wrong,
			abstained,
			providerWrongMatched,
			idConflictsFlagged: idConflicts.length,
			outcomeMismatches,
			partialWarned,
			catalogReads: run.catalogReads,
			wishlistWrites: run.wishlistWrites,
		},
		loss,
	})
}

const lines = [
	"# Synthetic round-trip results (#708)",
	"",
	`Generated by \`node prototypes/justwatch-wishlist/synthetic.ts\`. Each scenario reads the Watchlist twice, as the snippet does; the file uses the reconciled result. Requests count both runs. Fixture: ${watchlist.length} Watchlist titles (${watchlist.filter(([, t]) => (t as Truth).type === "movie").length} movies, ${watchlist.filter(([, t]) => (t as Truth).type === "show").length} shows, ${watchlist.filter(([, t]) => (t as Truth).type === "unknown").length} season), ${negativeControls.length} negative controls, 20-item pages. All synthetic; no account or network.`,
	"",
	"## Capture and conversion",
	"",
	"| Scenario | Stop reason | One run says | False complete, one run | File says (two runs) | Captured / reference | Requests | False complete, file | Contamination | Stale | Scope errors | Guessed IDs |",
	"| --- | --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |",
	...results.map(
		(r) =>
			`| ${r.scenario} | ${r.capture.terminal} | ${r.capture.singleClaimed} | ${r.capture.singleFalseComplete ? "**yes**" : "no"} | ${r.capture.claimed} | ${r.capture.captured} / ${r.capture.reference} | ${r.capture.requests} | ${r.capture.falseComplete ? "**yes**" : "no"} | ${r.conversion.contamination} | ${r.conversion.stale} | ${r.conversion.scopeErrors} / ${r.conversion.items} | ${r.conversion.guessedIds + r.conversion.objectIdAsTmdb} / ${r.conversion.items} |`,
	),
	"",
	"## Preview",
	"",
	"Correct, wrong and abstained count wishes whose correct catalog title is known and whose provider IDs are not deliberately wrong.",
	"",
	"| Scenario | Rows | New | Unchanged | Conflict | Unmatched | Invalid | Unsupported | Unaccounted | Correct | Wrong | Abstained | Wrong provider ID matched | Flagged by harness | Partial warning |",
	"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
	...results.map(
		(r) =>
			`| ${r.scenario} | ${r.preview.rows} | ${r.preview.counts.new} | ${r.preview.counts.unchanged} | ${r.preview.counts.conflict} | ${r.preview.counts.unmatched} | ${r.preview.counts.invalid} | ${r.preview.counts.unsupported} | ${r.preview.unaccounted} | ${r.preview.correct} | ${r.preview.wrong} | ${r.preview.abstained} | ${r.preview.providerWrongMatched} | ${r.preview.idConflictsFlagged} | ${r.capture.claimed === "complete" ? "n/a" : r.preview.partialWarned ? "yes" : "**no**"} |`,
	),
	"",
	"## Completeness reasons",
	"",
	...results.map((r) => `- ${r.scenario}: ${r.capture.reasons.length ? r.capture.reasons.join("; ") : "none (complete)"}`),
	"",
	"## Outcome differences from the fixture's naive expectation (findings)",
	"",
	...results.flatMap((r) => (r.preview.outcomeMismatches.length ? [`- ${r.scenario}: ${r.preview.outcomeMismatches.join("; ")}`] : [])),
	"",
	"## Loss ledger, clean scenario",
	"",
	"| Source field | Count | What happens |",
	"| --- | ---: | --- |",
	...Object.entries(results[0].loss).map(([field, { count, note }]: [string, any]) => `| \`${field}\` | ${count} | ${note} |`),
	"",
	`Writes: ${results.reduce((sum, r) => sum + r.preview.wishlistWrites, 0)} wishlist rows across all previews (preview never confirms).`,
	"",
]
writeFileSync(new URL("./results/synthetic-report.md", import.meta.url), lines.join("\n"))
writeFileSync(new URL("./results/synthetic-results.json", import.meta.url), `${JSON.stringify(results, null, "\t")}\n`)
console.log(lines.join("\n"))
