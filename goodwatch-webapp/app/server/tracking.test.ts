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

// The writer reaches the taste store through `markTasteChanged`, whose module pulls in the viewer and with it auth,
// and reads the title snapshot, whose index the alias hook replaces by the format module without
// `getTitleSnapshot`. The same stubs as userData.test.ts.
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
		if (url.endsWith("/utils/auth.ts"))
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
const { setRedisClusterForTest, resetPendingResetsForTest, cacheEntryKey } =
	await import("../utils/cache.ts")
const {
	TrackingConflictError,
	applyTrackingEvent,
	getEpisodeList,
	getMovieTracking,
	getShowTracking,
	getWatchState,
	getWatchTotals,
	settleMovie,
} = await import("./tracking.server.ts")
type TrackingAction = import("./tracking.server.ts").TrackingAction
type TrackedTitle = import("./tracking.server.ts").TrackedTitle
type RestoredWatch = import("./tracking.server.ts").RestoredWatch

class Redis extends CacheTestRedis {
	async set(key: string, value: string) {
		this.values.set(key, value)
	}
}

type Row = Record<string, unknown>
let db: FakeTrackingCrate
let redis: Redis
const user = "member-A"

// ---------------------------------------------------------------------------------------------------------
// The catalog of the tests. Aired is relative to today, as the writer reads the clock.
// ---------------------------------------------------------------------------------------------------------

const DAY = 86_400_000
const midnight = (offsetDays: number) =>
	Math.floor(Date.now() / DAY) * DAY + offsetDays * DAY
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const LONG_AGO = Date.UTC(2020, 0, 1)

const SHOW = 1399
const SHORT = 66732
const LONG = 1622
const MOVIE = 603
const show: TrackedTitle = { mediaType: "show", tmdbId: SHOW }
const short: TrackedTitle = { mediaType: "show", tmdbId: SHORT }
const movie: TrackedTitle = { mediaType: "movie", tmdbId: MOVIE }

const episode = (
	showId: number,
	id: number,
	season: number,
	number: number,
	airDate: number | null,
): Row => ({
	show_id: showId,
	tmdb_id: id,
	season_number: season,
	episode_number: number,
	name: `S${season} E${number}`,
	air_date: airDate,
	runtime: 45,
	still_path: null,
	episode_type: "standard",
	// As the catalog stores an episode it has no description of.
	overview: null,
	removed_at: null,
})

/**
 * SHOW: one special, three episodes of season 1 and two of season 2 aired (five regular), S2 E3 airs tomorrow,
 * S2 E4 the day after, S2 E5 has no date, and one episode TMDB removed. SHORT: a special and two aired episodes.
 */
function fresh() {
	db = new FakeTrackingCrate()
	redis = new Redis()
	setCrateClientForTest(db)
	setRedisClusterForTest(redis)
	resetPendingResetsForTest()
	made = 0
	db.seed("episode", [
		episode(SHOW, 100, 0, 1, LONG_AGO),
		episode(SHOW, 101, 1, 1, LONG_AGO),
		episode(SHOW, 102, 1, 2, LONG_AGO),
		episode(SHOW, 103, 1, 3, LONG_AGO),
		episode(SHOW, 201, 2, 1, LONG_AGO),
		episode(SHOW, 202, 2, 2, midnight(0)),
		episode(SHOW, 203, 2, 3, midnight(1)),
		episode(SHOW, 204, 2, 4, midnight(2)),
		episode(SHOW, 205, 2, 5, null),
		{ ...episode(SHOW, 199, 1, 9, LONG_AGO), removed_at: LONG_AGO },
		episode(SHORT, 300, 0, 1, LONG_AGO),
		episode(SHORT, 301, 1, 1, LONG_AGO),
		episode(SHORT, 302, 1, 2, LONG_AGO),
	])
}

beforeEach(fresh)
afterEach(() => {
	setCrateClientForTest(null)
	setRedisClusterForTest(null)
	resetPendingResetsForTest()
})

/** A new episode appears in the catalog, and the cached list is forgotten. */
function airs(row: Row) {
	db.seed("episode", [row])
	for (const key of [...redis.values.keys()])
		if (key.includes("tracking-episode-list")) redis.values.delete(key)
}

// ---------------------------------------------------------------------------------------------------------
// Acting and looking
// ---------------------------------------------------------------------------------------------------------

let made = 0
/** An id as the browser would make it. */
const newId = () => `act-${String(++made).padStart(6, "0")}`

const act = (event: TrackingAction, actionId = newId(), title = show) =>
	applyTrackingEvent(user, title, event, actionId)
const tick = (
	season: number,
	number: number,
	actionId = newId(),
	title = show,
) => act({ type: "watch", season, number }, actionId, title)

const stateOf = (title: TrackedTitle = show) =>
	db.state(user, title.mediaType, title.tmdbId)
const logOf = (title: TrackedTitle = show) =>
	db
		.log(user)
		.filter(
			(r) => r.media_type === title.mediaType && r.tmdb_id === title.tmdbId,
		)
const ticks = (title: TrackedTitle = show) =>
	logOf(title)
		.map((r) => `${r.season_number}.${r.episode_number}`)
		.sort()
const titleRow = (title: TrackedTitle, rest: Row = {}): Row => ({
	user_id: user,
	tmdb_id: title.tmdbId,
	media_type: title.mediaType,
	created_at: 1_000,
	updated_at: 2_000,
	...rest,
})
const onWishlist = (title: TrackedTitle = show) =>
	db
		.table("user_wishlist")
		.some((r) => r.tmdb_id === title.tmdbId && r.media_type === title.mediaType)
const notInterested = (title: TrackedTitle = show) =>
	db
		.table("user_not_interested")
		.some((r) => r.tmdb_id === title.tmdbId && r.media_type === title.mediaType)
function wantAndNotInterested(title: TrackedTitle = show) {
	db.seed("user_wishlist", [titleRow(title)])
	db.seed("user_not_interested", [titleRow(title)])
}
const userDataKey = cacheEntryKey("user-data-v2", { user_id: user })
const resets = () =>
	redis.calls.filter(
		(c) => c.command === "gwCacheReset" && c.args[0] === userDataKey,
	).length
const tasteTouched = () => redis.values.has(`taste:touched:${user}`)

/** The statements one action sent, as "INSERT user_watch_log" and the like. */
async function sentBy<T>(run: () => Promise<T>): Promise<[T, string[]]> {
	const from = db.statements.length
	const result = await run()
	const sent = db.statements.slice(from)
	db.statements = [...db.statements.slice(0, from), ...sent]
	const all = db.sent("INSERT", "UPDATE", "DELETE", "SELECT", "REFRESH")
	return [result, all.slice(all.length - sent.length)]
}
const writes = (sent: string[]) =>
	sent.filter((s) => /^(INSERT|UPDATE|DELETE)/.test(s))

/** Everything stored for the member, with the times a run can't repeat replaced by whether they are set. */
function stored() {
	const set = (value: unknown) => (value === null ? null : "set")
	return {
		log: db
			.log(user)
			.map((r) => ({
				...r,
				watched_at: r.watched_at_precision === "moment" ? "now" : r.watched_at,
				created_at: "set",
				updated_at: "set",
			}))
			.sort((a, b) => a.watch_id.localeCompare(b.watch_id)),
		states: db
			.table("user_watch_state")
			.map(({ _seq_no, _primary_term, ...r }): Row => ({
				...r,
				state_changed_at: "set",
				rate_prompt_dismissed_at: set(r.rate_prompt_dismissed_at),
				created_at: "set",
				updated_at: "set",
			}))
			.sort((a, b) => Number(a.tmdb_id) - Number(b.tmdb_id)),
		wishlist: db.table("user_wishlist").map((r) => r.tmdb_id),
		notInterested: db.table("user_not_interested").map((r) => r.tmdb_id),
	}
}

// ---------------------------------------------------------------------------------------------------------
// The steps, in order
// ---------------------------------------------------------------------------------------------------------

test("the first tick: refresh, read, the log row, the state row, the clears, the reset, in that order", async () => {
	db.seed("user_wishlist", [titleRow(show)])
	const before = Date.now()
	const [result, sent] = await sentBy(() =>
		tick(1, 1, "0193f6a2-7c1e-7b3a-9d44-5e0c1a2b3c4d"),
	)
	assert.deepEqual(sent, [
		// 1
		"REFRESH TABLE user_watch_log",
		// 2
		"SELECT user_watch_state",
		"SELECT user_watch_log",
		"SELECT episode",
		// 4
		"INSERT user_watch_log",
		// 5
		"INSERT user_watch_state",
		// 6
		"SELECT user_wishlist",
		"DELETE user_wishlist",
		"SELECT user_not_interested",
		// 7
		"REFRESH TABLE user_not_interested",
		"REFRESH TABLE user_score, user_wishlist, user_watch_log, user_watch_state, user_favorite, user_skipped",
	])
	assert.equal(resets(), 1)
	assert.equal(tasteTouched(), true, "a Want to See row went")
	const [row] = logOf()
	assert.deepEqual(
		{ ...row, watched_at: null, created_at: null, updated_at: null },
		{
			user_id: user,
			watch_id: "0193f6a2-7c1e-7b3a-9d44-5e0c1a2b3c4d",
			media_type: "show",
			tmdb_id: SHOW,
			episode_tmdb_id: 101,
			season_number: 1,
			episode_number: 1,
			watched_at: null,
			watched_at_precision: "moment",
			origin: "single",
			group_id: null,
			import_id: null,
			pass: 1,
			created_at: null,
			updated_at: null,
		},
	)
	const at = row.watched_at as number
	assert.ok(at >= before && at <= Date.now())
	assert.deepEqual([row.created_at, row.updated_at], [at, at])
	assert.deepEqual(result, {
		status: "applied",
		refused: null,
		state: {
			state: "watching",
			state_changed_at: at,
			pass: 1,
			seen_press_group: null,
			seen_press_from: null,
			rate_prompt_dismissed_at: null,
			seen_question: null,
		},
		row: "3",
		inserted: ["0193f6a2-7c1e-7b3a-9d44-5e0c1a2b3c4d"],
		deleted: [],
		cleared: {
			wantToSeeAddedAt: new Date(1_000).toISOString(),
			notInterested: false,
		},
	})
	assert.deepEqual(stateOf(), {
		user_id: user,
		tmdb_id: SHOW,
		media_type: "show",
		...result.state,
		created_at: at,
		updated_at: at,
	})
})

