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

test("a full account becomes Want to See, one watch per play, a movie's later latest watch, scores and Dropped", async () => {
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
			["show", 1438, "tt0306414", "2026-09-04T10:00:00.000Z"],
		],
	)
	// A Watchlist season is offered as Want to See for the whole show, unselected until the member chooses (#715).
	const season = wants.find((row) => row.tmdbId === 1438)
	assert.equal(season?.title, "The Wire")
	assert.deepEqual(season?.wishlistEvidence, {
		source: "mdblist",
		profileLabel: "MDBList Watchlist",
		completeness: "complete",
		mediaType: "season",
		sourceId: "mdbl-1438",
	})
	assert.equal(season?.season, 2)
	assert.ok(
		wants.filter((row) => row !== season).every((row) => !row.wishlistEvidence),
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
	// A movie without catalog IDs keeps its latest watch as an unmatched row with its title and native ID.
	const home = watches.filter((row) => row.title === "Synthetic Home Movie")
	assert.deepEqual(
		home.map((row) => [
			row.mediaType,
			row.tmdbId,
			row.imdbId,
			row.year,
			row.watchedAt,
		]),
		[["movie", null, null, 2020, "2026-04-04T19:00:00.000Z"]],
	)
	assert.match(home[0].key, /mdblist:mdbl-home-1/)
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
	// An episode's latest date can move without a viewing (owner Q48): episodes get one watch per play only.
	assert.ok(episodes.every((row) => !row.key.includes(":latest:")))

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
		[95396, "The whole show is also on your MDBList Watchlist."],
		[87108, "GoodWatch doesn't import season or episode ratings yet."],
		[
			4607,
			"GoodWatch doesn't track dropped seasons, so this season was left as it is.",
		],
	])
	// Each MDBList list becomes one private GoodWatch list through the shared list import (#758).
	const lists = byKind(parsed, "list")
	assert.equal(lists.length, 1)
	assert.equal(lists[0].customList?.name, "Synthetic picks")
	assert.equal(lists[0].customList?.sourceId, "mdblist:501")
	assert.deepEqual(
		lists[0].customList?.entries.map(({ position, entry }) => [
			position,
			entry.mediaType,
			entry.tmdbId,
			entry.title,
			entry.problem?.outcome ?? null,
		]),
		[
			[1, "movie", 603, "The Matrix", null],
			[2, "show", 87108, "Chernobyl", null],
		],
	)
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
	// Watchlist 1 + 4 type reads, plays 1 + 2, movie dates 1 + 1, ratings, dropped shows, dropped seasons,
	// the list index and one list.
	assert.equal(fake.requests.length, 15)
	assert.doesNotMatch(JSON.stringify(parsed), new RegExp(KEY))
})

