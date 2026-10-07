// The show page's tracking endpoints (#384): what a member's show page reads, and the actions it sends. Against the
// in-memory Crate of the tracking tests.

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

// The same stubs as tracking.test.ts, and an auth that answers with whoever the test signs in.
const session: { user: string | null } = { user: null }
;(globalThis as Record<string, unknown>).__gwShowTrackingSession = session
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
		// The Wishlist's writer resets caches whose keys live in two route files. Routes are `.tsx`, which Node can't
		// strip types from, so only the keys are kept.
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
				"export const getUserIdFromRequest = async () => globalThis.__gwShowTrackingSession.user; export const getAuthFromRequest = getUserIdFromRequest"
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
const { getShowTrackingPage, applyShowTrackingAction, parseShowAction } =
	await import("./show-tracking.server.ts")
const route = await import("../routes/api.tracking.show.ts")
type EpisodeGrid = import("./episode-grid.server.ts").EpisodeGrid

class Redis extends CacheTestRedis {
	async set(key: string, value: string) {
		this.values.set(key, value)
	}
}

type Row = Record<string, unknown>
let db: FakeTrackingCrate
const user = "member-A"

const DAY = 86_400_000
const midnight = (offsetDays: number) =>
	Math.floor(Date.now() / DAY) * DAY + offsetDays * DAY
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const LONG_AGO = Date.UTC(2020, 0, 1)
const SHOW = 1399
const UNLISTED = 4242

const episode = (
	id: number,
	season: number,
	number: number,
	name: string,
	airDate: number | null,
): Row => ({
	show_id: SHOW,
	tmdb_id: id,
	season_number: season,
	episode_number: number,
	name,
	air_date: airDate,
	runtime: 45,
	still_path: `/still-${id}.jpg`,
	episode_type: "standard",
	removed_at: null,
})

/** A special, three aired episodes of season 1, one of season 2 that aired and one that airs tomorrow. */
beforeEach(() => {
	db = new FakeTrackingCrate()
	setCrateClientForTest(db)
	setRedisClusterForTest(new Redis())
	resetPendingResetsForTest()
	session.user = user
	process.env.REC_TRACKING = "on"
	db.seed("episode", [
		episode(100, 0, 1, "Making Of", LONG_AGO),
		episode(101, 1, 1, "Pilot", LONG_AGO),
		episode(102, 1, 2, "Second", LONG_AGO),
		episode(103, 1, 3, "Third", LONG_AGO),
		episode(201, 2, 1, "Return", LONG_AGO),
		episode(202, 2, 2, "Tomorrow", midnight(1)),
	])
	db.seed("show", [{ tmdb_id: SHOW, status: "Returning Series" }])
})
afterEach(() => {
	setCrateClientForTest(null)
	setRedisClusterForTest(null)
	resetPendingResetsForTest()
	process.env.REC_TRACKING = ""
})

const none = {
	imdb: null,
	tmdb: null,
	tomatometer: null,
	popcornmeter: null,
	metascore: null,
	metacriticUser: null,
}
/** IMDb lists season 1's second and third episode the other way round, and has no season 2. */
const grid = async (): Promise<EpisodeGrid> => ({
	showId: SHOW,
	seasons: [
		{
			number: 1,
			episodes: [
				{ number: 1, name: "Pilot", score: 8.6, votes: 900 },
				{ number: 2, name: "Third", score: 7.1, votes: 800 },
				{ number: 3, name: "Second", score: 9.3, votes: 700 },
			],
			maxEpisodeNumber: 3,
			scores: { ...none, imdb: { score: 8.4, count: 2400 } },
		},
	],
	specials: [],
	maxEpisodeNumber: 3,
	hasEpisodeZero: false,
	providers: ["imdb"],
})
const noGrid = async () => null