test("a refused action writes nothing and resets nothing", async () => {
	const [result, sent] = await sentBy(() => act({ type: "hold" }))
	assert.deepEqual(
		[result.status, result.refused],
		["refused", "Nothing is watched yet, so there is nothing to put on hold."],
	)
	assert.deepEqual(writes(sent), [])
	assert.equal(resets(), 0)
	for (const [event, id, title] of [
		[{ type: "watch", season: 1, number: 1 }, undefined, show],
		[{ type: "watch", season: 1, number: 1 }, "short", show],
		[{ type: "watch", season: 1, number: 1 }, "g-0193f6a2-7c1e-101", show],
		[{ type: "watch", season: 1, number: 1 }, "score-1399", show],
		[{ type: "pressSeen" }, "", show],
		[{ type: "markSeason", season: 1 }, "bad id with spaces", show],
		[{ type: "watch", season: 1.5, number: 1 }, "act-000099", show],
		[{ type: "watch", season: 1, number: -1 }, "act-000099", show],
		[{ type: "watch" }, "act-000099", show],
		[{ type: "watch", season: 9, number: 9 }, "act-000099", show],
		[
			{ type: "watch", when: { precision: "day", day: "2026-02-30x" } },
			"act-000099",
			movie,
		],
		[{ type: "hold" }, "act-000099", movie],
		[{ type: "pressSeen" }, "act-000099", movie],
		[
			{ type: "watch", season: 1, number: 1 },
			"act-000099",
			{ mediaType: "show", tmdbId: 0.5 },
		],
	] as [TrackingAction, string | undefined, TrackedTitle][]) {
		const refused = await applyTrackingEvent(user, title, event, id)
		assert.equal(refused.status, "refused", JSON.stringify([event, id]))
		assert.ok(refused.refused)
	}
	assert.deepEqual(db.log(user), [])
	assert.deepEqual(db.table("user_watch_state"), [])
})

// ---------------------------------------------------------------------------------------------------------
// The per-action table of the data model, row by row
// ---------------------------------------------------------------------------------------------------------

test("Watch an episode: one single row in the current pass, the state by the row taken, and the lists cleared", async () => {
	wantAndNotInterested()
	// A special changes nothing else: no state row, and the title stays on its lists.
	const [special, specialSent] = await sentBy(() => tick(0, 1))
	assert.deepEqual([special.row, special.state, stateOf()], ["1", null, null])
	assert.deepEqual(writes(specialSent), ["INSERT user_watch_log"])
	assert.deepEqual(
		[onWishlist(), notInterested(), tasteTouched()],
		[true, true, false],
	)
	assert.deepEqual(special.cleared, {
		wantToSeeAddedAt: null,
		notInterested: false,
	})
	// A regular episode: Watching (row 3), and both lists cleared.
	const first = await tick(1, 1)
	assert.deepEqual([first.row, stateOf()?.state], ["3", "watching"])
	assert.deepEqual(
		[onWishlist(), notInterested(), tasteTouched()],
		[false, false, true],
	)
	assert.deepEqual(first.cleared, {
		wantToSeeAddedAt: new Date(1_000).toISOString(),
		notInterested: true,
	})
	// A tick that leaves the state alone still writes the state row: it is the lock.
	const changedAt = stateOf()?.state_changed_at
	const [second, secondSent] = await sentBy(() => tick(1, 2))
	assert.equal(second.row, "3")
	assert.deepEqual(writes(secondSent), [
		"INSERT user_watch_log",
		"UPDATE user_watch_state",
	])
	assert.equal(stateOf()?.state_changed_at, changedAt)
	// The last aired episode: Seen (row 2), with no press to take back.
	await tick(1, 3)
	await tick(2, 1)
	const last = await tick(2, 2)
	assert.deepEqual(
		[last.row, stateOf()?.state, stateOf()?.seen_press_group],
		["2", "seen", null],
	)
	assert.ok((stateOf()?.state_changed_at as number) >= (changedAt as number))
	assert.ok(
		logOf().every(
			(r) =>
				r.origin === "single" &&
				r.pass === 1 &&
				r.watched_at_precision === "moment",
		),
	)
	// Already watched in this pass.
	assert.equal((await tick(1, 1)).status, "refused")
})

test("Watch an episode on a Seen show (rows 4 and 5): all new ones keeps Seen and the press, some returns to Watching", async () => {
	await act({ type: "pressSeen" }, "press-0001")
	airs(episode(SHOW, 206, 2, 6, LONG_AGO))
	const all = await tick(2, 6)
	assert.deepEqual(
		[
			all.row,
			stateOf()?.state,
			stateOf()?.seen_press_group,
			stateOf()?.seen_press_from,
		],
		["4", "seen", "press-0001", "not_started"],
	)
	airs(episode(SHOW, 207, 2, 7, LONG_AGO))
	airs(episode(SHOW, 208, 2, 8, LONG_AGO))
	const some = await tick(2, 7)
	assert.deepEqual(
		[
			some.row,
			stateOf()?.state,
			stateOf()?.seen_press_group,
			stateOf()?.seen_press_from,
		],
		["5", "watching", null, null],
	)
})

test("Unwatch an episode: deletes the episode's rows of the current pass by their ids", async () => {
	await tick(0, 1)
	await tick(1, 1, "tick-s1e1")
	await tick(1, 2, "tick-s1e2")
	// A second watch of the same episode in the pass, as an import leaves it.
	db.seed("user_watch_log", [
		{
			...logOf().find((r) => r.watch_id === "tick-s1e2"),
			watch_id: "i-5b1e0c9a7d2f4e6a",
			origin: "import",
			import_id: "imp_1",
		},
	])
	const [untick, sent] = await sentBy(() =>
		act({ type: "unwatch", season: 1, number: 2 }),
	)
	assert.deepEqual(writes(sent), [
		"DELETE user_watch_log",
		"UPDATE user_watch_state",
	])
	assert.deepEqual(untick.deleted.sort(), ["i-5b1e0c9a7d2f4e6a", "tick-s1e2"])
	const remove = db.statements.find((s) =>
		s.sql.startsWith("DELETE FROM user_watch_log"),
	)
	assert.equal(
		remove?.sql,
		"DELETE FROM user_watch_log WHERE user_id = ? AND watch_id IN (?, ?)",
	)
	assert.deepEqual(
		[untick.row, stateOf()?.state, ticks()],
		["7", "watching", ["0.1", "1.1"]],
	)
	// A special (row 6) changes nothing else.
	assert.equal((await act({ type: "unwatch", season: 0, number: 1 })).row, "6")
	assert.equal(stateOf()?.state, "watching")
	// The only watched episode (row 8): Not started, and the row goes because it remembers nothing.
	const [only, onlySent] = await sentBy(() =>
		act({ type: "unwatch", season: 1, number: 1 }),
	)
	assert.deepEqual(writes(onlySent), [
		"DELETE user_watch_log",
		"DELETE user_watch_state",
	])
	assert.deepEqual(
		[only.row, only.state, stateOf(), logOf()],
		["8", null, null, []],
	)
})

test("Unwatch: leaving Seen ends the press; On hold and Dropped stay, also with nothing watched (rows 7, 9, 10)", async () => {
	await act({ type: "pressSeen" }, "press-0001")
	const left = await act({ type: "unwatch", season: 2, number: 2 })
	assert.deepEqual(
		[
			left.row,
			stateOf()?.state,
			stateOf()?.seen_press_group,
			stateOf()?.seen_press_from,
		],
		["7", "watching", null, null],
	)
	await tick(1, 1, newId(), short)
	await tick(1, 2, newId(), short)
	await act({ type: "unwatch", season: 1, number: 2 }, undefined, short)
	await act({ type: "hold" }, undefined, short)
	const held = await act(
		{ type: "unwatch", season: 1, number: 1 },
		undefined,
		short,
	)
	assert.deepEqual(
		[held.row, stateOf(short)?.state, logOf(short)],
		["10", "on_hold", []],
	)
})

test("Mark a season and Watched up to here: one insert, one group, no dates, and the state as if each were watched in turn", async () => {
	wantAndNotInterested()
	await tick(1, 2)
	wantAndNotInterested()
	const [season, sent] = await sentBy(() =>
		act({ type: "markSeason", season: 1 }, "group-season-1"),
	)
	assert.deepEqual(writes(sent), [
		"INSERT user_watch_log",
		"UPDATE user_watch_state",
		"DELETE user_wishlist",
		"DELETE user_not_interested",
	])
	assert.deepEqual(season.inserted, [
		"g-group-season-1-101",
		"g-group-season-1-103",
	])
	assert.deepEqual(
		logOf()
			.filter((r) => r.group_id)
			.map((r) => [
				r.watch_id,
				r.origin,
				r.group_id,
				r.watched_at,
				r.watched_at_precision,
				r.pass,
				r.episode_tmdb_id,
			]),
		[
			[
				"g-group-season-1-101",
				"season",
				"group-season-1",
				null,
				"unknown",
				1,
				101,
			],
			[
				"g-group-season-1-103",
				"season",
				"group-season-1",
				null,
				"unknown",
				1,
				103,
			],
		],
	)
	assert.equal(stateOf()?.state, "watching")
	// Up to S2 E4: the aired ones only, and the last aired episode makes the show Seen without a press.
	const upTo = await act(
		{ type: "watchUpTo", season: 2, number: 4 },
		"group-upto-22",
	)
	assert.deepEqual(upTo.inserted, [
		"g-group-upto-22-201",
		"g-group-upto-22-202",
	])
	assert.ok(
		logOf()
			.filter((r) => r.group_id === "group-upto-22")
			.every((r) => r.origin === "upto" && r.watched_at === null),
	)
	assert.deepEqual(
		[upTo.row, stateOf()?.state, stateOf()?.seen_press_group],
		["2", "seen", null],
	)
	assert.equal(
		(await act({ type: "markSeason", season: 1 }, "group-again")).status,
		"refused",
	)
})

test("Set a date on a group: the group's rows get the day, and the state row is not touched", async () => {
	await act({ type: "markSeason", season: 1 }, "group-season-1")
	await tick(2, 1, "tick-s2e1")
	const before = db.table("user_watch_state").map((r) => ({ ...r }))
	const [result, sent] = await sentBy(() =>
		act({ type: "setGroupDate", group: "group-season-1", day: "2026-10-05" }),
	)
	assert.equal(result.status, "applied")
	assert.deepEqual(writes(sent), ["UPDATE user_watch_log"])
	assert.equal(
		db.statements.find((s) => s.sql.startsWith("UPDATE user_watch_log"))?.sql,
		"UPDATE user_watch_log SET watched_at = ?, watched_at_precision = 'day', updated_at = ? WHERE user_id = ? AND group_id = ? AND media_type = ? AND tmdb_id = ?",
	)
	assert.deepEqual(
		logOf().map((r) => [
			r.watch_id,
			r.watched_at_precision,
			r.watched_at === Date.UTC(2026, 9, 5),
		]),
		[
			["g-group-season-1-101", "day", true],
			["g-group-season-1-102", "day", true],
			["g-group-season-1-103", "day", true],
			["tick-s2e1", "moment", false],
		],
	)
	assert.deepEqual(db.table("user_watch_state"), before)
	assert.equal(resets(), 3)
	assert.equal(
		(await act({ type: "setGroupDate", group: "nothing", day: "2026-10-05" }))
			.status,
		"refused",
	)
	assert.equal(
		(await act({ type: "setGroupDate", group: "group-season-1", day: "5 Oct" }))
			.status,
		"refused",
	)
})

