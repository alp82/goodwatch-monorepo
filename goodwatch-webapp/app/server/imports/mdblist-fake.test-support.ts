// A synthetic MDBList API for tests and local screenshots. Shapes follow the real account reads recorded in
// docs/prototypes/wishlist-imports/mdblist-reader (October 23, 2026): cursor in pagination.next_cursor, X-Has-More and
// pagination.has_more, X-Matched-Items per page, and X-Total-Items plus pagination.total on the Watchlist only.
// Titles and IDs are public catalog entries, never member data.
import { createServer } from "node:http"

type Row = Record<string, unknown>
export type Bucket = "movies" | "shows" | "seasons" | "episodes"
type Buckets = Partial<Record<Bucket, Row[]>>

export interface FakeMdblistAccount {
	watchlist: Buckets
	/** One row per item, with last_watched_at. */
	watched: Buckets
	/** plays=all: one row per play, movies and episodes only. */
	plays: Buckets
	ratings: Buckets
	dropped: Buckets
	droppedSeasons: Buckets
	/** The member's own lists, each with its entries in the Watchlist's envelope. */
	lists: {
		id: number
		name: string
		slug: string
		entries: Buckets
		/** The list's own order across types, when it differs from movies first. */
		ordered?: { bucket: Bucket; row: Row }[]
	}[]
}

export type FakeRoute =
	| "watchlist"
	| "watched"
	| "plays"
	| "ratings"
	| "dropped"
	| "droppedSeasons"
	| "lists"
	| "listItems"

export interface FakeMdblistOptions {
	key?: string
	account?: FakeMdblistAccount
	/** Rows per page, whatever limit the client asks for. */
	pageSize?: number
	/** Status for every request, or for one route. */
	status?: number | Partial<Record<FakeRoute, number>>
	/** Replace or drop (null) one header on a route's pages. */
	header?: (
		route: FakeRoute,
		name: string,
		value: string | null,
		filter: string | null,
	) => string | null
	/** Change a page body before it is sent. */
	body?: (route: FakeRoute, body: Row, filter: string | null) => Row
	/** Leave this row index out of the filtered reads of a route. */
	skipInFilteredRead?: { route: FakeRoute; mediatype: string }
	/** Fail the first n requests with this status. */
	flaky?: { status: number; times: number; retryAfter?: string }
	rateLimitRemaining?: number
	/** Replace a list's item count in /lists/user. */
	listCount?: (id: number, count: number) => number
}

const ids = (tmdb: number, imdb: string | null, extra: Row = {}) => ({
	tmdb,
	...(imdb ? { imdb } : {}),
	mdblist: `mdbl-${tmdb}`,
	trakt: tmdb + 100_000,
	...extra,
})
const toyStory = { title: "Toy Story", year: 1995, ids: ids(862, "tt0114709") }
const matrix = { title: "The Matrix", year: 1999, ids: ids(603, "tt0133093") }
const breakingBad = {
	title: "Breaking Bad",
	year: 2008,
	ids: ids(1396, "tt0903747", { tvdb: 81189 }),
}
const chernobyl = {
	title: "Chernobyl",
	year: 2019,
	ids: ids(87108, "tt7366338"),
}
const lost = { title: "Lost", year: 2004, ids: ids(4607, "tt0411008") }
const theWire = { title: "The Wire", year: 2002, ids: ids(1438, "tt0306414") }
const severance = {
	title: "Severance",
	year: 2022,
	ids: ids(95396, "tt11280740"),
}
const pilot = {
	season: 1,
	number: 1,
	name: "Pilot",
	ids: { tmdb: 62085, tvdb: 349232 },
	show: breakingBad,
}
const catsInTheBag = {
	season: 1,
	number: 2,
	name: "Cat's in the Bag...",
	ids: { tmdb: 62086, tvdb: 349235 },
	show: breakingBad,
}
const oneTwentyThree = {
	season: 1,
	number: 1,
	name: "1:23:45",
	ids: { tmdb: 1771497, tvdb: 7121426 },
	show: chernobyl,
}