let made = 0
const newId = () => `act-${String(++made).padStart(6, "0")}`
const act = (body: Row, showId = SHOW) => {
	const parsed = parseShowAction({ id: showId, ...body })
	assert.ok(parsed, `the action is well formed: ${JSON.stringify(body)}`)
	return applyShowTrackingAction(user, parsed)
}
const tick = (season: number, number: number, actionId = newId()) =>
	act({ event: { type: "watch", season, number }, actionId })
const titleRow = (rest: Row = {}): Row => ({
	user_id: user,
	tmdb_id: SHOW,
	media_type: "show",
	created_at: 1_000,
	updated_at: 2_000,
	...rest,
})
const onWishlist = () =>
	db.table("user_wishlist").find((r) => r.tmdb_id === SHOW) ?? null
const stateOf = () => db.state(user, "show", SHOW)?.state ?? null

// ---------------------------------------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------------------------------------

test("the read gives the state row, the log rows, and the episode list with air dates and matched ratings", async () => {
	await tick(1, 1, "watch-000001")
	const page = await getShowTrackingPage(user, SHOW, grid)
	assert.equal(page.state?.state, "watching")
	assert.deepEqual(
		page.log.map((r) => [
			r.watch_id,
			r.season_number,
			r.episode_number,
			r.pass,
		]),
		[["watch-000001", 1, 1, 1]],
	)
	assert.deepEqual(
		page.episodes.map((e) => [
			e.id,
			e.season,
			e.number,
			e.name,
			e.airDate,
			e.rating,
			e.ratedBy,
		]),
		[
			[100, 0, 1, "Making Of", "2020-01-01", null, null],
			[101, 1, 1, "Pilot", "2020-01-01", 8.6, "number"],
			[102, 1, 2, "Second", "2020-01-01", 9.3, "title"],
			[103, 1, 3, "Third", "2020-01-01", 7.1, "title"],
			[201, 2, 1, "Return", "2020-01-01", null, null],
			[202, 2, 2, "Tomorrow", iso(midnight(1)), null, null],
		],
	)
	assert.deepEqual(
		[
			page.episodes[1].still,
			page.episodes[1].runtime,
			page.episodes[1].overview,
		],
		["/still-101.jpg", 45, null],
	)
	assert.equal(page.running, true)
	assert.deepEqual(page.seasonScores, { "1": 8.4 })
	assert.deepEqual(page.notes, { "1": { byTitle: 2, missing: 0 } })
})

test("the read of a show the member never touched has no row and no watch, and an ended show is not running", async () => {
	db.seed("show", [{ tmdb_id: 77, status: "Ended" }])
	const page = await getShowTrackingPage(user, 77, noGrid)
	assert.deepEqual(page, {
		state: null,
		log: [],
		episodes: [],
		running: false,
		seasonScores: {},
		notes: {},
	})
	assert.equal(
		(await getShowTrackingPage(user, UNLISTED, noGrid)).running,
		false,
	)
})

test("the read still answers when the ratings can't be read: the episodes have none", async () => {
	const errors: unknown[][] = []
	const original = console.error
	console.error = (...args: unknown[]) => errors.push(args)
	try {
		const page = await getShowTrackingPage(user, SHOW, async () => {
			throw new Error("the grid is down")
		})
		assert.equal(page.episodes.length, 6)
		assert.ok(page.episodes.every((e) => e.rating === null))
		assert.equal(errors.length, 1)
	} finally {
		console.error = original
	}
})

test("the read is one member's: another member's watches are not in it", async () => {
	await tick(1, 1)
	const page = await getShowTrackingPage("member-B", SHOW, noGrid)
	assert.deepEqual([page.state, page.log], [null, []])
})

// ---------------------------------------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------------------------------------

test("a tick answers with the new row, the stored log row, and what an Undo has to put back", async () => {
	db.seed("user_wishlist", [titleRow()])
	const answer = await tick(1, 1, "watch-000001")
	assert.equal(answer.status, "applied")
	assert.equal(answer.state?.state, "watching")
	assert.deepEqual(
		answer.rows.map((r) => [
			r.watch_id,
			r.episode_tmdb_id,
			r.origin,
			r.watched_at_precision,
		]),
		[["watch-000001", 101, "single", "moment"]],
	)
	assert.deepEqual(answer.deleted, [])
	assert.deepEqual(answer.cleared, {
		wantToSeeAddedAt: new Date(1_000).toISOString(),
		notInterested: false,
	})
	assert.equal(onWishlist(), null)
})