test("Unmark a season and Undo of a group mark: one delete, and the state as if each were unwatched in turn", async () => {
	await tick(1, 1, "tick-s1e1")
	await act({ type: "watchUpTo", season: 2, number: 2 }, "group-upto-22")
	assert.equal(stateOf()?.state, "seen")
	const [undo, undoSent] = await sentBy(() =>
		act({ type: "undoGroup", group: "group-upto-22" }),
	)
	assert.deepEqual(writes(undoSent), [
		"DELETE user_watch_log",
		"UPDATE user_watch_state",
	])
	assert.equal(undo.deleted.length, 4)
	assert.deepEqual([stateOf()?.state, ticks()], ["watching", ["1.1"]])
	await act({ type: "markSeason", season: 1 }, "group-season-1")
	const [unmark, unmarkSent] = await sentBy(() =>
		act({ type: "unmarkSeason", season: 1 }),
	)
	// The season's rows of the pass, whoever made them: the tick by hand too.
	assert.deepEqual(unmark.deleted.sort(), [
		"g-group-season-1-102",
		"g-group-season-1-103",
		"tick-s1e1",
	])
	assert.deepEqual(writes(unmarkSent), [
		"DELETE user_watch_log",
		"DELETE user_watch_state",
	])
	assert.deepEqual([unmark.row, stateOf(), logOf()], ["8", null, []])
})

test("Press Seen (row 11): one row per aired regular episode not yet watched, and the press stands", async () => {
	wantAndNotInterested()
	await tick(0, 1)
	await tick(1, 2, "tick-s1e2")
	wantAndNotInterested()
	await act({ type: "hold" })
	const [press, sent] = await sentBy(() =>
		act({ type: "pressSeen" }, "press-0001"),
	)
	assert.deepEqual(writes(sent), [
		"INSERT user_watch_log",
		"UPDATE user_watch_state",
		"DELETE user_wishlist",
		"DELETE user_not_interested",
	])
	assert.deepEqual(press.inserted, [
		"g-press-0001-101",
		"g-press-0001-103",
		"g-press-0001-201",
		"g-press-0001-202",
	])
	assert.ok(
		logOf()
			.filter((r) => r.group_id)
			.every(
				(r) =>
					r.origin === "seen" &&
					r.group_id === "press-0001" &&
					r.watched_at === null &&
					r.watched_at_precision === "unknown" &&
					r.pass === 1,
			),
	)
	assert.deepEqual(
		[
			press.row,
			stateOf()?.state,
			stateOf()?.seen_press_group,
			stateOf()?.seen_press_from,
		],
		["11", "seen", "press-0001", "on_hold"],
	)
	assert.deepEqual([onWishlist(), notInterested()], [false, false])
	// Seen with everything watched and a press standing: another press is refused; the button takes it back.
	assert.equal(
		(await act({ type: "pressSeen" }, "press-0002")).status,
		"refused",
	)
})

test("Press Seen on a Seen show with new episodes (row 12): a group of its own, pressed from Seen", async () => {
	await act({ type: "pressSeen" }, "press-0001")
	airs(episode(SHOW, 206, 2, 6, LONG_AGO))
	const again = await act({ type: "pressSeen" }, "press-0002")
	assert.deepEqual(again.inserted, ["g-press-0002-206"])
	assert.deepEqual(
		[
			again.row,
			stateOf()?.state,
			stateOf()?.seen_press_group,
			stateOf()?.seen_press_from,
		],
		["12", "seen", "press-0002", "seen"],
	)
	// Taking it back (row 13) leaves the show Seen and the first group in place.
	const back = await act({ type: "undoSeen" })
	assert.deepEqual(back.deleted, ["g-press-0002-206"])
	assert.deepEqual(
		[back.row, stateOf()?.state, stateOf()?.seen_press_group, logOf().length],
		["13", "seen", null, 5],
	)
})

test("Press Seen again (rows 14 to 17): the group's rows go and the state returns to where it was pressed from", async () => {
	// With nothing else watched: Not started, and no row is left (17).
	await act({ type: "pressSeen" }, "press-0001")
	const [none, sent] = await sentBy(() => act({ type: "undoSeen" }))
	assert.deepEqual(writes(sent), [
		"DELETE user_watch_log",
		"DELETE user_watch_state",
	])
	assert.equal(
		db.statements.find((s) => s.sql.startsWith("DELETE FROM user_watch_log"))
			?.sql,
		"DELETE FROM user_watch_log WHERE user_id = ? AND watch_id IN (?, ?, ?, ?, ?)",
	)
	assert.deepEqual(
		[none.row, none.deleted.length, stateOf(), logOf()],
		["17", 5, null, []],
	)
	// With a tick made before (14): Watching, with that tick.
	await tick(1, 1, "tick-s1e1")
	await act({ type: "pressSeen" }, "press-0002")
	const some = await act({ type: "undoSeen" })
	assert.deepEqual(
		[
			some.row,
			stateOf()?.state,
			stateOf()?.seen_press_group,
			stateOf()?.seen_press_from,
			ticks(),
		],
		["14", "watching", null, null, ["1.1"]],
	)
	// Pressed on an On hold show (15) and on a Dropped one (16): back to exactly that.
	await act({ type: "hold" })
	await act({ type: "pressSeen" }, "press-0003")
	assert.deepEqual(
		[(await act({ type: "undoSeen" })).row, stateOf()?.state],
		["15", "on_hold"],
	)
	await act({ type: "drop" })
	await act({ type: "pressSeen" }, "press-0004")
	assert.deepEqual(
		[(await act({ type: "undoSeen" })).row, stateOf()?.state],
		["16", "dropped"],
	)
	assert.equal((await act({ type: "undoSeen" })).status, "refused")
})

test("Put on hold, drop, resume (rows 18 to 21): no log row, the state and when it changed; Drop clears the lists", async () => {
	await tick(1, 1)
	const log = logOf()
	const started = stateOf()?.state_changed_at as number
	await new Promise((resolve) => setTimeout(resolve, 3))
	const [hold, holdSent] = await sentBy(() => act({ type: "hold" }))
	assert.deepEqual(writes(holdSent), ["UPDATE user_watch_state"])
	assert.deepEqual([hold.row, stateOf()?.state], ["18", "on_hold"])
	assert.ok((stateOf()?.state_changed_at as number) > started)
	assert.deepEqual((await act({ type: "resume" })).row, "20")
	assert.equal(stateOf()?.state, "watching")
	wantAndNotInterested()
	const drop = await act({ type: "drop" })
	assert.deepEqual([drop.row, stateOf()?.state], ["19", "dropped"])
	assert.deepEqual(
		[onWishlist(), notInterested(), drop.cleared.notInterested],
		[false, false, true],
	)
	assert.deepEqual(logOf(), log)
	// Dropped with nothing watched, as an import brings it: a new row. Resume then leads to Not started (21).
	const fresh = await act({ type: "drop" }, undefined, short)
	assert.deepEqual([fresh.row, stateOf(short)?.state], ["19", "dropped"])
	const resumed = await act({ type: "resume" }, undefined, short)
	assert.deepEqual([resumed.row, stateOf(short)], ["21", null])
})

test("Rate a show (row 22): the state is unchanged, and a first score by hand on a never-started show opens the question", async () => {
	db.seed("user_not_interested", [titleRow(show)])
	const [rated, sent] = await sentBy(() => act({ type: "rate", score: 8 }))
	assert.deepEqual(writes(sent), [
		"INSERT user_watch_state",
		"DELETE user_not_interested",
	])
	assert.deepEqual(
		[rated.row, stateOf()?.state, stateOf()?.seen_question, stateOf()?.pass],
		["22", "not_started", "open", 1],
	)
	assert.equal(
		db.table("user_score").length,
		0,
		"the score is written by updateScores",
	)
	// Asked once: answered stays answered.
	await act({ type: "answerSeenQuestion", answer: "just_rating" })
	await act({ type: "rate", score: 6 })
	assert.equal(stateOf()?.seen_question, "answered")
	// A score from an import or the quiz, a cleared score, and a score on a started show do not ask.
	await act({ type: "rate", score: 8, byHand: false }, undefined, short)
	await act({ type: "rate", score: null }, undefined, short)
	assert.equal(stateOf(short), null)
	await tick(1, 1, newId(), short)
	await act({ type: "rate", score: 8 }, undefined, short)
	assert.deepEqual(
		[stateOf(short)?.state, stateOf(short)?.seen_question],
		["watching", null],
	)
	assert.deepEqual(logOf().length, 0)
})

test("Want to See (rows 23, 24) and Not interested (row 25): no state but Dropped to Not started, and each clears the other", async () => {
	// Row 23: no state row. The Wishlist row itself is added by updateWishList; Not interested is cleared here.
	db.seed("user_not_interested", [titleRow(show)])
	const [want, wantSent] = await sentBy(() =>
		act({ type: "wantToSee", on: true }),
	)
	assert.deepEqual([want.status, want.row, stateOf()], ["applied", "23", null])
	assert.deepEqual(writes(wantSent), ["DELETE user_not_interested"])
	// Row 25: Not interested takes the title off the Wishlist.
	db.seed("user_wishlist", [titleRow(show)])
	const [nope, nopeSent] = await sentBy(() =>
		act({ type: "notInterested", on: true }),
	)
	assert.deepEqual(
		[nope.row, stateOf(), onWishlist(), tasteTouched()],
		["25", null, false, true],
	)
	assert.deepEqual(writes(nopeSent), ["DELETE user_wishlist"])
	// Taking a title off the Wishlist is row 23 too.
	db.seed("user_wishlist", [titleRow(show)])
	assert.equal((await act({ type: "wantToSee", on: false })).row, "23")
	assert.equal(onWishlist(), false)
	// Row 24: Dropped with nothing watched returns to Not started, and the row goes.
	await act({ type: "drop" })
	const back = await act({ type: "wantToSee", on: true })
	assert.deepEqual([back.row, stateOf()], ["24", null])
	// A started show is on neither list.
	await tick(1, 1)
	assert.equal((await act({ type: "wantToSee", on: true })).status, "refused")
	assert.equal(
		(await act({ type: "notInterested", on: true })).status,
		"refused",
	)
})