/** A small account with every kind GoodWatch imports, and one of each unsupported row. */
export function syntheticMdblistAccount(): FakeMdblistAccount {
	const want = (item: Row, mediatype: string, at: string) => ({
		id: (item.ids as Row).tmdb,
		title: item.title,
		release_year: item.year,
		mediatype,
		imdb_id: (item.ids as Row).imdb,
		ids: item.ids,
		watchlist_at: at,
		added_at: null,
		last_watched_at: null,
	})
	return {
		watchlist: {
			movies: [
				want(
					{ title: "Dune", year: 2021, ids: ids(438631, "tt1160419") },
					"movie",
					"2026-09-01T10:00:00.000Z",
				),
				want(
					{ title: "Paris, Texas", year: 1984, ids: ids(655, "tt0087884") },
					"movie",
					"2026-09-02T10:00:00.000Z",
				),
			],
			shows: [want(severance, "show", "2026-09-03T10:00:00.000Z")],
			seasons: [
				{
					season: { number: 2, ids: { tmdb: 3625 }, show: theWire },
					watchlist_at: "2026-09-04T10:00:00.000Z",
				},
			],
			episodes: [
				// Its show is on the Watchlist too, so the whole show is already wanted.
				{
					episode: {
						season: 1,
						number: 1,
						name: "Good News About Hell",
						ids: { tmdb: 1981411 },
						show: severance,
					},
					watchlist_at: "2026-09-05T10:00:00.000Z",
				},
			],
		},
		watched: {
			movies: [
				// Watched three times: two plays in history, and a later latest watch only on the item.
				{ last_watched_at: "2026-10-20T20:00:00.000Z", movie: toyStory },
				{ last_watched_at: "2026-05-01T20:00:00.000Z", movie: matrix },
				// No catalog ID and no play: its one watch exists only as the latest watched date.
				{
					last_watched_at: "2026-04-04T19:00:00.000Z",
					movie: {
						title: "Synthetic Home Movie",
						year: 2020,
						ids: { mdblist: "mdbl-home-1" },
					},
				},
			],
			shows: [
				{ last_watched_at: "2026-10-01T21:00:00.000Z", show: breakingBad },
			],
			seasons: [
				{
					last_watched_at: "2026-10-01T21:00:00.000Z",
					season: { number: 1, ids: { tmdb: 3572 }, show: breakingBad },
				},
			],
			episodes: [
				{ last_watched_at: "2026-10-01T21:00:00.000Z", episode: pilot },
				{ last_watched_at: "2026-10-01T21:00:00.000Z", episode: catsInTheBag },
				// Moved after its only play without a new viewing (owner Q48): not an extra watch.
				{
					last_watched_at: "2026-08-15T21:46:17.000Z",
					episode: oneTwentyThree,
				},
			],
		},
		plays: {
			movies: [
				{
					play_id: 9001,
					watched_at: "2026-03-01T20:00:00.000Z",
					movie: toyStory,
				},
				{
					play_id: 9002,
					watched_at: "2026-06-10T20:00:00.000Z",
					movie: toyStory,
				},
				{
					play_id: 9003,
					watched_at: "2026-05-01T20:00:00.000Z",
					movie: matrix,
				},
			],
			episodes: [
				{
					play_id: 9101,
					watched_at: "2026-10-01T21:00:00.000Z",
					episode: pilot,
				},
				{
					play_id: 9102,
					watched_at: "2026-10-01T21:00:00.000Z",
					episode: catsInTheBag,
				},
				{
					play_id: 9103,
					watched_at: "2026-08-15T21:00:00.000Z",
					episode: oneTwentyThree,
				},
			],
		},
		ratings: {
			movies: [
				{
					rated_at: "2026-10-21T08:00:00.000Z",
					rating: 8,
					rating_precise: 7.5,
					movie: toyStory,
				},
			],
			shows: [
				{
					rated_at: "2026-10-21T08:01:00.000Z",
					rating: 9,
					rating_precise: 9,
					show: breakingBad,
				},
			],
			seasons: [
				{
					rated_at: "2026-10-21T08:03:00.000Z",
					rating: 8,
					rating_precise: 7.5,
					season: { number: 1, ids: { tmdb: 3572 }, show: breakingBad },
				},
			],
			episodes: [
				{
					rated_at: "2026-10-21T08:02:00.000Z",
					rating: 5,
					rating_precise: 4.5,
					episode: oneTwentyThree,
				},
			],
		},
		dropped: {
			shows: [{ dropped_at: "2026-07-01T09:00:00.000Z", show: lost }],
		},
		droppedSeasons: {
			seasons: [
				{
					dropped_at: "2026-07-02T09:00:00.000Z",
					season: { number: 3, show: lost },
				},
			],
		},
		lists: [
			{
				id: 501,
				name: "Synthetic picks",
				slug: "synthetic-picks",
				entries: {
					movies: [want(matrix, "movie", "2026-09-06T10:00:00.000Z")],
					shows: [want(chernobyl, "show", "2026-09-06T10:01:00.000Z")],
				},
			},
		],
	}
}

