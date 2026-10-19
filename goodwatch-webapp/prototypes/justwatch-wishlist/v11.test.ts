// Shared wishlist v1.1 output (#715), checked against the shipped parser and preview on main.
// Run: node --test prototypes/justwatch-wishlist/v11.test.ts
import assert from "node:assert/strict"
import { it } from "node:test"
import { captureList, evidenceOf, reconcileRuns, toSharedWishlist } from "./capture-core.js"
import { fakeJustWatch } from "./fake-justwatch.js"
import { catalog, library } from "./fixture.js"
import { memoryCatalog, runPreview } from "./preview-runner.ts"
import { buildReport } from "./report-core.ts"

async function capture() {
	const server = fakeJustWatch()
	const run = () => captureList({ request: server.request, country: "US", listType: "WATCHLIST" })
	const reconciled = reconcileRuns(await run(), await run())
	const seen = await captureList({ request: server.request, country: "US", listType: "SEENLIST" })
	return { reconciled, seen }
}
const exportedAt = "2026-10-19T12:00:00Z"
const byId = (items: any[]) => new Map(items.map((item) => [item.sourceId, item]))

it("writes version 1.1 with source Seen evidence only on Watchlist wishes", async () => {
	const { reconciled, seen } = await capture()
	const { file } = toSharedWishlist(reconciled.capture, { exportedAt, seen })
	assert.equal(file.version, 1.1)
	const items = byId(file.items)
	// Heat and Spirited Away are on both lists; the movie's own Seen date is known.
	assert.equal(items.get("tm1005").sourceSeen, true)
	assert.equal(items.get("tm1005").sourceSeenAt, "2026-04-04T10:00:00.000Z")
	assert.equal(items.get("tm1018").sourceSeen, true)
	// Show progress or tracking alone is not Seen evidence; unknown stays omitted, never false.
	assert.equal(items.get("ts2004").sourceSeen, undefined)
	assert.equal(items.get("tm1001").sourceSeen, undefined)
	assert.ok(file.items.every((item: any) => item.sourceSeen !== false))
	// Seen-only titles never become wishes.
	assert.ok(!items.has("tm3001") && !items.has("ts3003"))
	// A season object stays unknown: JustWatch's season IDs are not proven parent-show IDs.
	assert.equal(items.get("tse2005").mediaType, "unknown")
	assert.equal(items.get("tse2005").season, undefined)
})

it("marks a Watchlist show found in the Seen capture, without inventing a date", async () => {
	const show = { id: "ts77", objectType: "SHOW", content: { title: "S", originalReleaseYear: 2001, externalIds: { tmdbId: "1399", imdbId: "tt0944947" } }, watchlistEntryV2: { createdAt: "2026-01-01T00:00:00Z" }, tvShowTrackingEntry: { createdAt: "2026-02-01T00:00:00Z" }, seenState: { progress: 1 } }
	const page = (nodes: unknown[]) => async () => ({ status: 200, body: { data: { titleListV2: { totalCount: nodes.length, pageInfo: { endCursor: "c", hasNextPage: false }, edges: nodes.map((node) => ({ node })) } } } })
	const watch = await captureList({ request: page([show]), country: "US", listType: "WATCHLIST" })
	const seen = await captureList({ request: page([{ ...show, watchlistEntryV2: null, seenlistEntry: { createdAt: "not a date" } }]), country: "US", listType: "SEENLIST" })
	const { file } = toSharedWishlist(watch, { exportedAt, seen })
	assert.equal(file.items[0].sourceSeen, true)
	assert.equal(file.items[0].sourceSeenAt, undefined)
})

it("parses with the shipped parser and reaches the preview's source-Seen rewatch choice", async () => {
	const { reconciled, seen } = await capture()
	const { file } = toSharedWishlist(reconciled.capture, { exportedAt, seen })
	const run = await runPreview(new TextEncoder().encode(JSON.stringify(file)), memoryCatalog(catalog as never), library as never)
	const evidence = new Map(run.parsed.observations.map((row: any) => [row.wishlistEvidence?.sourceId, row.wishlistEvidence]))
	assert.equal(evidence.get("tm1005").sourceSeen, true)
	assert.equal(evidence.get("tm1005").sourceSeenAt, "2026-04-04T10:00:00.000Z")
	assert.equal(run.parsed.observations.filter((row: any) => row.problem?.outcome === "invalid").length, 2, "only the two deliberately unreadable rows")
	const spirited = run.items.find((row: any) => row.wishlistEvidence?.sourceId === "tm1018")
	assert.equal(spirited.outcome, "conflict")
	assert.match(spirited.reason, /Seen at the source/)
})

it("reports a v1 capture from the earlier snippet with the source Seen it would carry in v1.1", async () => {
	const { reconciled, seen } = await capture()
	const v1 = toSharedWishlist(reconciled.capture, { exportedAt, seen })
	v1.file.version = 1
	for (const item of v1.file.items as any[]) {
		delete item.sourceSeen
		delete item.sourceSeenAt
	}
	const evidence = evidenceOf(reconciled.capture)
	const bundle = {
		kind: "goodwatch-708-justwatch-capture",
		version: 1,
		capturedAt: exportedAt,
		country: "US",
		language: "en",
		watchlistRuns: [evidence, evidence],
		reconciled: { chosenRun: 2, completeness: "complete", reasons: [] },
		seenlist: evidenceOf(seen),
		sharedFile: v1.file,
		loss: v1.loss,
		excluded: [],
	}
	const { lines, metrics } = await buildReport(bundle, memoryCatalog(catalog as never))
	assert.equal(metrics.fileVersion, 1)
	assert.equal(metrics.sourceSeenRows, 2)
	assert.match(lines.join("\n"), /upgraded from version 1/)
	const v11 = { ...bundle, sharedFile: toSharedWishlist(reconciled.capture, { exportedAt, seen }).file }
	const current = await buildReport(v11, memoryCatalog(catalog as never))
	assert.equal(current.metrics.fileVersion, 1.1)
	assert.equal(current.metrics.sourceSeenRows, 2)
})