test("Watch again (row 26): the next pass, Watching, the press gone, and no log row", async () => {
	await act({ type: "pressSeen" }, "press-0001")
	const [again, sent] = await sentBy(() => act({ type: "watchAgain" }))
	assert.deepEqual(writes(sent), ["UPDATE user_watch_state"])
	assert.deepEqual(
		[
			again.row,
			stateOf()?.state,
			stateOf()?.pass,
			stateOf()?.seen_press_group,
			stateOf()?.seen_press_from,
		],
		["26", "watching", 2, null, null],
	)
	// A tick now is a row of pass 2, also for an episode watched in pass 1.
	await tick(1, 1, "pass2-s1e1")
	assert.equal(logOf().find((r) => r.watch_id === "pass2-s1e1")?.pass, 2)
	assert.equal(logOf().filter((r) => r.pass === 1).length, 5)
	// Without a watched regular episode it is refused: a show Seen by a press with no episode list.
	await act({ type: "pressSeen" }, "press-0002", {
		mediaType: "show",
		tmdbId: 40_000,
	})
	const refused = await act({ type: "watchAgain" }, undefined, {
		mediaType: "show",
		tmdbId: 40_000,
	})
	assert.equal(refused.status, "refused")
	assert.equal(db.state(user, "show", 40_000)?.pass, 1)
})

test("Not now on the prompt to rate, and the answers to the question, are remembered on the row", async () => {
	const before = Date.now()
	const [dismissed, sent] = await sentBy(() =>
		act({ type: "dismissRatePrompt" }),
	)
	assert.deepEqual(writes(sent), ["INSERT user_watch_state"])
	assert.equal(dismissed.row, null)
	assert.equal(stateOf()?.state, "not_started")
	const at = stateOf()?.rate_prompt_dismissed_at as number
	assert.ok(at >= before && at <= Date.now())
	// It keeps its time through later events.
	await tick(1, 1)
	await act({ type: "dismissRatePrompt" })
	assert.deepEqual(
		[stateOf()?.state, stateOf()?.rate_prompt_dismissed_at],
		["watching", at],
	)
	// "Have you seen all of it?": "Yes, all of it" is a Seen press, which answers it.
	await act({ type: "rate", score: 8 }, undefined, short)
	assert.equal(stateOf(short)?.seen_question, "open")
	await act({ type: "pressSeen" }, "press-0001", short)
	assert.deepEqual(
		[stateOf(short)?.state, stateOf(short)?.seen_question],
		["seen", "answered"],
	)
})

test("Edit a watch's date in the log: the row gets a day or no date, and no state row is touched", async () => {
	await tick(1, 1, "tick-s1e1")
	const before = db.table("user_watch_state").map((r) => ({ ...r }))
	const [edited, sent] = await sentBy(() =>
		act({
			type: "editWatchDate",
			watchId: "tick-s1e1",
			when: { precision: "day", day: "2026-10-05" },
		}),
	)
	assert.equal(edited.status, "applied")
	assert.deepEqual(sent, [
		"UPDATE user_watch_log",
		"REFRESH TABLE user_not_interested",
		"REFRESH TABLE user_score, user_wishlist, user_watch_log, user_watch_state, user_favorite, user_skipped",
	])
	assert.equal(
		db.statements.find((s) => s.sql.startsWith("UPDATE user_watch_log"))?.sql,
		"UPDATE user_watch_log SET watched_at = ?, watched_at_precision = ?, updated_at = ? WHERE user_id = ? AND watch_id = ? AND media_type = ? AND tmdb_id = ?",
	)
	assert.deepEqual(
		[logOf()[0].watched_at, logOf()[0].watched_at_precision, logOf()[0].origin],
		[Date.UTC(2026, 9, 5), "day", "single"],
	)
	await act({
		type: "editWatchDate",
		watchId: "tick-s1e1",
		when: { precision: "unknown" },
	})
	assert.deepEqual(
		[logOf()[0].watched_at, logOf()[0].watched_at_precision],
		[null, "unknown"],
	)
	assert.deepEqual(db.table("user_watch_state"), before)
	// A time is never set here, and a watch of another title is not found.
	const moment = {
		type: "editWatchDate",
		watchId: "tick-s1e1",
		when: { precision: "moment" },
	} as unknown as TrackingAction
	assert.equal((await act(moment)).status, "refused")
	assert.equal(
		(
			await act(
				{
					type: "editWatchDate",
					watchId: "tick-s1e1",
					when: { precision: "unknown" },
				},
				undefined,
				short,
			)
		).status,
		"refused",
	)
})

test("Delete a watch in the log: an unwatch when it was the episode's only watch of the pass, and Not started when nothing is left", async () => {
	await tick(1, 1, "tick-s1e1")
	await tick(1, 2, "tick-s1e2")
	db.seed("user_watch_log", [
		{
			...logOf().find((r) => r.watch_id === "tick-s1e2"),
			watch_id: "i-5b1e0c9a7d2f4e6a",
			origin: "import",
			import_id: "imp_1",
		},
	])
	// One of two watches of the episode: the episode stays watched.
	const [one, sent] = await sentBy(() =>
		act({ type: "deleteWatch", watchId: "i-5b1e0c9a7d2f4e6a" }),
	)
	assert.deepEqual(writes(sent), [
		"DELETE user_watch_log",
		"UPDATE user_watch_state",
	])
	assert.deepEqual(
		[one.deleted, one.row, ticks()],
		[["i-5b1e0c9a7d2f4e6a"], null, ["1.1", "1.2"]],
	)
	// The episode's only watch: its row of the table.
	assert.equal(
		(await act({ type: "deleteWatch", watchId: "tick-s1e2" })).row,
		"7",
	)
	const last = await act({ type: "deleteWatch", watchId: "tick-s1e1" })
	assert.deepEqual([last.row, stateOf(), logOf()], ["8", null, []])
	assert.equal(
		(await act({ type: "deleteWatch", watchId: "tick-s1e1" })).status,
		"applied",
		"sent again",
	)
	// From Seen: leaving Seen ends the press.
	await act({ type: "pressSeen" }, "press-0001")
	await act({ type: "deleteWatch", watchId: "g-press-0001-202" })
	assert.deepEqual(
		[stateOf()?.state, stateOf()?.seen_press_group],
		["watching", null],
	)
})

// ---- movies ------------------------------------------------------------------------------------------------

const movieAct = (event: TrackingAction, actionId = newId()) =>
	act(event, actionId, movie)
const score = (value: number | null) => {
	db.rows.set("user_score", [])
	if (value !== null)
		db.seed("user_score", [titleRow(movie, { score: value, review: null })])
}
const movieLog = () =>
	logOf(movie).map((r) => [r.watch_id, r.origin, r.watched_at_precision])

test("Movie: Seen in one tap inserts one single watch now, makes the state row, and clears both lists", async () => {
	wantAndNotInterested(movie)
	const before = Date.now()
	const [seen, sent] = await sentBy(() =>
		movieAct({ type: "watch" }, "movie-watch-1"),
	)
	assert.deepEqual(sent, [
		"INSERT user_watch_log",
		"REFRESH TABLE user_watch_log",
		"SELECT user_watch_state",
		"SELECT user_watch_log",
		"SELECT user_score",
		"INSERT user_watch_state",
		"SELECT user_wishlist",
		"DELETE user_wishlist",
		"SELECT user_not_interested",
		"DELETE user_not_interested",
		"REFRESH TABLE user_not_interested",
		"REFRESH TABLE user_score, user_wishlist, user_watch_log, user_watch_state, user_favorite, user_skipped",
	])
	const [row] = logOf(movie)
	assert.deepEqual(
		{ ...row, watched_at: null, created_at: null, updated_at: null },
		{
			user_id: user,
			watch_id: "movie-watch-1",
			media_type: "movie",
			tmdb_id: MOVIE,
			episode_tmdb_id: null,
			season_number: null,
			episode_number: null,
			watched_at: null,
			watched_at_precision: "moment",
			origin: "single",
			group_id: null,
			import_id: null,
			pass: 1,
			created_at: null,
			updated_at: null,
		},
	)
	assert.ok((row.watched_at as number) >= before)
	assert.deepEqual(
		[
			stateOf(movie)?.state,
			stateOf(movie)?.pass,
			stateOf(movie)?.seen_press_group,
		],
		["seen", 1, null],
	)
	assert.deepEqual(
		[seen.state?.state, seen.inserted, onWishlist(movie), notInterested(movie)],
		["seen", ["movie-watch-1"], false, false],
	)
	assert.deepEqual(seen.cleared, {
		wantToSeeAddedAt: new Date(1_000).toISOString(),
		notInterested: true,
	})
	assert.deepEqual([resets(), tasteTouched()], [1, true])
	// A second watch is a second row; the state row is there already.
	const [, again] = await sentBy(() =>
		movieAct({ type: "watch" }, "movie-watch-2"),
	)
	assert.deepEqual(writes(again), ["INSERT user_watch_log"])
	assert.equal(logOf(movie).length, 2)
})

test("Movie: add a watch in the log with a chosen day or no date, and it replaces the score's watch", async () => {
	score(8)
	await movieAct({ type: "rate", score: 8 })
	assert.deepEqual(movieLog(), [[`score-${MOVIE}`, "score", "unknown"]])
	const [, sent] = await sentBy(() =>
		movieAct(
			{ type: "watch", when: { precision: "day", day: "2019-03-12" } },
			"movie-watch-1",
		),
	)
	assert.deepEqual(writes(sent), [
		"INSERT user_watch_log",
		"DELETE user_watch_log",
	])
	assert.deepEqual(movieLog(), [["movie-watch-1", "single", "day"]])
	assert.equal(logOf(movie)[0].watched_at, Date.UTC(2019, 2, 12))
	await movieAct(
		{ type: "watch", when: { precision: "unknown" } },
		"movie-watch-2",
	)
	assert.deepEqual(
		logOf(movie)
			.map((r) => [r.watch_id, r.watched_at])
			.sort(),
		[
			["movie-watch-1", Date.UTC(2019, 2, 12)],
			["movie-watch-2", null],
		],
	)
	assert.equal(stateOf(movie)?.state, "seen")
})

test("Movie: rating one that has no log row records the score's watch, makes it Seen, and clears both lists", async () => {
	wantAndNotInterested(movie)
	score(8)
	const [rated, sent] = await sentBy(() => movieAct({ type: "rate", score: 8 }))
	assert.deepEqual(writes(sent), [
		"INSERT user_watch_log",
		"INSERT user_watch_state",
		"DELETE user_wishlist",
		"DELETE user_not_interested",
	])
	const [row] = logOf(movie)
	assert.deepEqual(
		[
			row.watch_id,
			row.origin,
			row.watched_at,
			row.watched_at_precision,
			row.pass,
			row.group_id,
			row.import_id,
		],
		["score-603", "score", null, "unknown", 1, null, null],
	)
	assert.deepEqual([stateOf(movie)?.state, stateOf(movie)?.pass], ["seen", 1])
	assert.deepEqual(
		[rated.inserted, onWishlist(movie), notInterested(movie)],
		[["score-603"], false, false],
	)
	// Rating again inserts nothing more.
	score(6)
	const [, again] = await sentBy(() => movieAct({ type: "rate", score: 6 }))
	assert.deepEqual(writes(again), [])
	assert.equal(logOf(movie).length, 1)
})