test("Undo of a first tick takes the watch away and puts Want to See back in its place", async () => {
	db.seed("user_wishlist", [titleRow()])
	const { cleared } = await tick(1, 1, "watch-000001")
	const undone = await act({
		event: { type: "deleteWatch", watchId: "watch-000001" },
		restore: { wantToSeeAddedAt: cleared.wantToSeeAddedAt },
	})
	assert.deepEqual(
		[undone.status, undone.state, undone.deleted],
		["applied", null, ["watch-000001"]],
	)
	assert.equal(onWishlist()?.created_at, 1_000)
})

test("Undo puts nothing back on the Wishlist while the show is still started", async () => {
	await tick(1, 1)
	await tick(1, 2, "watch-000002")
	const undone = await act({
		event: { type: "deleteWatch", watchId: "watch-000002" },
		restore: {
			wantToSeeAddedAt: new Date(1_000).toISOString(),
			notInterested: true,
		},
	})
	assert.equal(undone.state?.state, "watching")
	assert.equal(onWishlist(), null)
	assert.equal(db.table("user_not_interested").length, 0)
})

test("Undo of a first tick puts Not interested back", async () => {
	db.seed("user_not_interested", [titleRow()])
	const { cleared } = await tick(1, 1, "watch-000001")
	assert.equal(cleared.notInterested, true)
	await act({
		event: { type: "deleteWatch", watchId: "watch-000001" },
		restore: { notInterested: true },
	})
	assert.equal(db.table("user_not_interested").length, 1)
})

test("Mark season answers with the group's rows, and Set a date with the rows it changed and the standing row", async () => {
	const group = "group-000001"
	const marked = await act({
		event: { type: "markSeason", season: 1, today: iso(midnight(0)) },
		actionId: group,
	})
	assert.equal(marked.state?.state, "watching")
	assert.deepEqual(
		marked.rows
			.map((r) => [r.episode_tmdb_id, r.origin, r.group_id, r.watched_at])
			.sort(),
		[
			[101, "season", group, null],
			[102, "season", group, null],
			[103, "season", group, null],
		],
	)
	const dated = await act({
		event: { type: "setGroupDate", group, day: "2026-10-01" },
	})
	assert.equal(dated.status, "applied")
	assert.equal(
		dated.state?.state,
		"watching",
		"a date changes no state, and the answer still carries the row",
	)
	assert.deepEqual(
		dated.rows.map((r) => [r.watched_at, r.watched_at_precision]),
		Array(3).fill([Date.UTC(2026, 9, 1), "day"]),
	)
	const undone = await act({ event: { type: "undoGroup", group } })
	assert.deepEqual(
		[undone.state, undone.deleted.length, undone.rows],
		[null, 3, []],
	)
})

test("a date set on one watch answers with that row", async () => {
	await tick(1, 1, "watch-000001")
	const answer = await act({
		event: {
			type: "editWatchDate",
			watchId: "watch-000001",
			when: { precision: "unknown" },
		},
	})
	assert.deepEqual(
		answer.rows.map((r) => [r.watch_id, r.watched_at, r.watched_at_precision]),
		[["watch-000001", null, "unknown"]],
	)
	assert.equal(answer.state?.state, "watching")
})

test("the device's date decides a group action for an episode that airs tomorrow by UTC", async () => {
	const answer = await act({
		event: { type: "pressSeen", today: iso(midnight(1)) },
		actionId: "press-000001",
	})
	assert.equal(
		answer.rows.length,
		5,
		"the four aired regular episodes and tomorrow's",
	)
	assert.equal(answer.state?.seen_press_group, "press-000001")
})