const routeOf = (url: URL): FakeRoute | null => {
	if (url.pathname === "/watchlist/items") return "watchlist"
	if (url.pathname === "/sync/watched")
		return url.searchParams.get("plays") === "all" ? "plays" : "watched"
	if (url.pathname === "/sync/ratings") return "ratings"
	if (url.pathname === "/sync/dropped") return "dropped"
	if (url.pathname === "/sync/seasons/dropped") return "droppedSeasons"
	if (url.pathname === "/lists/user") return "lists"
	if (/^\/lists\/\d+\/items$/.test(url.pathname)) return "listItems"
	return null
}
const ROUTE_BUCKETS: Record<FakeRoute, Bucket[]> = {
	watchlist: ["movies", "shows", "seasons", "episodes"],
	watched: ["movies", "shows", "seasons", "episodes"],
	plays: ["movies", "episodes"],
	ratings: ["movies", "shows", "seasons", "episodes"],
	dropped: ["shows"],
	droppedSeasons: ["seasons"],
	lists: [],
	listItems: ["movies", "shows", "seasons", "episodes"],
}
const FILTER_BUCKET: Record<string, Bucket> = {
	movie: "movies",
	show: "shows",
	season: "seasons",
	episode: "episodes",
}

export interface FakeMdblist {
	fetch: typeof fetch
	requests: { url: URL; method: string; userAgent: string | null }[]
	options: FakeMdblistOptions
}