test("Movie: rating one that has a log row writes no watch and no state, and clears only Not interested", async () => {
	await movieAct({ type: "watch" }, "movie-watch-1")
	wantAndNotInterested(movie)
	score(8)
	const [, sent] = await sentBy(() => movieAct({ type: "rate", score: 8 }))
	assert.deepEqual(writes(sent), ["DELETE user_not_interested"])
	assert.deepEqual(movieLog(), [["movie-watch-1", "single", "moment"]])
	assert.deepEqual([onWishlist(movie), notInterested(movie)], [true, false])
})

test("Movie: clearing the score deletes the score's watch, and the state row when no log row is left", async () => {
	score(8)
	await movieAct({ type: "rate", score: 8 })
	score(null)
	const [cleared, sent] = await sentBy(() =>
		movieAct({ type: "rate", score: null }),
	)
	assert.deepEqual(writes(sent), [
		"DELETE user_watch_log",
		"DELETE user_watch_state",
	])
	assert.deepEqual(
		[cleared.deleted, cleared.state, logOf(movie), stateOf(movie)],
		[["score-603"], null, [], null],
	)
	// With a watch the member logged, clearing the score removes nothing.
	await movieAct({ type: "watch" }, "movie-watch-1")
	score(7)
	await movieAct({ type: "rate", score: 7 })
	score(null)
	const [, kept] = await sentBy(() => movieAct({ type: "rate", score: null }))
	assert.deepEqual(writes(kept), [])
	assert.deepEqual(
		[movieLog(), stateOf(movie)?.state],
		[[["movie-watch-1", "single", "moment"]], "seen"],
	)
})

test("Movie: setting a date on the score's watch makes it the member's own, which clearing the score leaves", async () => {
	score(8)
	await movieAct({ type: "rate", score: 8 })
	// Without a date it stays the score's.
	await movieAct({
		type: "editWatchDate",
		watchId: "score-603",
		when: { precision: "unknown" },
	})
	assert.deepEqual(movieLog(), [["score-603", "score", "unknown"]])
	const [, sent] = await sentBy(() =>
		movieAct({
			type: "editWatchDate",
			watchId: "score-603",
			when: { precision: "day", day: "2024-05-01" },
		}),
	)
	assert.deepEqual(writes(sent), [
		"UPDATE user_watch_log",
		"UPDATE user_watch_log",
	])
	assert.equal(
		db.statements[db.statements.length - 3].sql,
		"UPDATE user_watch_log SET origin = 'single', updated_at = ? WHERE user_id = ? AND watch_id = ? AND origin = 'score'",
	)
	assert.deepEqual(movieLog(), [["score-603", "single", "day"]])
	score(null)
	await movieAct({ type: "rate", score: null })
	assert.deepEqual(
		[movieLog(), stateOf(movie)?.state],
		[[["score-603", "single", "day"]], "seen"],
	)
})

test("Movie: deleting a watch in the log; the last one of a rated movie brings the score's watch back", async () => {
	await movieAct({ type: "watch" }, "movie-watch-1")
	await movieAct({ type: "watch" }, "movie-watch-2")
	const [one, sent] = await sentBy(() =>
		movieAct({ type: "deleteWatch", watchId: "movie-watch-2" }),
	)
	assert.deepEqual(writes(sent), ["DELETE user_watch_log"])
	assert.deepEqual(
		[one.deleted, stateOf(movie)?.state],
		[["movie-watch-2"], "seen"],
	)
	// The last watch of an unrated movie: not Seen, and the row goes.
	const [last, lastSent] = await sentBy(() =>
		movieAct({ type: "deleteWatch", watchId: "movie-watch-1" }),
	)
	assert.deepEqual(writes(lastSent), [
		"DELETE user_watch_log",
		"DELETE user_watch_state",
	])
	assert.deepEqual([last.state, logOf(movie), stateOf(movie)], [null, [], null])
	// The last watch of a rated movie: the score's watch comes back and the movie stays Seen.
	score(8)
	await movieAct({ type: "watch" }, "movie-watch-3")
	const [rated, ratedSent] = await sentBy(() =>
		movieAct({ type: "deleteWatch", watchId: "movie-watch-3" }),
	)
	assert.deepEqual(writes(ratedSent), [
		"DELETE user_watch_log",
		"INSERT user_watch_log",
	])
	assert.deepEqual(
		[rated.inserted, movieLog(), stateOf(movie)?.state],
		[["score-603"], [["score-603", "score", "unknown"]], "seen"],
	)
	// The score's watch itself can't be deleted in the log.
	const refused = await movieAct({ type: "deleteWatch", watchId: "score-603" })
	assert.equal(refused.status, "refused")
	assert.equal(logOf(movie).length, 1)
})

test("Movie: a second and a third watch are recorded beside the first, each under its own id", async () => {
	await movieAct({ type: "watch" }, "movie-watch-1")
	const again = await movieAct(
		{ type: "watch", when: { precision: "day", day: "2024-05-01" } },
		"movie-watch-2",
	)
	assert.deepEqual([again.status, again.inserted], ["applied", ["movie-watch-2"]])
	await movieAct(
		{ type: "watch", when: { precision: "unknown" } },
		"movie-watch-3",
	)
	assert.deepEqual(movieLog(), [
		["movie-watch-1", "single", "moment"],
		["movie-watch-2", "single", "day"],
		["movie-watch-3", "single", "unknown"],
	])
	// The same request again records nothing more.
	const resent = await movieAct({ type: "watch" }, "movie-watch-2")
	assert.deepEqual([resent.status, resent.inserted], ["applied", []])
	assert.equal(logOf(movie).length, 3)
	assert.equal((await getWatchState(user))["movie-603"].count, 3)
})

test("Movie: a watch can't be dated on a day that has not come", async () => {
	const ahead = iso(midnight(2))
	const refused = await movieAct(
		{ type: "watch", when: { precision: "day", day: ahead } },
		"movie-watch-1",
	)
	assert.deepEqual([refused.status, logOf(movie)], ["refused", []])
	await movieAct({ type: "watch" }, "movie-watch-1")
	const edit = await movieAct({
		type: "editWatchDate",
		watchId: "movie-watch-1",
		when: { precision: "day", day: ahead },
	})
	assert.equal(edit.status, "refused")
	assert.equal(logOf(movie)[0].watched_at_precision, "moment")
	// The device can be a day ahead of UTC.
	const tomorrow = await movieAct({
		type: "editWatchDate",
		watchId: "movie-watch-1",
		when: { precision: "day", day: iso(midnight(1)) },
	})
	assert.equal(tomorrow.status, "applied")
})

test("Movie: the score's watch that a date made the member's own can be deleted like any other", async () => {
	score(8)
	await movieAct({ type: "rate", score: 8 })
	await movieAct({
		type: "editWatchDate",
		watchId: "score-603",
		when: { precision: "day", day: "2024-05-01" },
	})
	score(null)
	await movieAct({ type: "rate", score: null })
	assert.deepEqual(movieLog(), [["score-603", "single", "day"]])
	const gone = await movieAct({ type: "deleteWatch", watchId: "score-603" })
	assert.deepEqual(
		[gone.status, gone.deleted, logOf(movie), stateOf(movie)],
		["applied", ["score-603"], [], null],
	)
})

test("Movie: removing all watches deletes every watch the member logged in one statement; a rated movie stays Seen", async () => {
	await movieAct({ type: "watch" }, "movie-watch-1")
	await movieAct({ type: "watch", when: { precision: "unknown" } }, "movie-watch-2")
	const [all, sent] = await sentBy(() => movieAct({ type: "removeWatches" }))
	assert.deepEqual(writes(sent), [
		"DELETE user_watch_log",
		"DELETE user_watch_state",
	])
	assert.deepEqual(
		[all.status, [...all.deleted].sort(), logOf(movie), stateOf(movie)],
		["applied", ["movie-watch-1", "movie-watch-2"], [], null],
	)
	// Nothing left: the same request again changes nothing.
	assert.deepEqual((await movieAct({ type: "removeWatches" })).deleted, [])

	score(8)
	await movieAct({ type: "watch" }, "movie-watch-3")
	const rated = await movieAct({ type: "removeWatches" })
	assert.deepEqual(rated.deleted, ["movie-watch-3"])
	assert.deepEqual(movieLog(), [["score-603", "score", "unknown"]])
	assert.equal(stateOf(movie)?.state, "seen")
	// A show's watches are not removed this way.
	assert.equal((await act({ type: "removeWatches" })).status, "refused")
})

const restored = (
	watchId: string,
	parts: Partial<RestoredWatch> = {},
): RestoredWatch => ({
	watchId,
	watchedAt: Date.UTC(2024, 4, 1),
	precision: "day",
	origin: "single",
	importId: null,
	createdAt: Date.UTC(2024, 4, 2, 9),
	...parts,
})
const restore = (...rows: RestoredWatch[]) =>
	movieAct({ type: "restoreWatches", rows })

test("Movie: Undo of a delete inserts the same row again, with its id, its date and when it was recorded", async () => {
	await movieAct(
		{ type: "watch", when: { precision: "day", day: "2024-05-01" } },
		"movie-watch-1",
	)
	const [before] = logOf(movie)
	await movieAct({ type: "deleteWatch", watchId: "movie-watch-1" })
	assert.equal(stateOf(movie), null)
	const [back, sent] = await sentBy(() =>
		restore(restored("movie-watch-1", { createdAt: before.created_at })),
	)
	assert.deepEqual(writes(sent), [
		"INSERT user_watch_log",
		"INSERT user_watch_state",
	])
	assert.deepEqual([back.status, back.inserted], ["applied", ["movie-watch-1"]])
	const { updated_at: _, ...row } = logOf(movie)[0]
	const { updated_at: __, ...was } = before
	assert.deepEqual(row, was)
	assert.equal(stateOf(movie)?.state, "seen")
	// Sent twice, it is there once and nothing is overwritten.
	const twice = await restore(
		restored("movie-watch-1", { watchedAt: null, precision: "unknown" }),
	)
	assert.deepEqual([twice.status, twice.inserted], ["applied", []])
	assert.equal(logOf(movie)[0].watched_at, Date.UTC(2024, 4, 1))
})

test("Movie: Undo restores several watches at once, takes the place of the score's watch, and leaves the lists alone", async () => {
	score(8)
	await movieAct({ type: "rate", score: 8 })
	db.seed("user_wishlist", [titleRow(movie)])
	db.seed("user_import", [{ id: "imp-1", user_id: user, source: "letterboxd" }])
	const back = await restore(
		restored("movie-watch-1", { watchedAt: 1_700_000_000_000, precision: "moment" }),
		restored("i-0123456789abcdef0123456789abcdef", {
			origin: "import",
			importId: "imp-1",
			watchedAt: null,
			precision: "unknown",
		}),
		restored("mig-movie-603"),
	)
	assert.equal(back.status, "applied")
	assert.deepEqual(movieLog().sort(), [
		["i-0123456789abcdef0123456789abcdef", "import", "unknown"],
		["mig-movie-603", "single", "day"],
		["movie-watch-1", "single", "moment"],
	])
	assert.equal(
		logOf(movie).find((r) => r.origin === "import")?.import_id,
		"imp-1",
	)
	assert.deepEqual(back.deleted, ["score-603"])
	assert.equal(onWishlist(movie), true)
})

