// Reviewer's adversarial cases for 0c2ae215. Run: node --test prototypes/justwatch-wishlist/adversarial.test.ts
import assert from "node:assert/strict"
import { it } from "node:test"
import { captureList, evidenceOf, reconcileRuns, toSharedWishlist } from "./capture-core.js"
import { memoryCatalog } from "./preview-runner.ts"
import { buildReport } from "./report-core.ts"
import { runSnippet, TOKEN } from "./snippet-harness.mjs"

const scripted = (responses: unknown[]) => {
	let index = 0
	return async () => structuredClone(responses[Math.min(index++, responses.length - 1)]) as { status: number; body: unknown }
}
const page = (edges: unknown[], { totalCount = edges.length, pageInfo = { endCursor: "c1", hasNextPage: false } as unknown } = {}) => ({
	status: 200,
	body: { data: { titleListV2: { totalCount, ...(pageInfo === "omit" ? {} : { pageInfo }), edges } } },
})
const wish = (id: string, extra: Record<string, unknown> = {}) => ({
	node: {
		id,
		objectType: "MOVIE",
		content: { title: `Title ${id}`, originalReleaseYear: 2000, fullPath: `/us/movie/${id}`, externalIds: { tmdbId: "862", imdbId: "tt0114709" } },
		watchlistEntryV2: { createdAt: "2026-01-01T00:00:00Z" },
		...extra,
	},
})
async function twoRunFile(responses: unknown[]) {
	const first = await captureList({ request: scripted(responses), country: "US", listType: "WATCHLIST" })
	const second = await captureList({ request: scripted(responses), country: "US", listType: "WATCHLIST" })
	const reconciled = reconcileRuns(first, second)
	const shared = toSharedWishlist(reconciled.capture, { exportedAt: "2026-10-19T00:00:00Z" })
	return { first, second, reconciled, shared, saved: JSON.stringify({ e1: evidenceOf(first), e2: evidenceOf(second), shared }) }
}

it("1. never saves raw server error text, codes, paths, cursors or echoed fields", async () => {
	const echo = `Bearer ${TOKEN}`
	const withErrors = page([wish("tm1", { objectType: `MOVIE ${echo}` }), wish("tm2", { content: { title: "Two", externalIds: { tmdbId: echo, imdbId: echo } }, watchlistEntryV2: { createdAt: echo } })], {
		pageInfo: { endCursor: echo, hasNextPage: false },
	}) as any
	withErrors.body.errors = [{ message: `token ${echo}`, path: ["a", echo], extensions: { code: echo } }]
	const { saved } = await twoRunFile([withErrors])
	assert.ok(!saved.includes(TOKEN), "a 200 response's echoed values reach the saved record")
	const rejected = { status: 400, body: { errors: [{ message: echo, extensions: { code: echo } }] } }
	const { saved: savedRejected } = await twoRunFile([rejected])
	assert.ok(!savedRejected.includes(TOKEN), "a rejected response's error text reaches the saved record")
})

it("1. the built snippet never writes an echoed token into the download", async () => {
	const { savedText } = await runSnippet({
		respond: async (body: any, server: any) => {
			const response = await server.request(body)
			response.body.errors = [{ message: `Invalid header Bearer ${TOKEN}`, path: [TOKEN], extensions: { code: TOKEN } }]
			return response
		},
	})
	assert.ok(savedText)
	assert.ok(!savedText.includes(TOKEN))
})

it("1. the report prints error categories only, never raw codes", async () => {
	const bundle = reportBundle()
	bundle.watchlistRuns[0].graphqlErrors = [{ page: 0, code: "RAW_CODE_FROM_SERVER", message: "m", path: "" }]
	const { lines } = await buildReport(bundle, memoryCatalog({ movie: [], show: [] }))
	assert.ok(!lines.join("\n").includes("RAW_CODE_FROM_SERVER"))
})

