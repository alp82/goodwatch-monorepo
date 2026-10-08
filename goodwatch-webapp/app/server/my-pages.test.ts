// My shows and My library on the server (#385), against the in-memory Crate of the tracking tests: what each page
// reads, in which groups and order it answers, and that neither scans the watch log.

// CommonJS packages are loaded before the alias hook, which would otherwise resolve their own relative requires.
import "node-crate"
import "ioredis"
import "react"
import "@remix-run/node"
import "zod"
import ts from "typescript"
import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { afterEach, beforeEach, test } from "node:test"
import { CacheTestRedis } from "../utils/cache-test-redis.ts"
import { FakeTrackingCrate } from "./tracking-fake-crate.ts"

// The same stubs as show-tracking.test.ts: the keys of two route files, no auth, and no title snapshot.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/routes/api.user-settings.get.tsx")) {
			const original = readFileSync(new URL(url), "utf8")
			source =
				original.slice(
					original.indexOf("// type definitions"),
					original.indexOf("// API endpoint"),
				) +
				original.slice(
					original.indexOf("export const queryKeyUserSettings"),
					original.indexOf("export const useUserSettings"),
				)
		} else if (url.endsWith("/routes/api.onboarding.media.tsx"))
			source = 'export const queryKeyOnboardingMedia = ["onboarding-media"]'
		else if (url.endsWith("/utils/auth.ts"))
			source =
				'export const getUserIdFromRequest = () => { throw new Error("Unexpected auth") }; export const getAuthFromRequest = getUserIdFromRequest'
		else if (url.endsWith("/title-snapshot/format.server.ts"))
			source = `${readFileSync(new URL(url), "utf8")}\nexport const getTitleSnapshot = () => null`
		if (source === undefined) return next(url, context)
		return {
			format: "module",
			source: ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
				},
			}).outputText,
			shortCircuit: true,
		}
	},
})

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
process.env.REC_TASTE_MATCH = "off"
const { setCrateClientForTest } = await import("../utils/crate.ts")
const { setRedisClusterForTest, resetPendingResetsForTest } = await import(
	"../utils/cache.ts"
)
const { getMyShows } = await import("./my-shows.server.ts")
const { getLibraryPage, forgetTitlesForTest } = await import(
	"./my-library.server.ts"
)

class Redis extends CacheTestRedis {
	async set(key: string, value: string) {
		this.values.set(key, value)
	}
}

type Row = Record<string, unknown>
let db: FakeTrackingCrate
const user = "member-A"
const NOW = Date.parse("2026-10-08T20:00:00Z")
const DAY = 86_400_000
const daysAgo = (days: number) => NOW - days * DAY

// A taste that knows a few shows: the percentile orders, the match is what a row shows.
const TASTE: Record<number, [percentile: number, match: number]> = {
	2000000000301: [99.2, 93],
	2000000000302: [80, 71],
}
const taste = {
	signal: "some" as const,
	ratings: 20,
	liked: 12,
	vector: null,
	match: (keys: number[]) => keys.map((key) => TASTE[key]?.[1] ?? null),
	percentile: (keys: number[]) => keys.map((key) => TASTE[key]?.[0] ?? null),
	reasons: () => [],
	leanings: () => [],
}
const viewer = { userId: user, country: "US", services: [], taste }

let watchN = 0
const watch = (
	showId: number,
	season: number,
	number: number,
	at: number | null,
	rest: Row = {},
): Row => ({
	user_id: user,
	watch_id: `w-${++watchN}`,
	media_type: "show",
	tmdb_id: showId,
	episode_tmdb_id: showId * 1000 + season * 100 + number,
	season_number: season,
	episode_number: number,
	watched_at: at,
	watched_at_precision: at === null ? "unknown" : "day",
	origin: "single",
	group_id: null,
	import_id: null,
	pass: 1,
	created_at: at ?? daysAgo(400),
	updated_at: at ?? daysAgo(400),
	...rest,
})
const movieWatch = (movieId: number, at: number | null, rest: Row = {}): Row =>
	watch(movieId, 0, 0, at, {
		media_type: "movie",
		episode_tmdb_id: null,
		season_number: null,
		episode_number: null,
		...rest,
	})