test("Movie: Undo of the deleted watch that carried the score's id makes the score's watch the member's own again", async () => {
	score(8)
	await movieAct({ type: "rate", score: 8 })
	await movieAct({
		type: "editWatchDate",
		watchId: "score-603",
		when: { precision: "day", day: "2024-05-01" },
	})
	// Deleted: the rule puts a score's watch back under the same id.
	await movieAct({ type: "deleteWatch", watchId: "score-603" })
	assert.deepEqual(movieLog(), [["score-603", "score", "unknown"]])
	const back = await restore(restored("score-603"))
	assert.equal(back.status, "applied")
	assert.deepEqual(movieLog(), [["score-603", "single", "day"]])
	assert.equal(logOf(movie)[0].watched_at, Date.UTC(2024, 4, 1))
})

test("Movie: a row that could not have been in this movie's log is not restored", async () => {
	db.seed("user_import", [{ id: "imp-other", user_id: "member-B", source: "trakt" }])
	const refusedRows: [string, RestoredWatch[]][] = [
		["no row", []],
		["a show's group watch", [restored("g-0193f6a3-64122")]],
		["another movie's score watch", [restored("score-999")]],
		["another movie's migrated watch", [restored("mig-movie-999")]],
		["an id that is none", [restored("x")]],
		[
			"an origin only the server gives",
			[restored("movie-watch-1", { origin: "score" as "single" })],
		],
		[
			"a group origin",
			[restored("movie-watch-1", { origin: "seen" as "single" })],
		],
		["an import without its id", [restored("movie-watch-1", { origin: "import" })]],
		[
			"an import of another member",
			[
				restored("i-0123456789abcdef0123456789abcdef", {
					origin: "import",
					importId: "imp-other",
				}),
			],
		],
		[
			"an import id on a watch marked by hand",
			[restored("movie-watch-1", { importId: "imp-other" })],
		],
		["a day with a time", [restored("movie-watch-1", { watchedAt: Date.UTC(2024, 4, 1, 12) })]],
		["a date marked unknown", [restored("movie-watch-1", { precision: "unknown" })]],
		["a moment without a time", [restored("movie-watch-1", { precision: "moment", watchedAt: null })]],
		["a watch from the future", [restored("movie-watch-1", { watchedAt: midnight(3) })]],
		["recorded in the future", [restored("movie-watch-1", { createdAt: Date.now() + 3 * DAY })]],
		["a precision that is none", [restored("movie-watch-1", { precision: "week" as "day" })]],
		["too many", Array.from({ length: 201 }, (_, i) => restored(`movie-watch-${1000 + i}`))],
		["the same id twice", [restored("movie-watch-1"), restored("movie-watch-1")]],
	]
	for (const [why, rows] of refusedRows) {
		const result = await restore(...rows)
		assert.equal(result.status, "refused", why)
	}
	assert.deepEqual([logOf(movie), stateOf(movie)], [[], null])
	// A show has no watch to restore this way, and one member's rows never land in another's log.
	assert.equal(
		(await act({ type: "restoreWatches", rows: [restored("movie-watch-1")] })).status,
		"refused",
	)
	await restore(restored("movie-watch-1"))
	assert.deepEqual(db.log("member-B"), [])
	assert.equal(db.log(user).length, 1)
})

test("settleMovie is the rule for the paths that write a score themselves: it settles and leaves the cache to the caller", async () => {
	score(9)
	const settled = await settleMovie(user, MOVIE)
	assert.deepEqual(
		[
			settled.seen,
			settled.byScoreAlone,
			settled.inserted,
			settled.state?.state,
		],
		[true, true, ["score-603"], "seen"],
	)
	assert.deepEqual(await settleMovie(user, MOVIE), { ...settled, inserted: [] })
	score(null)
	assert.deepEqual(await settleMovie(user, MOVIE), {
		seen: false,
		state: null,
		byScoreAlone: false,
		inserted: [],
		deleted: ["score-603"],
	})
	assert.equal(resets(), 0)
	// A retired movie id is the movie it was merged into.
	score(null)
	db.seed("user_score", [
		titleRow(
			{ mediaType: "movie", tmdbId: 658039 },
			{ score: 5, review: null },
		),
	])
	await settleMovie(user, 5338654)
	assert.deepEqual(
		db.log(user).map((r) => [r.tmdb_id, r.watch_id]),
		[[658039, "score-658039"]],
	)
})

// ---------------------------------------------------------------------------------------------------------
// A season or a Seen press is one insert
// ---------------------------------------------------------------------------------------------------------

test("a Seen press on a 327-episode show is one insert statement, and its undo one delete", async () => {
	db.seed(
		"episode",
		Array.from({ length: 327 }, (_, index) =>
			episode(
				LONG,
				50_000 + index,
				1 + Math.floor(index / 23),
				1 + (index % 23),
				LONG_AGO,
			),
		),
	)
	const long: TrackedTitle = { mediaType: "show", tmdbId: LONG }
	const [press, sent] = await sentBy(() =>
		act({ type: "pressSeen" }, "press-long-1", long),
	)
	assert.deepEqual(writes(sent), [
		"INSERT user_watch_log",
		"INSERT user_watch_state",
	])
	// Seven to nine statements whatever the number of episodes; resetUserDataCache refreshes in two.
	assert.equal(sent.length, 10)
	const insert = db.statements.find((s) =>
		s.sql.startsWith("INSERT INTO user_watch_log"),
	)
	assert.equal(insert?.params.length, 327 * 15)
	assert.ok(
		insert?.sql.endsWith('ON CONFLICT ("user_id", "watch_id") DO NOTHING'),
	)
	assert.deepEqual(
		[press.inserted.length, logOf(long).length, stateOf(long)?.state],
		[327, 327, "seen"],
	)
	const [undo, undoSent] = await sentBy(() =>
		act({ type: "undoSeen" }, undefined, long),
	)
	assert.deepEqual(writes(undoSent), [
		"DELETE user_watch_log",
		"DELETE user_watch_state",
	])
	assert.deepEqual([undo.deleted.length, logOf(long).length], [327, 0])
	// 1,200 episodes are three statements of 500, 500 and 200 rows.
	db.seed(
		"episode",
		Array.from({ length: 1200 }, (_, index) =>
			episode(9000, 60_000 + index, 1, 1 + index, LONG_AGO),
		),
	)
	const [, many] = await sentBy(() =>
		act({ type: "markSeason", season: 1 }, "group-many-1", {
			mediaType: "show",
			tmdbId: 9000,
		}),
	)
	assert.deepEqual(writes(many), [
		"INSERT user_watch_log",
		"INSERT user_watch_log",
		"INSERT user_watch_log",
		"INSERT user_watch_state",
	])
	assert.equal(db.state(user, "show", 9000)?.state, "seen")
})

// ---------------------------------------------------------------------------------------------------------
// Sent twice, and stopped half way
// ---------------------------------------------------------------------------------------------------------

test("the same action with the same id again writes nothing twice", async () => {
	wantAndNotInterested()
	const again = async (
		event: TrackingAction,
		id: string | undefined,
		title = show,
	) => {
		const first = await act(event, id, title)
		assert.equal(first.status, "applied", event.type)
		const before = stored()
		const second = await act(event, id, title)
		assert.equal(second.status, "applied", event.type)
		assert.deepEqual(stored(), before, event.type)
		assert.deepEqual([second.inserted, second.deleted], [[], []], event.type)
		assert.deepEqual(second.state, first.state, event.type)
	}
	await again({ type: "watch", season: 1, number: 1 }, "tick-s1e1")
	await again({ type: "markSeason", season: 1 }, "group-season-1")
	await again({ type: "unwatch", season: 1, number: 3 }, undefined)
	await again({ type: "pressSeen" }, "press-0001")
	await again({ type: "watch" }, "movie-watch-1", movie)
	await again(
		{ type: "deleteWatch", watchId: "movie-watch-1" },
		undefined,
		movie,
	)
	score(8)
	await again({ type: "rate", score: 8 }, undefined, movie)
	await again({ type: "dismissRatePrompt" }, undefined, short)
	// A press that already stood keeps the state it was pressed from.
	assert.equal(stateOf()?.seen_press_from, "watching")
})

interface Scenario {
	name: string
	title?: TrackedTitle
	setup?: () => Promise<unknown>
	event: TrackingAction
	id?: string
}

const SCENARIOS: Scenario[] = [
	{
		name: "the first tick of a show",
		setup: async () => wantAndNotInterested(),
		event: { type: "watch", season: 1, number: 1 },
		id: "crash-tick-1",
	},
	{
		name: "a tick that does not change the state",
		setup: () => tick(1, 1),
		event: { type: "watch", season: 1, number: 2 },
		id: "crash-tick-2",
	},
	{
		name: "the tick of the last aired episode",
		setup: () => act({ type: "watchUpTo", season: 2, number: 1 }, "setup-upto"),
		event: { type: "watch", season: 2, number: 2 },
		id: "crash-tick-3",
	},
	{
		name: "an untick that does not change the state",
		setup: async () => {
			await tick(1, 1)
			await tick(1, 2)
		},
		event: { type: "unwatch", season: 1, number: 2 },
	},
	{
		name: "the untick of the only watched episode",
		setup: () => tick(1, 1),
		event: { type: "unwatch", season: 1, number: 1 },
	},
	{
		name: "an untick on a Seen show",
		setup: () => act({ type: "pressSeen" }, "setup-press"),
		event: { type: "unwatch", season: 1, number: 1 },
	},
	{
		name: "a Seen press",
		setup: async () => {
			await tick(1, 1)
			await act({ type: "hold" })
			wantAndNotInterested()
		},
		event: { type: "pressSeen" },
		id: "crash-press",
	},
	{
		name: "Seen pressed again",
		setup: async () => {
			await tick(1, 1)
			await act({ type: "pressSeen" }, "setup-press")
		},
		event: { type: "undoSeen" },
	},
	{
		name: "Mark season",
		setup: () => tick(1, 2),
		event: { type: "markSeason", season: 1 },
		id: "crash-season",
	},
	{
		name: "Unmark season",
		setup: () => act({ type: "pressSeen" }, "setup-press"),
		event: { type: "unmarkSeason", season: 2 },
	},
	{
		name: "the delete of the only watch in the log",
		setup: () => tick(1, 1, "setup-tick"),
		event: { type: "deleteWatch", watchId: "setup-tick" },
	},
	{
		name: "Drop",
		setup: async () => {
			await tick(1, 1)
			wantAndNotInterested()
		},
		event: { type: "drop" },
	},
	{
		name: "Watch again",
		setup: () => act({ type: "pressSeen" }, "setup-press"),
		event: { type: "watchAgain" },
	},
	{
		name: "a movie's first watch",
		title: movie,
		setup: async () => wantAndNotInterested(movie),
		event: { type: "watch" },
		id: "crash-movie-1",
	},
	{
		name: "the delete of a movie's last watch",
		title: movie,
		setup: () => movieAct({ type: "watch" }, "setup-movie"),
		event: { type: "deleteWatch", watchId: "setup-movie" },
	},
	{
		name: "rating a movie without a watch",
		title: movie,
		setup: async () => {
			wantAndNotInterested(movie)
			score(8)
		},
		event: { type: "rate", score: 8 },
	},
	{
		name: "a watch of a rated movie",
		title: movie,
		setup: async () => {
			score(8)
			await movieAct({ type: "rate", score: 8 })
		},
		event: { type: "watch" },
		id: "crash-movie-2",
	},
	{
		name: "clearing a movie's score",
		title: movie,
		setup: async () => {
			score(8)
			await movieAct({ type: "rate", score: 8 })
			score(null)
		},
		event: { type: "rate", score: null },
	},
]