it("2. a null node counted by totalCount makes the file not complete", async () => {
	const { shared } = await twoRunFile([page([{ node: null }], { totalCount: 1 })])
	assert.equal(shared.file.items.length, 0)
	assert.notEqual(shared.file.completeness, "complete")
})

it("2. a node without Watchlist membership makes the file not complete", async () => {
	const { shared } = await twoRunFile([page([wish("tm1", { watchlistEntryV2: null })], { totalCount: 1 })])
	assert.equal(shared.file.items.length, 0)
	assert.notEqual(shared.file.completeness, "complete")
})

it("3. missing or non-boolean hasNextPage never ends a run as exhausted", async () => {
	for (const pageInfo of ["omit", { endCursor: "c1" }, { endCursor: "c1", hasNextPage: null }, { endCursor: "c1", hasNextPage: "false" }]) {
		const { first, shared } = await twoRunFile([page([wish("tm1")], { pageInfo })])
		assert.notEqual(first.terminal, "exhausted", JSON.stringify(pageInfo))
		assert.notEqual(shared.file.completeness, "complete", JSON.stringify(pageInfo))
	}
})

it("4. identity and membership checks use the run the file was built from", async () => {
	const bundle = reportBundle()
	bundle.reconciled.chosenRun = 2
	bundle.watchlistRuns[0].members = [member("tm1", { tmdb: "1" })]
	bundle.watchlistRuns[1].members = [member("tm1", { tmdb: "862" }), member("tm9", { watchlist: false })]
	const { metrics } = await buildReport(bundle, memoryCatalog({ movie: [], show: [] }))
	assert.equal(metrics.idMismatch, 0)
	assert.equal(metrics.flaggedNotWished, 1)
})

it("4. Seen overlap is a lower bound when the Seen capture is incomplete", async () => {
	const bundle = reportBundle()
	bundle.seenlist.completeness = "partial"
	bundle.seenlist.members = [member("tm1", { seen: true })]
	const { lines } = await buildReport(bundle, memoryCatalog({ movie: [], show: [] }))
	assert.match(lines.join("\n"), /Seen list: at least 1 of 1/)
})

it("5. the report counts every catalog statement it issues", async () => {
	let issued = 0
	const inner = memoryCatalog({ movie: [[862, "tt0114709", "Title tm1", 2000]], show: [] })
	const counted = async (...args: Parameters<typeof inner>) => {
		issued++
		return inner(...args)
	}
	const { metrics } = await buildReport(reportBundle(), counted)
	assert.ok(issued > metrics.previewCatalogReads, "the conflict check issued statements of its own")
	assert.equal(metrics.catalogStatements, issued)
})

function member(id: string, extra: Record<string, unknown> = {}) {
	return { id, objectType: "MOVIE", watchlist: true, seen: false, tracked: false, progress: null, tmdb: "862", imdb: "tt0114709", ...extra }
}
function run(members: unknown[]) {
	return { listType: "WATCHLIST", query: "full", terminal: "exhausted", completeness: "complete", completenessReasons: [], requests: 1, durationMs: 1, pages: [{}], totals: [members.length], duplicates: 0, skipped: 0, graphqlErrors: [] as unknown[], members }
}
function reportBundle(): any {
	return {
		kind: "goodwatch-708-justwatch-capture",
		version: 1,
		capturedAt: "2026-10-19T00:00:00Z",
		country: "US",
		language: "en",
		watchlistRuns: [run([member("tm1")]), run([member("tm1")])],
		reconciled: { chosenRun: 1, completeness: "complete", reasons: [] },
		seenlist: { ...run([]), listType: "SEENLIST" },
		sharedFile: {
			format: "goodwatch-wishlist",
			version: 1,
			source: "justwatch",
			country: "US",
			exportedAt: "2026-10-19T00:00:00Z",
			completeness: "complete",
			items: [{ title: "Title tm1", mediaType: "movie", year: 2000, tmdbId: 862, imdbId: "tt0114709", sourceId: "tm1" }],
		},
		loss: {},
		excluded: [],
	}
}