const stateRow = (mediaType: string, id: number, state: string): Row => ({
	user_id: user,
	tmdb_id: id,
	media_type: mediaType,
	state,
	state_changed_at: daysAgo(1),
	pass: 1,
	seen_press_group: null,
	seen_press_from: null,
	rate_prompt_dismissed_at: null,
	seen_question: "not_asked",
	created_at: daysAgo(1),
	updated_at: daysAgo(1),
})
const title = (mediaType: string, id: number, at = daysAgo(3)): Row => ({
	user_id: user,
	tmdb_id: id,
	media_type: mediaType,
	created_at: at,
	updated_at: at,
})
const show = (id: number, name: string, aired: number | null, status = "Returning Series"): Row => ({
	tmdb_id: id,
	status,
	aired_episode_count: aired,
	title: name,
	poster_path: `/p${id}.jpg`,
	backdrop_path: `/b${id}.jpg`,
	release_year: 2020,
	number_of_seasons: 2,
	number_of_episodes: 12,
	episode_runtime: [45],
})
const episode = (showId: number, season: number, number: number, airDate: number | null): Row => ({
	show_id: showId,
	tmdb_id: showId * 1000 + season * 100 + number,
	season_number: season,
	episode_number: number,
	name: `Episode ${season}.${number}`,
	air_date: airDate,
	runtime: 45,
	still_path: null,
	episode_type: "standard",
	removed_at: null,
})
const season = (showId: number, count: number, upcoming = 0) => [
	...Array.from({ length: count }, (_, i) => episode(showId, 1, i + 1, daysAgo(100 - i))),
	...Array.from({ length: upcoming }, (_, i) => episode(showId, 1, count + i + 1, NOW + (i + 3) * DAY)),
]
const selects = (table: string) =>
	db.statements.filter((s) => s.sql.startsWith("SELECT") && s.sql.includes(`FROM ${table} `))

beforeEach(() => {
	db = new FakeTrackingCrate()
	setCrateClientForTest(db)
	setRedisClusterForTest(new Redis())
	resetPendingResetsForTest()
	forgetTitlesForTest()
})
afterEach(() => {
	setCrateClientForTest(null)
	setRedisClusterForTest(null)
	resetPendingResetsForTest()
})

// ---------------------------------------------------------------------------------------------------------
// My shows
// ---------------------------------------------------------------------------------------------------------

/**
 * 101 Watching, watched yesterday, 3 of 6. 102 Watching, watched 40 days ago. 103 Seen, 6 of 7 aired. 104 Seen and
 * running, nothing new. 105 Seen and ended. 106 On hold. 107 Dropped. 301 and 302 on the Wishlist, not started.
 * 108 Watching with a gap: episodes 1 and 3 of 3 watched.
 */