export function fakeMdblist(options: FakeMdblistOptions = {}): FakeMdblist {
	const key = options.key ?? "synthetic-key-0001"
	const account = options.account ?? syntheticMdblistAccount()
	const requests: FakeMdblist["requests"] = []
	let flakyLeft = options.flaky?.times ?? 0
	const respond = (url: URL, method: string, userAgent: string | null) => {
		requests.push({ url, method, userAgent })
		const json = (body: unknown, status = 200, headers: Row = {}) =>
			new Response(JSON.stringify(body), {
				status,
				headers: {
					"Content-Type": "application/json",
					"X-RateLimit-Limit": "1000",
					"X-RateLimit-Remaining": String(options.rateLimitRemaining ?? 990),
					"X-RateLimit-Reset": "1793232000",
					...(headers as Record<string, string>),
				},
			})
		if (method !== "GET") return json({ error: "read only fake" }, 405)
		if (url.searchParams.get("apikey") !== key)
			return json(
				{ error: `Invalid API key ${url.searchParams.get("apikey")}` },
				401,
			)
		if (flakyLeft > 0) {
			flakyLeft--
			return json(
				{ error: "busy" },
				options.flaky?.status,
				options.flaky?.retryAfter
					? { "Retry-After": options.flaky.retryAfter }
					: {},
			)
		}
		const route = routeOf(url)
		if (!route) return json({ error: "not found" }, 404)
		const status =
			typeof options.status === "number"
				? options.status
				: options.status?.[route]
		if (status) return json({ error: `failure for ${key}` }, status)
		if (route === "lists")
			return json(
				account.lists.map((list) => {
					const count = (list.ordered ?? Object.values(list.entries).flat())
						.length
					return {
						id: list.id,
						name: list.name,
						slug: list.slug,
						items: options.listCount
							? options.listCount(list.id, count)
							: count,
						likes: 0,
						ranked: 0,
					}
				}),
			)
		const filter = url.searchParams.get("mediatype")
		const buckets = ROUTE_BUCKETS[route].filter(
			(bucket) => !filter || FILTER_BUCKET[filter] === bucket,
		)
		const source =
			route === "listItems"
				? (account.lists.find(
						(list) => url.pathname === `/lists/${list.id}/items`,
					)?.entries ?? {})
				: account[route as Exclude<FakeRoute, "lists" | "listItems">]
		const ordered =
			route === "listItems"
				? account.lists.find(
						(list) => url.pathname === `/lists/${list.id}/items`,
					)?.ordered
				: undefined
		const rows = ordered
			? ordered
					.filter((entry) => buckets.includes(entry.bucket))
					.map((entry, index) => ({ ...entry, index }))
			: buckets.flatMap((bucket) =>
					(source[bucket] ?? []).map((row, index) => ({ bucket, row, index })),
				)
		const visible = rows.filter(
			(entry) =>
				!(
					filter &&
					options.skipInFilteredRead?.route === route &&
					options.skipInFilteredRead.mediatype === filter &&
					entry.index === 0
				),
		)
		const size =
			options.pageSize ?? Number(url.searchParams.get("limit") ?? 100)
		const offset = Number(
			Buffer.from(
				url.searchParams.get("cursor") ?? "MA==",
				"base64",
			).toString(),
		)
		const page = visible.slice(offset, offset + size)
		const more = offset + size < visible.length
		let body: Row = Object.fromEntries(
			buckets.map((bucket) => [
				bucket,
				page
					.filter((entry) => entry.bucket === bucket)
					.map((entry) => entry.row),
			]),
		)
		body.pagination = {
			has_more: more,
			limit: size,
			offset,
			...(route === "watchlist" || route === "listItems"
				? { total: visible.length }
				: {}),
			...(more
				? { next_cursor: Buffer.from(String(offset + size)).toString("base64") }
				: {}),
		}
		if (options.body) body = options.body(route, body, filter)
		const headers: Record<string, string> = {}
		const add = (name: string, value: string | null) => {
			const final = options.header
				? options.header(route, name, value, filter)
				: value
			if (final !== null) headers[name] = final
		}
		add("X-Has-More", String(more))
		add("X-Matched-Items", String(page.length))
		add(
			"X-Total-Items",
			route === "watchlist" || route === "listItems"
				? String(visible.length)
				: null,
		)
		return json(body, 200, headers)
	}
	const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = new URL(String(input instanceof Request ? input.url : input))
		const headers = new Headers(init?.headers)
		return respond(url, init?.method ?? "GET", headers.get("User-Agent"))
	}) as typeof fetch
	return { fetch: fakeFetch, requests, options }
}

/** Serves the fake over HTTP for local screenshots: MDBLIST_API_BASE=http://127.0.0.1:<port>. */
export function serveFakeMdblist(
	port: number,
	options: FakeMdblistOptions = {},
) {
	const fake = fakeMdblist(options)
	const server = createServer(async (request, response) => {
		const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`)
		const reply = await fake.fetch(url, {
			method: request.method,
			headers: { "User-Agent": request.headers["user-agent"] ?? "" },
		})
		response.writeHead(reply.status, Object.fromEntries(reply.headers))
		response.end(await reply.text())
	})
	server.listen(port, "127.0.0.1")
	return server
}