test("Watch again starts the next pass and keeps the watches of the first", async () => {
	await act({ event: { type: "pressSeen" }, actionId: "press-000001" })
	const again = await act({ event: { type: "watchAgain" } })
	assert.deepEqual(
		[again.state?.state, again.state?.pass, again.rows, again.deleted],
		["watching", 2, [], []],
	)
	const next = await tick(1, 1, "watch-000002")
	assert.deepEqual(
		next.rows.map((r) => r.pass),
		[2],
	)
	const page = await getShowTrackingPage(user, SHOW, noGrid)
	assert.deepEqual(
		page.log
			.filter((r) => r.episode_tmdb_id === 101)
			.map((r) => [r.pass, r.origin])
			.sort(),
		[
			[1, "seen"],
			[2, "single"],
		],
	)
})

test("Want to See on a Dropped show with nothing watched makes it Not started and puts it on the Wishlist", async () => {
	await tick(1, 1, "watch-000001")
	await act({ event: { type: "drop" } })
	await act({ event: { type: "unwatch", season: 1, number: 1 } })
	assert.equal(stateOf(), "dropped")
	const answer = await act({ event: { type: "wantToSee", on: true } })
	assert.deepEqual([answer.status, answer.state], ["applied", null])
	assert.ok(onWishlist())
})

test("Want to See on a show that is being watched is refused and adds nothing", async () => {
	await tick(1, 1)
	const answer = await act({ event: { type: "wantToSee", on: true } })
	assert.equal(answer.status, "refused")
	assert.match(answer.refused ?? "", /Watching/)
	assert.equal(
		answer.state?.state,
		"watching",
		"a refusal still says where the show stands",
	)
	assert.equal(onWishlist(), null)
})

test("the writer's rules for ids hold: an id that names a group's watch is refused", async () => {
	const answer = await act({
		event: { type: "watch", season: 1, number: 1 },
		actionId: "g-abcdefgh-101",
	})
	assert.deepEqual([answer.status, answer.rows], ["refused", []])
	assert.equal(db.log(user).length, 0)
})

test("a request that is not an action of the show page is not read", () => {
	const bad: unknown[] = [
		null,
		{},
		{ id: SHOW },
		{ id: 0, event: { type: "hold" } },
		{ id: 1.5, event: { type: "hold" } },
		{ id: SHOW, event: { type: "rate", score: 9 } },
		{ id: SHOW, event: { type: "notInterested", on: true } },
		{ id: SHOW, event: { type: "wantToSee", on: false } },
		{
			id: SHOW,
			event: { type: "watch", season: -1, number: 1 },
			actionId: "watch-000001",
		},
		{
			id: SHOW,
			event: { type: "watch", season: 1, number: 1.5 },
			actionId: "watch-000001",
		},
		{ id: SHOW, event: { type: "watch", season: 1, number: 1 } },
		{
			id: SHOW,
			event: { type: "watch", season: 1, number: 1 },
			actionId: "short",
		},
		{
			id: SHOW,
			event: {
				type: "watch",
				season: 1,
				number: 1,
				when: { precision: "day", day: "2026-13-40" },
			},
			actionId: "watch-000001",
		},
		{
			id: SHOW,
			event: { type: "markSeason", season: 1, today: "tomorrow" },
			actionId: "group-000001",
		},
		{
			id: SHOW,
			event: { type: "setGroupDate", group: "group-000001", day: "soon" },
		},
		{
			id: SHOW,
			event: {
				type: "editWatchDate",
				watchId: "watch-000001",
				when: { precision: "moment" },
			},
		},
		{ id: SHOW, event: { type: "answerSeenQuestion", answer: "yes" } },
		{
			id: SHOW,
			event: { type: "hold" },
			restore: { wantToSeeAddedAt: "yesterday" },
		},
	]
	for (const body of bad)
		assert.equal(parseShowAction(body), null, JSON.stringify(body))
	assert.deepEqual(
		parseShowAction({
			id: SHOW,
			event: {
				type: "watch",
				season: 1,
				number: 1,
				when: { precision: "day", day: "2026-10-01" },
				extra: 1,
			},
			actionId: "watch-000001",
		}),
		{
			id: SHOW,
			event: {
				type: "watch",
				season: 1,
				number: 1,
				when: { precision: "day", day: "2026-10-01" },
			},
			actionId: "watch-000001",
		},
	)
})