function seedShows() {
	db.seed("show", [
		show(101, "Slow Horses", 6),
		show(102, "Shōgun", 10),
		show(103, "Only Murders in the Building", 7),
		show(104, "The White Lotus", 6),
		show(105, "Chernobyl", 5, "Ended"),
		show(106, "Dark", 8, "Ended"),
		show(107, "The Idol", 5, "Canceled"),
		show(108, "Severance", 3),
		show(301, "The Bear", 8),
		show(302, "Andor", 12, "Ended"),
	])
	db.seed("episode", [
		episode(101, 0, 1, daysAgo(500)),
		...season(101, 6, 2),
		...season(103, 7),
		...season(108, 3),
	])
	db.seed("user_watch_state", [
		stateRow("show", 101, "watching"),
		stateRow("show", 102, "watching"),
		stateRow("show", 103, "seen"),
		stateRow("show", 104, "seen"),
		stateRow("show", 105, "seen"),
		stateRow("show", 106, "on_hold"),
		stateRow("show", 107, "dropped"),
		stateRow("show", 108, "watching"),
	])
	db.seed("user_watch_log", [
		watch(101, 1, 1, daysAgo(9)),
		watch(101, 1, 2, daysAgo(5)),
		watch(101, 1, 3, daysAgo(1)),
		...[1, 2, 3, 4].map((n) => watch(102, 1, n, daysAgo(40))),
		...[1, 2, 3, 4, 5, 6].map((n) => watch(103, 1, n, daysAgo(60))),
		...[1, 2, 3, 4, 5, 6].map((n) => watch(104, 1, n, daysAgo(20))),
		...[1, 2, 3, 4, 5].map((n) => watch(105, 1, n, daysAgo(300))),
		watch(106, 1, 1, daysAgo(90)),
		watch(107, 1, 1, daysAgo(200)),
		watch(108, 1, 1, daysAgo(3)),
		watch(108, 1, 3, daysAgo(2)),
	])
	db.seed("user_wishlist", [
		title("show", 302, daysAgo(2)),
		title("show", 301, daysAgo(30)),
		title("movie", 900, daysAgo(1)),
	])
}

test("My shows answers in the page's groups: Continue, Start, older, waiting, On hold and Dropped", async () => {
	seedShows()
	const page = await getMyShows(viewer, { now: NOW })
	const names = (rows: { title: string }[]) => rows.map((row) => row.title)
	// Watched yesterday, then two days ago; the Seen show with a new episode follows the Watching shows.
	assert.deepEqual(names(page.continue), ["Slow Horses", "Severance", "Only Murders in the Building"])
	assert.deepEqual(names(page.older), ["Shōgun"])
	assert.deepEqual(names(page.waiting), ["The White Lotus"])
	assert.deepEqual(names(page.onHold), ["Dark"])
	assert.deepEqual(names(page.dropped), ["The Idol"])
	// Best taste match first; the Wishlist's movie is not a show to start.
	assert.deepEqual(names(page.start), ["The Bear", "Andor"])
	assert.equal(page.total, 9)
})

test("a Continue row carries its Next episode from the cached episode list, and its progress from the member data", async () => {
	seedShows()
	const page = await getMyShows(viewer, { now: NOW })
	const [slow, severance, murders] = page.continue
	assert.deepEqual(
		[slow.kind, slow.watched, slow.aired, slow.left],
		["next", 3, 6, 3],
	)
	assert.deepEqual(slow.next, {
		season: 1,
		number: 4,
		name: "Episode 1.4",
		airDate: new Date(daysAgo(97)).toISOString().slice(0, 10),
		runtime: 45,
	})
	assert.equal(slow.lastActivityAt, daysAgo(1))
	// A gap: nothing aired after episode 3, so the Next episode is the earliest one not watched.
	assert.deepEqual([severance.next?.season, severance.next?.number], [1, 2])
	// A Seen show's new episode is the one after the furthest watched.
	assert.deepEqual([murders.kind, murders.left, murders.next?.number], ["seenNew", 1, 7])
	assert.equal(slow.backdrop_path, "/b101.jpg")
})

test("a show to start says what it costs and how well it fits", async () => {
	seedShows()
	const page = await getMyShows(viewer, { now: NOW })
	assert.deepEqual(page.start[0], {
		id: 301,
		title: "The Bear",
		poster_path: "/p301.jpg",
		backdrop_path: "/b301.jpg",
		match: 93,
		seasons: 2,
		episodes: 12,
		episodeMinutes: 45,
		running: true,
		service: null,
	})
	assert.equal(page.start[1].running, false)
})

