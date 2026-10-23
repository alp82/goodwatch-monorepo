import assert from "node:assert/strict"
import { test } from "node:test"
import type { ImportObservation, ParsedImport } from "../../domain/imports.ts"
import { MdblistError, createMdblistClient } from "./mdblist-client.server.ts"
import {
	type FakeMdblistOptions,
	fakeMdblist,
	syntheticMdblistAccount,
} from "./mdblist-fake.test-support.ts"

const KEY = "synthetic-key-0001"
function client(options: FakeMdblistOptions = {}) {
	const fake = fakeMdblist({ key: KEY, ...options })
	const sleeps: number[] = []
	const mdblist = createMdblistClient({
		fetch: fake.fetch,
		sleep: async (ms) => {
			sleeps.push(ms)
		},
	})
	return { fake, sleeps, read: () => mdblist.readAccount(KEY) }
}
const byKind = (parsed: ParsedImport, kind: ImportObservation["kind"]) =>
	parsed.observations.filter((row) => row.kind === kind)
const actionable = (parsed: ParsedImport) =>
	parsed.warnings.filter((w) => w.kind === "actionable").map((w) => w.message)

test("a full account becomes Want to See, one watch per play, the later latest watch, scores and Dropped", async () => {
	const { fake, read } = client()
	const parsed = await read()
	assert.equal(parsed.source, "mdblist")
	assert.deepEqual(actionable(parsed), [])

	const wants = byKind(parsed, "want")
	assert.deepEqual(
		wants.map((row) => [row.mediaType, row.tmdbId, row.imdbId, row.addedAt]),
		[
			["movie", 438631, "tt1160419", "2026-09-01T10:00:00.000Z"],
			["movie", 655, "tt0087884", "2026-09-02T10:00:00.000Z"],
			["show", 95396, "tt11280740", "2026-09-03T10:00:00.000Z"],
		],
	)

	const watches = byKind(parsed, "watch")
	const toyStory = watches.filter((row) => row.tmdbId === 862)
	// Two plays, plus the latest watch that MDBList keeps only on the item (owner Q43: three watches).
	assert.deepEqual(toyStory.map((row) => row.watchedAt).sort(), [
		"2026-03-01T20:00:00.000Z",
		"2026-06-10T20:00:00.000Z",
		"2026-10-20T20:00:00.000Z",
	])
	assert.ok(toyStory.every((row) => row.precision === "moment"))
	assert.equal(new Set(toyStory.map((row) => row.key)).size, 3)
	// A latest watch equal to the last play is the same watch.
	assert.equal(watches.filter((row) => row.tmdbId === 603).length, 1)
	const episodes = watches.filter((row) => row.mediaType === "show")
	assert.deepEqual(
		episodes.map((row) => [
			row.tmdbId,
			row.season,
			row.episode,
			row.episodeTmdbId,
		]),
		[
			[1396, 1, 1, 62085],
			[1396, 1, 2, 62086],
			[87108, 1, 1, 1771497],
		],
	)
	assert.ok(episodes.every((row) => row.episodeNumbering === "tmdb"))

	const ratings = byKind(parsed, "rating")
	assert.deepEqual(
		ratings.map((row) => [row.mediaType, row.tmdbId, row.score, row.addedAt]),
		[
			["movie", 862, 8, "2026-10-21T08:00:00.000Z"],
			["show", 1396, 9, "2026-10-21T08:01:00.000Z"],
		],
	)

	assert.deepEqual(
		byKind(parsed, "show_status").map((row) => [row.tmdbId, row.showStatus]),
		[[4607, "dropped"]],
	)

	const unsupported = byKind(parsed, "unsupported").map((row) => [
		row.tmdbId,
		row.problem?.reason,
	])
	assert.deepEqual(unsupported, [
		[
			4607,
			"GoodWatch adds whole shows to Want to See. This MDBList season wasn't added.",
		],
		[87108, "GoodWatch doesn't import season or episode ratings yet."],
		[
			4607,
			"GoodWatch doesn't track dropped seasons, so this season was left as it is.",
		],
	])

	// Read-only and identified: every request is a GET with GoodWatch's User-Agent, and the key only in apikey.
	assert.ok(fake.requests.every((r) => r.method === "GET"))
	assert.ok(fake.requests.every((r) => /^GoodWatch\//.test(r.userAgent ?? "")))
	assert.ok(
		fake.requests.every((r) => r.url.searchParams.get("apikey") === KEY),
	)
	assert.ok(
		fake.requests.every(
			(r) => !r.url.pathname.includes(KEY) && !r.url.hash.includes(KEY),
		),
	)
	// Watchlist 1 + 4 type reads, plays 1 + 2, item dates 2, ratings, dropped shows, dropped seasons.
	assert.equal(fake.requests.length, 13)
	assert.doesNotMatch(JSON.stringify(parsed), new RegExp(KEY))
})

test("pages follow the cursor to the end and stay complete", async () => {
	const { fake, read } = client({ pageSize: 2 })
	const parsed = await read()
	assert.deepEqual(actionable(parsed), [])
	assert.equal(byKind(parsed, "watch").length, 7)
	assert.ok(fake.requests.some((r) => r.url.searchParams.has("cursor")))
})

test("a Watchlist page without count headers makes the import unconfirmed, not complete", async () => {
	for (const missing of ["X-Total-Items", "X-Matched-Items"]) {
		const { read } = client({
			header: (route, name, value) =>
				route === "watchlist" && name === missing ? null : value,
		})
		assert.match(
			actionable(await read()).join(" "),
			/couldn't confirm that GoodWatch read your whole Watchlist/,
		)
	}
})

test("a Watchlist count that differs from the rows read is reported as partial", async () => {
	const { read } = client({
		header: (route, name, value, filter) =>
			route === "watchlist" && name === "X-Total-Items" && !filter
				? "9"
				: value,
	})
	assert.match(
		actionable(await read()).join(" "),
		/Watchlist.*didn't match what GoodWatch read/,
	)
})

test("history without an end signal is unconfirmed", async () => {
	const { read } = client({
		header: (route, name, value) =>
			route === "ratings" && name === "X-Has-More" ? null : value,
		body: (route, body) =>
			route === "ratings"
				? { ...body, pagination: { limit: 1000, offset: 0 } }
				: body,
	})
	assert.match(
		actionable(await read()).join(" "),
		/couldn't confirm that GoodWatch read all your ratings/,
	)
})

test("a play missing from the per-type read is reported as partial", async () => {
	const { read } = client({
		skipInFilteredRead: { route: "plays", mediatype: "movie" },
	})
	assert.match(
		actionable(await read()).join(" "),
		/watch history.*didn't match what GoodWatch read/,
	)
})

test("an unknown list or a row that isn't an object makes that read unconfirmed", async () => {
	const { read } = client({
		body: (route, body) =>
			route === "watchlist" ? { ...body, games: [{ title: "Tetris" }] } : body,
	})
	assert.match(actionable(await read()).join(" "), /whole Watchlist/)
	const broken = client({
		body: (route, body) =>
			route === "dropped"
				? { ...body, shows: [...(body.shows as []), 7] }
				: body,
	})
	assert.match(actionable(await broken.read()).join(" "), /dropped shows/)
})

test("a refused key, a refused request and the daily limit fail with fixed messages", async () => {
	const cases: [FakeMdblistOptions, RegExp, number][] = [
		[{ key: "another-key" }, /didn't accept this API key/, 400],
		[{ status: 403 }, /MDBList refused the request/, 502],
		[{ status: 429, rateLimitRemaining: 0 }, /daily request limit/, 429],
		[{ status: 503 }, /MDBList isn't responding/, 503],
	]
	for (const [options, message, status] of cases) {
		const { read } = client(options)
		const error = await read().catch((e: unknown) => e)
		assert.ok(error instanceof MdblistError, String(error))
		assert.match(error.message, message)
		assert.equal(error.status, status)
		assert.doesNotMatch(error.message + String(error.stack), new RegExp(KEY))
	}
})

test("a short Retry-After is waited out once; 5xx is retried, then fails", async () => {
	const busy = client({ flaky: { status: 429, times: 1, retryAfter: "2" } })
	assert.deepEqual(actionable(await busy.read()), [])
	assert.deepEqual(busy.sleeps.slice(0, 1), [2000])
	const down = client({ flaky: { status: 502, times: 2 } })
	assert.deepEqual(actionable(await down.read()), [])
	const long = client({ flaky: { status: 429, times: 1, retryAfter: "600" } })
	await assert.rejects(long.read(), /MDBList is busy/)
})

test("a network failure never surfaces the request URL", async () => {
	const mdblist = createMdblistClient({
		fetch: async (input) => {
			throw new TypeError(`fetch failed for ${String(input)}`)
		},
		sleep: async () => {},
	})
	const error = await mdblist.readAccount(KEY).catch((e: unknown) => e)
	assert.ok(error instanceof MdblistError)
	assert.match(error.message, /couldn't reach MDBList/)
	assert.doesNotMatch(error.message + String(error.stack), new RegExp(KEY))
})

test("more items without a cursor, or a repeated cursor, fail instead of stopping early", async () => {
	const noCursor = client({
		pageSize: 2,
		body: (route, body) =>
			route === "plays"
				? {
						...body,
						pagination: {
							...(body.pagination as object),
							next_cursor: undefined,
						},
					}
				: body,
	})
	await assert.rejects(noCursor.read(), /stopped before the end/)
	const repeated = client({
		pageSize: 2,
		body: (route, body) =>
			route === "plays" && (body.pagination as { has_more: boolean }).has_more
				? {
						...body,
						pagination: { ...(body.pagination as object), next_cursor: "MA==" },
					}
				: body,
	})
	await assert.rejects(repeated.read(), /stopped before the end/)
})

test("a list that isn't a list fails the import", async () => {
	const { read } = client({
		body: (route, body) =>
			route === "ratings" ? { ...body, movies: {} } : body,
	})
	await assert.rejects(read(), /unreadable/)
})

test("the key never reaches the preview, even when MDBList echoes it in a title", async () => {
	const account = syntheticMdblistAccount()
	;(account.watchlist.movies?.[0] as { title: string }).title = `Dune ${KEY}`
	const { read } = client({ account })
	const error = await read().catch((e: unknown) => e)
	assert.ok(error instanceof MdblistError)
	assert.match(error.message, /can't import safely/)
	assert.doesNotMatch(error.message, new RegExp(KEY))
})

test("an invalid half step is kept visible as invalid; the whole number is used when there is no precise one", async () => {
	const account = syntheticMdblistAccount()
	account.ratings.movies = [
		{
			rated_at: "2026-10-21T08:00:00.000Z",
			rating: 7,
			movie: { title: "A", year: 2000, ids: { tmdb: 1 } },
		},
		{
			rated_at: "2026-10-21T08:00:00.000Z",
			rating_precise: 7.3,
			movie: { title: "B", year: 2000, ids: { tmdb: 2 } },
		},
		{
			rated_at: "2026-10-21T08:00:00.000Z",
			rating_precise: 0.5,
			movie: { title: "C", year: 2000, ids: { tmdb: 3 } },
		},
	]
	const { read } = client({ account })
	const ratings = byKind(await read(), "rating").filter(
		(row) => row.mediaType === "movie",
	)
	assert.deepEqual(
		ratings.map((row) => [row.tmdbId, row.score, row.problem?.outcome ?? null]),
		[
			[1, 7, null],
			[2, null, "invalid"],
			[3, null, "invalid"],
		],
	)
})