test("pages follow the cursor to the end and stay complete", async () => {
	const { fake, read } = client({ pageSize: 2 })
	const parsed = await read()
	assert.deepEqual(actionable(parsed), [])
	assert.equal(byKind(parsed, "watch").length, 8)
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

test("the latest-watch dates are checked like any read: a missing movie or no end signal is reported", async () => {
	const missing = client({
		skipInFilteredRead: { route: "watched", mediatype: "movie" },
	})
	assert.match(
		actionable(await missing.read()).join(" "),
		/count of your watched movies didn't match what GoodWatch read/,
	)
	const unended = client({
		header: (route, name, value) =>
			route === "watched" && name === "X-Has-More" ? null : value,
		body: (route, body) =>
			route === "watched"
				? { ...body, pagination: { limit: 1000, offset: 0 } }
				: body,
	})
	assert.match(
		actionable(await unended.read()).join(" "),
		/couldn't confirm that GoodWatch read all your watched movies/,
	)
})

test("a list whose entries don't match its count is reported as partial", async () => {
	const { read } = client({ listCount: (_id, count) => count + 1 })
	assert.match(
		actionable(await read()).join(" "),
		/count of your MDBList lists didn't match what GoodWatch read/,
	)
})

test("a stalled answer body times out instead of holding the key", async () => {
	const previous = process.env.MDBLIST_TIMEOUT_MS
	process.env.MDBLIST_TIMEOUT_MS = "40"
	try {
		const mdblist = createMdblistClient({
			fetch: async () =>
				new Response(new ReadableStream({ start() {} }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			sleep: async () => {},
		})
		const started = Date.now()
		const error = await mdblist.readAccount(KEY).catch((e: unknown) => e)
		assert.ok(error instanceof MdblistError, String(error))
		assert.match(error.message, /couldn't reach MDBList/)
		assert.ok(Date.now() - started < 2000)
	} finally {
		if (previous === undefined)
			Reflect.deleteProperty(process.env, "MDBLIST_TIMEOUT_MS")
		else process.env.MDBLIST_TIMEOUT_MS = previous
	}
})

test("canceling the member's request aborts the MDBList read and stops retrying", async () => {
	const signals: AbortSignal[] = []
	let calls = 0
	const mdblist = createMdblistClient({
		fetch: async (_input, init) => {
			calls++
			const signal = init?.signal as AbortSignal
			signals.push(signal)
			return new Promise<Response>((_resolve, reject) => {
				signal.addEventListener("abort", () => reject(signal.reason), {
					once: true,
				})
			})
		},
		sleep: async () => {},
	})
	const controller = new AbortController()
	const reading = mdblist
		.readAccount(KEY, { signal: controller.signal })
		.catch((e: unknown) => e)
	await new Promise((resolve) => setTimeout(resolve, 10))
	controller.abort()
	const error = await reading
	assert.ok(error instanceof MdblistError, String(error))
	assert.match(error.message, /canceled/)
	assert.equal(calls, 1)
	assert.ok(signals[0].aborted)
})

test("a list's season or episode entries stay visible in the list, not stored as titles", async () => {
	const account = syntheticMdblistAccount()
	account.lists[0].entries.seasons = [
		{
			season: {
				number: 1,
				show: { title: "Lost", year: 2004, ids: { tmdb: 4607 } },
			},
		},
	]
	const { read } = client({ account })
	const parsed = await read()
	assert.deepEqual(actionable(parsed), [])
	const entries = byKind(parsed, "list")[0].customList?.entries ?? []
	assert.equal(entries.length, 3)
	assert.deepEqual(
		entries.map(({ entry }) => entry.problem?.outcome ?? null),
		[null, null, "unsupported"],
	)
	assert.match(entries[2].entry.problem?.reason ?? "", /MDBList season entries/)
})

test("list reads check MDBList's counts: a missing or different total is reported", async () => {
	for (const [value, message] of [
		[null, /couldn't confirm that GoodWatch read all your MDBList lists/],
		["9", /count of your MDBList lists didn't match what GoodWatch read/],
	] as const) {
		const { read } = client({
			header: (route, name, current) =>
				route === "listItems" && name === "X-Total-Items" ? value : current,
		})
		assert.match(actionable(await read()).join(" "), message)
	}
})

test("an unranked list keeps MDBList's order across movies, shows and pages", async () => {
	const account = syntheticMdblistAccount()
	const entry = (title: string, tmdb: number, mediatype: string) => ({
		id: tmdb,
		title,
		release_year: 2000,
		mediatype,
		ids: { tmdb },
	})
	account.lists[0].ordered = [
		{ bucket: "movies", row: entry("First movie", 11, "movie") },
		{ bucket: "shows", row: entry("Second show", 12, "show") },
		{ bucket: "movies", row: entry("Third movie", 13, "movie") },
	]
	const { read } = client({ account, pageSize: 1 })
	const parsed = await read()
	assert.deepEqual(actionable(parsed), [])
	assert.deepEqual(
		byKind(parsed, "list")[0].customList?.entries.map(({ position, entry }) => [
			position,
			entry.title,
		]),
		[
			[1, "First movie"],
			[2, "Second show"],
			[3, "Third movie"],
		],
	)
})

test("a ranked list follows MDBList's ranks", async () => {
	const account = syntheticMdblistAccount()
	const entry = (
		title: string,
		tmdb: number,
		mediatype: string,
		rank: number,
	) => ({
		id: tmdb,
		rank,
		title,
		release_year: 2000,
		mediatype,
		ids: { tmdb },
	})
	account.lists[0].ordered = [
		{ bucket: "movies", row: entry("Ranked third", 21, "movie", 3) },
		{ bucket: "shows", row: entry("Ranked first", 22, "show", 1) },
		{ bucket: "movies", row: entry("Ranked second", 23, "movie", 2) },
	]
	const { read } = client({ account })
	assert.deepEqual(
		byKind(await read(), "list")[0].customList?.entries.map(
			({ entry }) => entry.title,
		),
		["Ranked first", "Ranked second", "Ranked third"],
	)
})