for (const scenario of SCENARIOS)
	test(`stopped before any of its statements, then sent again: ${scenario.name} ends as if it had run once`, async () => {
		const run = () =>
			applyTrackingEvent(
				user,
				scenario.title ?? show,
				scenario.event,
				scenario.id,
			)
		await scenario.setup?.()
		const from = db.arrived
		assert.equal((await run()).status, "applied")
		const count = db.arrived - from
		const clean = stored()
		assert.ok(count >= 4)
		test.mock.method(console, "error", () => {})
		for (let stop = 0; stop < count; stop++) {
			fresh()
			await scenario.setup?.()
			const start = db.arrived
			let stopped = false
			db.before = (_, index) => {
				if (index - start !== stop) return
				db.before = undefined
				stopped = true
				throw new Error("the server stopped")
			}
			// The last statements are refreshes whose failure the writer survives; every other stop is an error.
			await run().catch((error) =>
				assert.match(String(error), /the server stopped/),
			)
			assert.equal(stopped, true, `stop ${stop}`)
			const half = JSON.stringify(stored().states)
			await run()
			assert.deepEqual(
				stored(),
				clean,
				`stopped before statement ${stop + 1} of ${count}; left behind ${half}`,
			)
		}
		test.mock.restoreAll()
	})

test("what a stopped action leaves behind, as the data model's table says", async () => {
	const stopAt = (start: string) => {
		db.before = (statement) => {
			if (statement.sql.startsWith(start)) {
				db.before = undefined
				throw new Error("the server stopped")
			}
		}
	}
	// After step 4, the first tick: a log row of a regular episode and no state row.
	stopAt("INSERT INTO user_watch_state")
	await assert.rejects(tick(1, 1, "tick-s1e1"))
	assert.deepEqual([ticks(), stateOf()], [["1.1"], null])
	// The same action with the same ids: step 4 inserts nothing, step 5 writes the row.
	const [retry, sent] = await sentBy(() => tick(1, 1, "tick-s1e1"))
	assert.deepEqual(
		[retry.inserted, stateOf()?.state, logOf().length],
		[[], "watching", 1],
	)
	assert.deepEqual(
		writes(sent),
		["INSERT user_watch_log", "INSERT user_watch_state"].slice(1),
	)
	// After step 4, a Seen press: the group's rows, the state before the press, no standing press.
	stopAt("UPDATE user_watch_state")
	await assert.rejects(act({ type: "pressSeen" }, "press-0001"))
	assert.deepEqual(
		[logOf().length, stateOf()?.state, stateOf()?.seen_press_group],
		[5, "watching", null],
	)
	await act({ type: "pressSeen" }, "press-0001")
	assert.deepEqual(
		[logOf().length, stateOf()?.state, stateOf()?.seen_press_from],
		[5, "seen", "watching"],
	)
	// After step 4, Seen pressed again: the group's rows are gone and the row still says Seen with the press.
	stopAt("UPDATE user_watch_state")
	await assert.rejects(act({ type: "undoSeen" }))
	assert.deepEqual(
		[ticks(), stateOf()?.state, stateOf()?.seen_press_group],
		[["1.1"], "seen", "press-0001"],
	)
	await act({ type: "undoSeen" })
	assert.deepEqual(
		[stateOf()?.state, stateOf()?.seen_press_group],
		["watching", null],
	)
	// After step 5: the state is right, and Want to See is still set on a started show.
	wantAndNotInterested(short)
	stopAt("SELECT created_at, updated_at FROM user_wishlist")
	await assert.rejects(tick(1, 1, "tick-short", short))
	assert.deepEqual(
		[stateOf(short)?.state, onWishlist(short)],
		["watching", true],
	)
	await tick(1, 1, "tick-short", short)
	assert.deepEqual([onWishlist(short), notInterested(short)], [false, false])
})

test("a deleted watch or group that is sent again after its rows went can't move the state, except from Watching with nothing left", async () => {
	await act({ type: "pressSeen" }, "press-0001")
	db.before = (statement) => {
		if (statement.sql.startsWith("UPDATE user_watch_state")) {
			db.before = undefined
			throw new Error("the server stopped")
		}
	}
	await assert.rejects(
		act({ type: "deleteWatch", watchId: "g-press-0001-202" }),
	)
	const retry = await act({ type: "deleteWatch", watchId: "g-press-0001-202" })
	// Run once it would be Watching. Seen with one episode unwatched is a pair the machine allows, so it stays.
	assert.deepEqual(
		[retry.status, stateOf()?.state, logOf().length],
		["applied", "seen", 4],
	)
})

test("the log write that timed out is sent again and inserts once", async () => {
	const { CrateTimeoutError } = await import("../utils/crate.ts")
	let landed = false
	db.before = (statement) => {
		if (statement.sql.startsWith("INSERT INTO user_watch_log") && !landed) {
			landed = true
			throw new CrateTimeoutError(10)
		}
	}
	const result = await act({ type: "pressSeen" }, "press-0001")
	assert.deepEqual(
		[result.status, logOf().length, stateOf()?.state],
		["applied", 5, "seen"],
	)
})

// ---------------------------------------------------------------------------------------------------------
// Two actions on one show
// ---------------------------------------------------------------------------------------------------------

/** Runs `other` in full the first time a statement starts with `at`, which is in the middle of the first action. */
function meanwhile(at: string, other: () => Promise<unknown>) {
	let ran = false
	db.before = async (statement) => {
		if (ran || !statement.sql.startsWith(at)) return
		ran = true
		await other()
	}
}

test("two ticks at once that together are the last aired episodes end Seen, where each alone says Watching", async () => {
	await act({ type: "markSeason", season: 1 }, "setup-season")
	// The other device's tick runs between this one's read and its writes: neither read saw the other's row.
	meanwhile("INSERT INTO user_watch_log", () => tick(2, 2, "other-device"))
	const [first, sent] = await sentBy(() => tick(2, 1, "this-device"))
	// The first round's update found the row changed and wrote nothing; the second round read both ticks.
	assert.equal(
		sent.filter((s) => s === "REFRESH TABLE user_watch_log").length,
		3,
	)
	assert.equal(sent.filter((s) => s === "UPDATE user_watch_state").length, 3)
	assert.deepEqual(
		[first.status, first.row, stateOf()?.state],
		["applied", "2", "seen"],
	)
	assert.deepEqual(ticks(), ["1.1", "1.2", "1.3", "2.1", "2.2"])
	assert.equal(logOf().filter((r) => r.watch_id === "this-device").length, 1)
})

test("two first ticks at once: the second insert of the state row writes nothing and the action starts again", async () => {
	meanwhile("INSERT INTO user_watch_log", () =>
		tick(1, 2, "other-device", short),
	)
	const first = await tick(1, 1, "this-device", short)
	assert.deepEqual(
		[first.row, stateOf(short)?.state, ticks(short)],
		["2", "seen", ["1.1", "1.2"]],
	)
	assert.equal(db.table("user_watch_state").length, 1)
})

test("an action whose show was changed under it is judged again from the new state", async () => {
	// On hold while the only episode is unticked on another device: the row is gone, and there is nothing to hold.
	await tick(1, 1, "tick-s1e1")
	meanwhile("UPDATE user_watch_state", () =>
		act({ type: "unwatch", season: 1, number: 1 }),
	)
	const hold = await act({ type: "hold" })
	assert.deepEqual([hold.status, stateOf(), logOf()], ["refused", null, []])
	// A tick while the show is dropped on another device: the tick's row from the first round is taken out, the
	// event runs again on the dropped show, and the tick resumes it.
	await tick(1, 1, "tick-again")
	meanwhile("UPDATE user_watch_state", () => act({ type: "drop" }))
	const [resumed, sent] = await sentBy(() => tick(1, 2, "tick-s1e2"))
	assert.deepEqual(writes(sent).slice(0, 5), [
		"INSERT user_watch_log",
		"UPDATE user_watch_state",
		"UPDATE user_watch_state",
		"DELETE user_watch_log",
		"INSERT user_watch_log",
	])
	assert.deepEqual(
		[resumed.row, stateOf()?.state, ticks()],
		["3", "watching", ["1.1", "1.2"]],
	)
	// A Seen press while Watch again starts the next pass elsewhere: its rows land in the pass that is current.
	fresh()
	await act({ type: "pressSeen" }, "press-0001")
	airs(episode(SHOW, 206, 2, 6, LONG_AGO))
	meanwhile("UPDATE user_watch_state", () => act({ type: "watchAgain" }))
	const press = await act({ type: "pressSeen" }, "press-0002")
	assert.deepEqual(
		[
			press.status,
			stateOf()?.state,
			stateOf()?.pass,
			stateOf()?.seen_press_from,
		],
		["applied", "seen", 2, "watching"],
	)
	assert.equal(
		logOf().filter((r) => r.group_id === "press-0002" && r.pass === 2).length,
		6,
	)
	assert.equal(logOf().filter((r) => r.pass === 1).length, 5)
})

test("an action that is overtaken every time gives up after three more rounds, and the same request repairs it", async () => {
	await tick(1, 1, "tick-s1e1")
	let overtaken = 0
	db.before = async (statement) => {
		if (!statement.sql.startsWith("UPDATE user_watch_state")) return
		// Another writer touches the row each time, just before this one writes.
		const row = db.table("user_watch_state")[0]
		row._seq_no = Number(row._seq_no) + 1000
		overtaken += 1
	}
	const [, sent] = await sentBy(async () => {
		await assert.rejects(tick(1, 2, "tick-s1e2"), TrackingConflictError)
	})
	assert.equal(overtaken, 4)
	assert.equal(
		sent.filter((s) => s === "REFRESH TABLE user_watch_log").length,
		4,
	)
	assert.equal(resets(), 2, "the member data is reset, because the log changed")
	// What is left is a state one step behind its log rows.
	assert.deepEqual([ticks(), stateOf()?.state], [["1.1", "1.2"], "watching"])
	db.before = undefined
	const retry = await tick(1, 2, "tick-s1e2")
	assert.deepEqual(
		[retry.status, retry.inserted, ticks()],
		["applied", [], ["1.1", "1.2"]],
	)
})