// ---------------------------------------------------------------------------------------------------------
// The routes
// ---------------------------------------------------------------------------------------------------------

const get = (search: string) =>
	route.loader({
		request: new Request(`https://goodwatch.app/api/tracking/show${search}`),
		params: {},
		context: {},
	}) as Promise<Response>
const post = (body: unknown, method = "POST") =>
	route.action({
		request: new Request("https://goodwatch.app/api/tracking/show", {
			method,
			body: method === "GET" ? undefined : JSON.stringify(body),
		}),
		params: {},
		context: {},
	}) as Promise<Response>
const tickBody = {
	id: SHOW,
	event: { type: "watch", season: 1, number: 1 },
	actionId: "watch-000001",
}

test("both endpoints are not found while the flag is off, and for a member outside the preview", async () => {
	process.env.REC_TRACKING = "off"
	assert.equal((await get(`?id=${SHOW}`)).status, 404)
	assert.equal((await post(tickBody)).status, 404)
	process.env.REC_TRACKING = "preview"
	process.env.REC_PREVIEW_USERS = "someone-else"
	assert.equal((await get(`?id=${SHOW}`)).status, 404)
	assert.equal((await post(tickBody)).status, 404)
	process.env.REC_PREVIEW_USERS = user
	assert.equal((await get(`?id=${SHOW}`)).status, 200)
	process.env.REC_PREVIEW_USERS = ""
	assert.equal(db.log(user).length, 0)
})

test("both endpoints are for members: a visitor gets 401 and nothing is written", async () => {
	session.user = null
	const read = await get(`?id=${SHOW}`)
	assert.equal(read.status, 401)
	assert.equal(read.headers.get("Cache-Control"), "private, no-store")
	assert.equal((await post(tickBody)).status, 401)
	assert.equal(db.table("user_watch_log").length, 0)
})

test("the read endpoint answers a member privately, and refuses an id that is not a show's", async () => {
	db.seed("imdb_episode", [
		{
			show_id: SHOW,
			imdb_episode_id: "tt0000101",
			season_number: 1,
			episode_number: 1,
			name: "Pilot",
			imdb_user_score_original: 8.6,
			imdb_user_score_rating_count: 900,
		},
	])
	const response = await get(`?id=${SHOW}`)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	const page = await response.json()
	assert.equal(page.episodes.length, 6)
	assert.deepEqual([page.state, page.log, page.running], [null, [], true])
	assert.deepEqual(
		page.episodes.map((e: { rating: number | null }) => e.rating),
		[null, 8.6, null, null, null, null],
		"the ratings come from the episode grid's tables",
	)
	for (const search of ["", "?id=abc", "?id=0", "?id=1.5", "?id=-3"])
		assert.equal((await get(search)).status, 400, search)
})

test("the action endpoint applies a member's action privately, and refuses what it can't read", async () => {
	const response = await post(tickBody)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	const answer = await response.json()
	assert.deepEqual(
		[answer.status, answer.state.state, answer.rows.length],
		["applied", "watching", 1],
	)
	assert.equal(db.log(user).length, 1)
	assert.equal(
		(await post({ id: SHOW, event: { type: "rate", score: 3 } })).status,
		400,
	)
	assert.equal((await post(tickBody, "PUT")).status, 405)
	const refused = await post({ id: SHOW, event: { type: "hold" } })
	const twice = await post({ id: SHOW, event: { type: "hold" } })
	assert.deepEqual(
		[
			refused.status,
			(await refused.json()).status,
			twice.status,
			(await twice.json()).status,
		],
		[200, "applied", 200, "refused"],
	)
})