test("My shows reads the catalog by key and the log only for the shows with a gap", async () => {
	seedShows()
	await getMyShows(viewer, { now: NOW })
	// One read of `show` for every tracked and wished show.
	const catalog = selects("show")
	assert.equal(catalog.length, 1)
	assert.match(catalog[0].sql, /WHERE tmdb_id IN \(/)
	assert.equal(catalog[0].params.length, 10)
	// The member data's grouped query, and one read for the show whose Next episode is in a gap.
	const log = selects("user_watch_log")
	assert.equal(log.length, 2)
	assert.match(log[0].sql, /GROUP BY tmdb_id, media_type, pass$/)
	assert.match(log[1].sql, /tmdb_id IN \(\?\)/)
	assert.deepEqual(log[1].params, [user, 108])
	// Episode lists only for the Continue rows.
	assert.deepEqual(
		selects("episode").map((s) => s.params[0]),
		[101, 108, 103],
	)
})

test("home's Continue door reads one episode list", async () => {
	seedShows()
	const page = await getMyShows(viewer, { now: NOW, episodeLists: 1 })
	assert.deepEqual(selects("episode").map((s) => s.params[0]), [101])
	assert.equal(page.continue[0].next?.number, 4)
	assert.equal(page.continue[1].next, null)
	assert.equal(selects("user_watch_log").length, 1)
})

test("a member who tracks nothing has an empty page, and the catalog is not read", async () => {
	assert.deepEqual(await getMyShows(viewer, { now: NOW }), {
		continue: [],
		start: [],
		older: [],
		waiting: [],
		onHold: [],
		dropped: [],
		total: 0,
	})
	assert.equal(selects("show").length, 0)
})

// ---------------------------------------------------------------------------------------------------------
// My library
// ---------------------------------------------------------------------------------------------------------

const movie = (id: number, name: string): Row => ({
	tmdb_id: id,
	title: name,
	poster_path: `/m${id}.jpg`,
	release_year: 1990 + (id % 30),
	runtime: 100,
})
const score = (mediaType: string, id: number, value: number): Row => ({
	...title(mediaType, id),
	score: value,
	review: null,
})

function seedLibrary() {
	db.seed("movie", [movie(10, "The Matrix"), movie(11, "Alien"), movie(12, "A Quiet Place"), movie(900, "Heat")])
	db.seed("show", [show(20, "Dark", 26, "Ended"), show(21, "Severance", 19), show(30, "Chernobyl", 5, "Ended")])
	db.seed("user_watch_state", [
		stateRow("movie", 10, "seen"),
		stateRow("movie", 11, "seen"),
		stateRow("movie", 12, "seen"),
		stateRow("show", 20, "seen"),
		stateRow("show", 21, "watching"),
	])
	db.seed("user_watch_log", [
		movieWatch(10, daysAgo(7)),
		movieWatch(11, daysAgo(900)),
		movieWatch(11, daysAgo(30)),
		movieWatch(12, null, { origin: "import" }),
		...[1, 2, 3].map((n) => watch(20, 1, n, daysAgo(400))),
		...[1, 2, 3, 4].map((n) => watch(21, 1, n, daysAgo(2))),
	])
	db.seed("user_score", [score("movie", 10, 9), score("movie", 12, 7), score("show", 30, 8)])
	db.seed("user_wishlist", [title("movie", 900)])
}
const seen = { status: "seen" as const, sort: null, kind: "all" as const, q: "" }

test("the library answers every status's count and one step of the chosen list", async () => {
	seedLibrary()
	const page = await getLibraryPage(user, seen)
	assert.deepEqual(page.counts, { want: 1, seen: 5, watching: 1, on_hold: 0, dropped: 0, unrated: 2 })
	assert.equal(page.sort, "last")
	assert.deepEqual(
		page.items.map((item) => item.title),
		["The Matrix", "Alien", "Dark", "A Quiet Place", "Chernobyl"],
	)
	assert.deepEqual(page.kinds, { all: 5, movie: 3, show: 2 })
	assert.deepEqual([page.total, page.next, page.left], [5, null, 0])
})

test("a Seen item carries the last watch, the number of watches and the member's score", async () => {
	seedLibrary()
	const page = await getLibraryPage(user, seen)
	const alien = page.items[1]
	assert.deepEqual(alien, {
		key: "movie-11",
		mediaType: "movie",
		tmdbId: 11,
		title: "Alien",
		poster_path: "/m11.jpg",
		release_year: 2001,
		score: null,
		state: "seen",
		watchedAt: new Date(daysAgo(30)).toISOString(),
		watches: 2,
		addedAt: null,
		episodesWatched: null,
		airedEpisodes: null,
	})
	// An imported watch without a date stays without one.
	assert.equal(page.items[3].watchedAt, null)
	// A rated show without a state: no watch, the score.
	assert.deepEqual(
		[page.items[4].state, page.items[4].watches, page.items[4].score],
		[null, 0, 8],
	)
})

test("a show in progress carries its progress against the aired count", async () => {
	seedLibrary()
	const page = await getLibraryPage(user, { ...seen, status: "watching" })
	assert.deepEqual(
		page.items.map((item) => [item.title, item.episodesWatched, item.airedEpisodes]),
		[["Severance", 4, 19]],
	)
})

test("Not rated, My score, the kind filter and the search narrow and order the list", async () => {
	seedLibrary()
	const names = async (choice: Record<string, unknown>) =>
		(await getLibraryPage(user, { ...seen, ...choice } as never)).items.map((item) => item.title)
	assert.deepEqual(await names({ status: "unrated" }), ["Alien", "Dark"])
	assert.deepEqual(await names({ sort: "score" }), ["The Matrix", "Chernobyl", "A Quiet Place", "Alien", "Dark"])
	assert.deepEqual(await names({ sort: "title" }), ["Alien", "Chernobyl", "Dark", "The Matrix", "A Quiet Place"])
	assert.deepEqual(await names({ kind: "show" }), ["Dark", "Chernobyl"])
	assert.deepEqual(await names({ q: "qui" }), ["A Quiet Place"])
	assert.deepEqual(await names({ status: "want" }), ["Heat"])
})

test("the library reads no watch log beyond the member data, and titles only for the Title sort or a search", async () => {
	seedLibrary()
	await getLibraryPage(user, seen)
	await getLibraryPage(user, { ...seen, sort: "score" })
	// The member data is cached: its grouped query ran once, and nothing else read the log.
	assert.equal(selects("user_watch_log").length, 1)
	// Two steps, each one read of `movie` and one of `show` for its cards.
	assert.equal(selects("movie").length, 2)
	assert.ok(selects("movie").every((s) => /^SELECT tmdb_id, title, poster_path, release_year FROM movie/.test(s.sql)))
	await getLibraryPage(user, { ...seen, sort: "title" })
	assert.equal(selects("movie").filter((s) => s.sql.startsWith("SELECT tmdb_id, title FROM")).length, 1)
	// The titles are kept: a search right after reads only its cards.
	await getLibraryPage(user, { ...seen, q: "matrix" })
	assert.equal(selects("movie").filter((s) => s.sql.startsWith("SELECT tmdb_id, title FROM")).length, 1)
})

test("1,500 Seen titles are answered in steps of 60, each reading only its own cards", async () => {
	const ids = Array.from({ length: 1500 }, (_, i) => i + 1)
	db.seed("movie", ids.map((id) => movie(id, `Movie ${String(id).padStart(4, "0")}`)))
	db.seed("user_watch_state", ids.map((id) => stateRow("movie", id, "seen")))
	db.seed("user_watch_log", ids.map((id) => movieWatch(id, daysAgo(id))))
	const first = await getLibraryPage(user, seen)
	assert.equal(first.counts.seen, 1500)
	assert.equal(first.counts.unrated, 1500)
	assert.deepEqual([first.items.length, first.total, first.next, first.left], [60, 1500, 60, 1440])
	assert.equal(first.items[0].title, "Movie 0001")
	const cards = selects("movie")
	assert.equal(cards.length, 1)
	assert.equal(cards[0].params.length, 60)
	const last = await getLibraryPage(user, seen, 1440)
	assert.deepEqual([last.items.length, last.next, last.left], [60, null, 0])
	assert.equal(last.items[59].title, "Movie 1500")
	assert.equal(selects("user_watch_log").length, 1)
})

// ---------------------------------------------------------------------------------------------------------
// My movies: Watch next's plan for the Wishlist's movies, with "How long?"
// ---------------------------------------------------------------------------------------------------------

const { planWatchNext } = await import("./watch-next.server.ts")
const M = 1_000_000_000_000
const S = 2_000_000_000_000
const facts = (value: number) => ({ releaseDay: 19_000, score: value, popularity: 10 })
/** Four movies and a show on the Wishlist; Top rated orders the movies 1, 2, 3, 4, after the show. */
const wishCtx = () =>
	({
		viewer: { kind: "member", userId: user },
		country: "US",
		services: [],
		seen: new Set(),
		ratings: new Map(),
		wishlist: new Map(
			[M + 1, M + 2, M + 3, M + 4, S + 9].map((key) => [key, new Date(daysAgo(5))]),
		),
		skipped: new Set(),
		notInterested: new Set(),
		hidden: new Set(),
		forYou: true,
	}) as never
const OUTSIDE = new Map([
	[M + 1, facts(90)],
	[M + 2, facts(80)],
	[M + 3, facts(70)],
	[M + 4, facts(60)],
	[S + 9, facts(99)],
])
const RUNTIMES = new Map<number, number | null>([
	[M + 1, 155],
	[M + 2, 95],
	[M + 3, 121],
	[M + 4, null],
])
const tiersOf = (plan: { tiers: { key: string; keys: number[] }[] }) =>
	Object.fromEntries(plan.tiers.map((tier) => [tier.key, tier.keys.map((key) => key - M)]))

test("My movies plans only the Wishlist's movies; Watch next keeps the shows", () => {
	const all = planWatchNext(wishCtx(), taste as never, { sort: "top" }, OUTSIDE)
	assert.equal(all.total, 5)
	assert.equal(all.head[0].key, S + 9)
	const movies = planWatchNext(wishCtx(), taste as never, { sort: "top", kind: "movie" }, OUTSIDE)
	assert.equal(movies.total, 4)
	assert.deepEqual(movies.head.map((e) => e.key - M), [1, 2, 3, 4])
	assert.equal(movies.time, null)
})

test("a movie that runs over the time goes to Not tonight's fit, the least over first", () => {
	const plan = planWatchNext(
		wishCtx(),
		taste as never,
		{ sort: "top", kind: "movie", time: 120 },
		OUTSIDE,
		RUNTIMES,
	)
	// 95 minutes fits, and so does the movie without a known runtime. 121 runs 1 over, 155 runs 35 over.
	assert.deepEqual(plan.head.map((e) => e.key - M), [2, 4])
	assert.equal(plan.fitting, 2)
	assert.deepEqual(tiersOf(plan), { notTonightsFit: [3, 1] })
	assert.deepEqual(
		[plan.entries.get(M + 3)?.over, plan.entries.get(M + 1)?.over, plan.entries.get(M + 2)?.over],
		[1, 35, 0],
	)
	assert.equal(plan.heroNote, null)
})

test("when every movie runs over, the hero is the one that runs over the least, and says so", () => {
	const plan = planWatchNext(
		wishCtx(),
		taste as never,
		{ sort: "top", kind: "movie", time: 90 },
		OUTSIDE,
		new Map([
			[M + 1, 155],
			[M + 2, 95],
			[M + 3, 121],
			[M + 4, 200],
		]),
	)
	assert.equal(plan.fitting, 0)
	assert.equal(plan.heroNote, "nothingInTime")
	assert.deepEqual(plan.head.map((e) => e.key - M), [2, 3, 1, 4])
})

test("Watch next ignores a time: the choice belongs to My movies", () => {
	const plan = planWatchNext(wishCtx(), taste as never, { sort: "top", time: 90 }, OUTSIDE, RUNTIMES)
	assert.equal(plan.total, 5)
	assert.equal(plan.fitting, 5)
	assert.deepEqual(Object.keys(tiersOf(plan)), ["upNext"])
})