// ---------------------------------------------------------------------------------------------------------
// Aired on the server
// ---------------------------------------------------------------------------------------------------------

test("the server accepts a tick of the episode that airs tomorrow by UTC, and counts it as aired in that step", async () => {
	await act({ type: "watchUpTo", season: 2, number: 2 }, "setup-upto")
	assert.equal(stateOf()?.state, "seen")
	// With tomorrow's episode ticked, everything aired for this step is watched: still Seen (row 4).
	const tomorrow = await tick(2, 3)
	assert.deepEqual(
		[tomorrow.status, tomorrow.row, stateOf()?.state],
		["applied", "4", "seen"],
	)
	assert.equal((await tick(2, 4)).refused, "It has not aired yet.")
	assert.equal((await tick(2, 5)).refused, "It has not aired yet.")
	assert.equal(
		(await tick(1, 9)).refused,
		"The show lists no such episode.",
		"TMDB removed it",
	)
})

test("a group action marks by the device's date, at most one day after the UTC date", async () => {
	const utc = await act({ type: "pressSeen" }, "press-0001")
	assert.equal(utc.inserted.length, 5)
	await act({ type: "undoSeen" })
	const ahead = await act(
		{ type: "pressSeen", today: iso(midnight(1)) },
		"press-0002",
	)
	assert.equal(ahead.inserted.length, 6)
	assert.ok(ahead.inserted.includes("g-press-0002-203"))
	await act({ type: "undoSeen" })
	const far = await act(
		{ type: "pressSeen", today: iso(midnight(30)) },
		"press-0003",
	)
	assert.equal(far.inserted.length, 6)
	await act({ type: "undoSeen" })
	const season = await act(
		{ type: "markSeason", season: 2, today: iso(midnight(1)) },
		"group-season-2",
	)
	assert.deepEqual(season.inserted, [
		"g-group-season-2-201",
		"g-group-season-2-202",
		"g-group-season-2-203",
	])
	const behind = await act(
		{ type: "watchUpTo", season: 1, number: 3, today: iso(midnight(-1)) },
		"group-upto-13",
	)
	assert.equal(behind.inserted.length, 3)
})

// ---------------------------------------------------------------------------------------------------------
// Around the writer
// ---------------------------------------------------------------------------------------------------------

test("without the Not interested table the writer still works", async () => {
	db.before = (statement) => {
		if (statement.sql.includes("user_not_interested"))
			throw new Error("RelationUnknown[Relation 'user_not_interested' unknown]")
	}
	for (const method of ["error"] as const)
		test.mock.method(console, method, () => {})
	db.seed("user_wishlist", [titleRow(show)])
	const result = await tick(1, 1)
	assert.deepEqual(
		[result.status, stateOf()?.state, onWishlist()],
		["applied", "watching", false],
	)
	assert.deepEqual(result.cleared, {
		wantToSeeAddedAt: new Date(1_000).toISOString(),
		notInterested: false,
	})
	test.mock.restoreAll()
})

test("the episode list is read once per show and then comes from the cache", async () => {
	const [list, first] = await sentBy(() => getEpisodeList(SHOW))
	assert.deepEqual(first, ["SELECT episode"])
	assert.equal(list.length, 9, "without the episode TMDB removed")
	assert.deepEqual(list[0], {
		tmdb_id: 100,
		season_number: 0,
		episode_number: 1,
		name: "S0 E1",
		air_date: LONG_AGO,
		runtime: 45,
		still_path: null,
		episode_type: "standard",
		overview: null,
	})
	const [again, second] = await sentBy(() => getEpisodeList(SHOW))
	assert.deepEqual([again, second], [list, []])
	const [, ticked] = await sentBy(() => tick(1, 1))
	assert.ok(!ticked.includes("SELECT episode"))
})

// ---------------------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------------------

test("the show page's reads: the state row in real time, and every watch of the show", async () => {
	assert.deepEqual(await getShowTracking(user, SHOW), { state: null, log: [] })
	await tick(0, 1, "tick-special")
	await tick(1, 1, "tick-s1e1")
	await act({ type: "markSeason", season: 2 }, "group-season-2")
	await tick(1, 1, "tick-short", short)
	const [page, sent] = await sentBy(() => getShowTracking(user, SHOW))
	assert.deepEqual(sent.sort(), [
		"SELECT user_watch_log",
		"SELECT user_watch_state",
	])
	assert.deepEqual(page.state, {
		state: "watching",
		state_changed_at: stateOf()?.state_changed_at,
		pass: 1,
		seen_press_group: null,
		seen_press_from: null,
		rate_prompt_dismissed_at: null,
		seen_question: null,
	})
	assert.deepEqual(
		page.log.map((r) => [
			r.watch_id,
			r.media_type,
			r.tmdb_id,
			r.episode_tmdb_id,
			r.season_number,
			r.episode_number,
			r.origin,
			r.group_id,
			r.pass,
		]),
		[
			["tick-special", "show", SHOW, 100, 0, 1, "single", null, 1],
			["tick-s1e1", "show", SHOW, 101, 1, 1, "single", null, 1],
			[
				"g-group-season-2-201",
				"show",
				SHOW,
				201,
				2,
				1,
				"season",
				"group-season-2",
				1,
			],
			[
				"g-group-season-2-202",
				"show",
				SHOW,
				202,
				2,
				2,
				"season",
				"group-season-2",
				1,
			],
		],
	)
	assert.equal(typeof page.log[0].watched_at, "number")
	assert.equal(page.log[2].watched_at, null)
	// The state row is read by its key, so it is there without a refresh; another member has nothing.
	db.seed("user_watch_state", [])
	assert.deepEqual(await getShowTracking("member-B", SHOW), {
		state: null,
		log: [],
	})
})

test("the movie page's read: the state row and the watch log", async () => {
	await movieAct(
		{ type: "watch", when: { precision: "day", day: "2019-03-12" } },
		"movie-watch-1",
	)
	const page = await getMovieTracking(user, MOVIE)
	assert.equal(page.state?.state, "seen")
	assert.deepEqual(
		page.log.map((r) => [
			r.watch_id,
			r.media_type,
			r.tmdb_id,
			r.watched_at,
			r.watched_at_precision,
			r.origin,
			r.pass,
			r.season_number,
		]),
		[
			[
				"movie-watch-1",
				"movie",
				MOVIE,
				Date.UTC(2019, 2, 12),
				"day",
				"single",
				1,
				null,
			],
		],
	)
})

test("the grouped query and the states give the member data entry of every title with a state", async () => {
	assert.deepEqual(await getWatchState(user), {})
	// A show in its second pass, a show with only a special watched, a movie watched twice, a rated movie, a
	// dropped show with nothing watched, and another member's show.
	await act({ type: "pressSeen" }, "press-0001")
	await act({ type: "watchAgain" })
	await tick(1, 1, "pass2-s1e1")
	await tick(1, 3, "pass2-s1e3")
	await tick(0, 1, "tick-special", short)
	await movieAct(
		{ type: "watch", when: { precision: "day", day: "2019-03-12" } },
		"movie-watch-1",
	)
	await movieAct({ type: "watch" }, "movie-watch-2")
	const rated: TrackedTitle = { mediaType: "movie", tmdbId: 680 }
	db.seed("user_score", [titleRow(rated, { score: 9, review: null })])
	await act({ type: "rate", score: 9 }, undefined, rated)
	await act({ type: "drop" }, undefined, { mediaType: "show", tmdbId: 40_000 })
	await applyTrackingEvent(
		"member-B",
		show,
		{ type: "watch", season: 1, number: 1 },
		"other-member",
	)

	const [entries, sent] = await sentBy(() => getWatchState(user))
	assert.deepEqual(sent.sort(), [
		"SELECT user_watch_log",
		"SELECT user_watch_state",
	])
	const grouped = db.statements.find((s) => s.sql.includes("GROUP BY"))
	assert.deepEqual(grouped?.params, [user])
	assert.ok(
		grouped?.sql.endsWith(
			"FROM user_watch_log WHERE user_id = ? GROUP BY tmdb_id, media_type, pass",
		),
	)
	const second = logOf().find((r) => r.watch_id === "pass2-s1e3")
		?.watched_at as number
	const scoreAt = logOf(rated)[0].created_at as number
	assert.deepEqual(entries, {
		[`show-${SHOW}`]: {
			state: "watching",
			watchedAt: new Date(second),
			precision: "moment",
			count: 7,
			pass: 2,
			episodesWatched: 2,
			furthest: [1, 3],
			lastActivityAt: new Date(second),
		},
		[`movie-${MOVIE}`]: {
			state: "seen",
			watchedAt: new Date(
				logOf(movie).find((r) => r.watch_id === "movie-watch-2")
					?.watched_at as number,
			),
			precision: "moment",
			count: 2,
			pass: 1,
			episodesWatched: 0,
			furthest: null,
			lastActivityAt: new Date(
				logOf(movie).find((r) => r.watch_id === "movie-watch-2")
					?.watched_at as number,
			),
		},
		"movie-680": {
			state: "seen",
			watchedAt: null,
			precision: "unknown",
			count: 1,
			pass: 1,
			episodesWatched: 0,
			furthest: null,
			lastActivityAt: new Date(scoreAt),
		},
		"show-40000": {
			state: "dropped",
			watchedAt: null,
			precision: "unknown",
			count: 0,
			pass: 1,
			episodesWatched: 0,
			furthest: null,
			lastActivityAt: null,
		},
	})
	// The totals also know the show of which only a special was watched, and what the entry leaves out.
	const totals = await getWatchTotals(user)
	assert.deepEqual([...totals.keys()].sort(), [
		"movie-603",
		"movie-680",
		"show-1399",
		"show-40000",
		"show-66732",
	])
	assert.deepEqual(totals.get(`show-${SHORT}`), {
		state: "not_started",
		pass: 1,
		count: 1,
		episodesWatched: 0,
		furthest: null,
		startedEver: false,
		firstWatchedAt: logOf(short)[0].watched_at,
		watchedAt: logOf(short)[0].watched_at,
		precision: "moment",
		lastActivityAt: logOf(short)[0].watched_at,
	})
	assert.deepEqual(
		[
			totals.get(`show-${SHOW}`)?.startedEver,
			totals.get(`movie-${MOVIE}`)?.firstWatchedAt,
		],
		[true, Date.UTC(2019, 2, 12)],
	)
})
