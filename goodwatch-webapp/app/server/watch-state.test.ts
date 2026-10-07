// The readers and writers of Seen on the watch state (docs/implementation/tracking/data-model.md, "Who reads
// user_watch_history today"): the member data map, the viewer context, the readers with their own SQL, today's Seen
// button, "I watched it", and every path that writes a score. Against the in-memory Crate of the tracking tests,
// which has no `user_watch_history`: a statement that names the retired table fails the test.

// CommonJS packages are loaded before the alias hook, which would otherwise resolve their own relative requires.
import "node-crate"
import "ioredis"
import "react"
import "@remix-run/node"
import "zod"
import ts from "typescript"
import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import * as nodeModule from "node:module"
import { afterEach, beforeEach, test } from "node:test"
import { CacheTestRedis } from "../utils/cache-test-redis.ts"
import { FakeTrackingCrate } from "./tracking-fake-crate.ts"

// The same stubs as userData.test.ts, and an auth that answers with the member of the test. Routes are `.tsx`
// files, which Node can't strip types from, so the two this file calls are transpiled here.
const user = "6f1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e"
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
			source = `const user = { id: ${JSON.stringify(user)} }
				export const getUserIdFromRequest = async () => user.id
				export const getAuthFromRequest = async () => ({ user, headers: new Headers() })`
		else if (url.endsWith("/title-snapshot/format.server.ts"))
			source = `${readFileSync(new URL(url), "utf8")}\nexport const getTitleSnapshot = () => null`
		else if (
			url.endsWith("/imdb-import/file.server.ts") ||
			url.endsWith("/routes/api.update-watch-history.tsx")
		)
			source = readFileSync(new URL(url), "utf8")
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
const { titleKey } = await import("../utils/title-key.ts")
const { guestUserData } = await import("../utils/guest-progress.ts")
const { applyTrackingEvent, deleteTrackingData, settleMovies } = await import(
	"./tracking.server.ts"
)
const { getUserData, resetUserDataCache } = await import("./userData.server.ts")
const { getMemberViewerContext } = await import("./viewer.server.ts")
const { updateScores } = await import("./scores.server.ts")
const { updateWishList } = await import("./wishList.server.ts")
const { finishTitle, undoFinishTitle } = await import(
	"./finish-title.server.ts"
)
const { settleImportedMovies } = await import("./imdb-import/apply.server.ts")
const { getUserExcludeItems } = await import("./utils/recommend.ts")
const { getSmartTitlesForUser } = await import("./smart-titles.server.ts")
const { watchedTypeJoin } = await import("./discover.server.ts")
const seenRoute = await import("../routes/api.update-watch-history.tsx")
const transferRoute = await import("../routes/api.import-guest-interactions.ts")
type TrackedTitle = import("./tracking.server.ts").TrackedTitle
type TrackingAction = import("./tracking.server.ts").TrackingAction

class Redis extends CacheTestRedis {
	async set(key: string, value: string) {
		this.values.set(key, value)
	}
}

type Row = Record<string, unknown>
let db: FakeTrackingCrate
let redis: Redis

const LONG_AGO = Date.UTC(2020, 0, 1)
const TOMORROW = (Math.floor(Date.now() / 86_400_000) + 1) * 86_400_000
const SHOW = 1399
const NO_LIST = 4242
const MOVIE = 603
const show: TrackedTitle = { mediaType: "show", tmdbId: SHOW }
const noList: TrackedTitle = { mediaType: "show", tmdbId: NO_LIST }
const movie: TrackedTitle = { mediaType: "movie", tmdbId: MOVIE }

const episode = (
	id: number,
	season: number,
	number: number,
	airDate: number,
): Row => ({
	show_id: SHOW,
	tmdb_id: id,
	season_number: season,
	episode_number: number,
	name: `S${season} E${number}`,
	air_date: airDate,
	runtime: 45,
	still_path: null,
	episode_type: "standard",
	removed_at: null,
})

/** SHOW: a special, three aired episodes in two seasons, and one that airs tomorrow. NO_LIST has no episode. */
beforeEach(() => {
	db = new FakeTrackingCrate()
	redis = new Redis()
	setCrateClientForTest(db)
	setRedisClusterForTest(redis)
	resetPendingResetsForTest()
	made = 0
	db.seed("episode", [
		episode(100, 0, 1, LONG_AGO),
		episode(101, 1, 1, LONG_AGO),
		episode(102, 1, 2, LONG_AGO),
		episode(201, 2, 1, LONG_AGO),
		episode(202, 2, 2, TOMORROW),
	])
})
afterEach(() => {
	setCrateClientForTest(null)
	setRedisClusterForTest(null)
	resetPendingResetsForTest()
})

let made = 0
const newId = () => `act-${String(++made).padStart(6, "0")}`
const act = (title: TrackedTitle, event: TrackingAction, id = newId()) =>
	applyTrackingEvent(user, title, event, id)

const stateOf = (title: TrackedTitle, of = user) =>
	db.state(of, title.mediaType, title.tmdbId)
const logOf = (title: TrackedTitle) =>
	db
		.log(user)
		.filter(
			(r) => r.media_type === title.mediaType && r.tmdb_id === title.tmdbId,
		)
const watches = (title: TrackedTitle) =>
	logOf(title).map((r) => [r.watch_id, r.origin, r.watched_at_precision])
const ticks = (title: TrackedTitle) =>
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
const has = (table: string, title: TrackedTitle) =>
	db
		.table(table)
		.some(
			(r) =>
				r.user_id === user &&
				r.tmdb_id === title.tmdbId &&
				r.media_type === title.mediaType,
		)
const onWishlist = (title: TrackedTitle) => has("user_wishlist", title)
const notInterested = (title: TrackedTitle) =>
	has("user_not_interested", title)
const scored = (title: TrackedTitle) => has("user_score", title)
const mediaKey = (title: TrackedTitle) =>
	`${title.mediaType}-${title.tmdbId}` as const
const rate = (title: TrackedTitle, score: number | null, byHand?: boolean) =>
	updateScores({
		user_id: user,
		tmdb_id: title.tmdbId,
		media_type: title.mediaType,
		score: score as 8 | null,
		by_hand: byHand,
	})
const memberData = () => getUserData({ user_id: user })
const post = (body: unknown) =>
	new Request("http://goodwatch.test/", {
		method: "POST",
		body: JSON.stringify(body),
	})

/** Today's Seen button, through its endpoint. */
const press = async (
	title: TrackedTitle,
	action: "add" | "remove",
	actionId?: string,
): Promise<string> => {
	const result = await seenRoute.action({
		request: post({
			tmdb_id: title.tmdbId,
			media_type: title.mediaType,
			action,
			action_id: actionId,
		}),
		params: {},
		context: {},
	})
	return (result as { status: string }).status
}

// ---------------------------------------------------------------------------------------------------------
// The member data map
// ---------------------------------------------------------------------------------------------------------

test("the member data map holds one watchState entry per title with a state, built from the states and the grouped query", async () => {
	await act(movie, { type: "watch" }, "movie-watch-1")
	await act(show, { type: "watch", season: 1, number: 1 })
	await act(show, { type: "watch", season: 1, number: 2 })
	// A show that only remembers a prompt: Not started, so it has no entry.
	await rate(noList, 8)
	assert.equal(stateOf(noList)?.state, "not_started")

	db.statements.length = 0
	const data = await memberData()
	const read = db.statements.map((s) => s.sql)
	assert.equal(read.length, 7)
	assert.ok(
		read.includes(
			"SELECT tmdb_id, media_type, state, pass FROM user_watch_state WHERE user_id = ? AND state <> 'not_started'",
		),
	)
	assert.equal(
		read.filter((sql) =>
			sql.endsWith(
				"FROM user_watch_log WHERE user_id = ? GROUP BY tmdb_id, media_type, pass",
			),
		).length,
		1,
	)

	assert.deepEqual(Object.keys(data.watchState).sort(), [
		"movie-603",
		"show-1399",
	])
	assert.equal("watched" in data, false)
	const seenMovie = data.watchState["movie-603"]
	assert.ok(seenMovie.watchedAt instanceof Date)
	assert.deepEqual(
		{ ...seenMovie, watchedAt: null, lastActivityAt: null },
		{
			state: "seen",
			watchedAt: null,
			precision: "moment",
			count: 1,
			pass: 1,
			episodesWatched: 0,
			furthest: null,
			lastActivityAt: null,
		},
	)
	const watching = data.watchState["show-1399"]
	assert.deepEqual(
		{ ...watching, watchedAt: null, lastActivityAt: null },
		{
			state: "watching",
			watchedAt: null,
			precision: "moment",
			count: 2,
			pass: 1,
			episodesWatched: 2,
			furthest: [1, 2],
			lastActivityAt: null,
		},
	)

	// A cache hit gives the same entries, with dates again.
	db.statements.length = 0
	const again = await memberData()
	assert.equal(db.statements.length, 0)
	assert.deepEqual(again, data)
	assert.ok(again.watchState["show-1399"].lastActivityAt instanceof Date)
})

test("a Seen press on a show gives one entry with the progress, never a row per episode", async () => {
	assert.equal(await press(show, "add"), "success")
	const entry = (await memberData()).watchState["show-1399"]
	assert.deepEqual(entry, {
		state: "seen",
		// The press's watches have no date. They count as activity at the time of the press.
		watchedAt: null,
		precision: "unknown",
		count: 3,
		pass: 1,
		episodesWatched: 3,
		furthest: [2, 1],
		lastActivityAt: entry.lastActivityAt,
	})
	assert.ok(entry.lastActivityAt instanceof Date)
})

test("the cache reset refreshes the two tracking tables and no longer the retired table", async () => {
	db.statements.length = 0
	await resetUserDataCache({ user_id: user })
	assert.deepEqual(db.sent("REFRESH"), [
		"REFRESH TABLE user_not_interested",
		"REFRESH TABLE user_score, user_wishlist, user_watch_log, user_watch_state, user_favorite, user_skipped",
	])
})

test("a guest has an empty watchState, on the server and in the browser", async () => {
	db.statements.length = 0
	assert.deepEqual((await getUserData({})).watchState, {})
	assert.equal(db.statements.length, 0)
	const guest = guestUserData([
		{ tmdb_id: MOVIE, media_type: "movie", type: "score", score: 8, timestamp: 1 },
	])
	assert.deepEqual(guest.watchState, {})
	assert.equal(guest.scores["movie-603"].score, 8)
})

// ---------------------------------------------------------------------------------------------------------
// The viewer context
// ---------------------------------------------------------------------------------------------------------

test("viewer.seen is scored titles and titles in any state but Not started; Dropped joins the always hidden set", async () => {
	const ratedOnly: TrackedTitle = { mediaType: "show", tmdbId: 500 }
	const dropped: TrackedTitle = { mediaType: "show", tmdbId: 700 }
	const prompted: TrackedTitle = { mediaType: "show", tmdbId: 800 }
	const hiddenMovie: TrackedTitle = { mediaType: "movie", tmdbId: 900 }
	const stateRow = (title: TrackedTitle, state: string, rest: Row = {}): Row =>
		titleRow(title, {
			state,
			state_changed_at: 1_000,
			pass: 1,
			seen_press_group: null,
			seen_press_from: null,
			rate_prompt_dismissed_at: null,
			seen_question: null,
			...rest,
		})
	// Rated by the quiz, never started: a score and no state.
	await rate(ratedOnly, 7, false)
	assert.equal(stateOf(ratedOnly), null)
	// Watching.
	await act(show, { type: "watch", season: 1, number: 1 })
	// Seen movie.
	await act(movie, { type: "watch" })
	// Dropped can't be reached from the interface yet. A Not started row only remembers a prompt.
	db.seed("user_watch_state", [
		stateRow(dropped, "dropped"),
		stateRow(prompted, "not_started", { seen_question: "answered" }),
	])
	db.seed("user_not_interested", [titleRow(hiddenMovie)])
	await resetUserDataCache({ user_id: user })

	const ctx = await getMemberViewerContext(user, "US")
	const key = (title: TrackedTitle) => titleKey(title.mediaType, title.tmdbId)
	assert.deepEqual(
		[...ctx.seen].sort(),
		[ratedOnly, show, movie, dropped].map(key).sort(),
	)
	assert.equal(ctx.seen.has(key(prompted)), false)
	assert.deepEqual([...ctx.hidden].sort(), [dropped, hiddenMovie].map(key).sort())
	// The mark a card shows stays what the member marked.
	assert.deepEqual([...ctx.notInterested], [key(hiddenMovie)])
})

// ---------------------------------------------------------------------------------------------------------
// The readers with their own SQL
// ---------------------------------------------------------------------------------------------------------

/** Records what a reader sends and answers with no rows. */
function recording(): string[] {
	const sent: string[] = []
	setCrateClientForTest({
		execute: async (sql: string) => {
			sent.push(sql.trim().replace(/\s+/g, " "))
			return { json: [], rowcount: 0 }
		},
	})
	return sent
}

test("the similar-title seeds exclude every title with a state but Not started", async () => {
	const sent = recording()
	await getUserExcludeItems(user)
	const states = sent.filter((sql) => sql.includes("user_watch_state"))
	assert.deepEqual(states, [
		"SELECT uw.tmdb_id, uw.media_type FROM user_watch_state uw INNER JOIN movie m ON uw.tmdb_id = m.tmdb_id AND uw.media_type = 'movie' WHERE uw.user_id = ? AND uw.state <> 'not_started' AND m.essence_tags IS NOT NULL UNION ALL SELECT uw.tmdb_id, uw.media_type FROM user_watch_state uw INNER JOIN show s ON uw.tmdb_id = s.tmdb_id AND uw.media_type = 'show' WHERE uw.user_id = ? AND uw.state <> 'not_started' AND s.essence_tags IS NOT NULL",
	])
	assert.equal(sent.filter((sql) => sql.includes("user_watch_history")).length, 0)
})

test("the quiz titles leave out every title with a state but Not started", async () => {
	const sent = recording()
	await getSmartTitlesForUser({
		userId: user,
		count: 5,
		locale: { country: "US", language: "en" },
	})
	const titles = sent.filter((sql) => sql.includes("goodwatch_overall_score"))
	assert.equal(titles.length, 2)
	assert.ok(
		titles[0].includes(
			"AND m.tmdb_id NOT IN ( SELECT tmdb_id FROM user_watch_state WHERE user_id = ? AND media_type = 'movie' AND state <> 'not_started' )",
		),
		titles[0],
	)
	assert.ok(
		titles[1].includes(
			"AND s.tmdb_id NOT IN ( SELECT tmdb_id FROM user_watch_state WHERE user_id = ? AND media_type = 'show' AND state <> 'not_started' )",
		),
		titles[1],
	)
	assert.equal(sent.filter((sql) => sql.includes("user_watch_history")).length, 0)
})

test("the legacy Discover filter: watched is the state Seen, didn't watch is no state but Not started", () => {
	const flat = (sql: string) => sql.trim().replace(/\s+/g, " ")
	const watched = watchedTypeJoin("watched")
	assert.equal(
		flat(watched?.join ?? ""),
		"INNER JOIN user_watch_state uws ON uws.user_id = ? AND uws.tmdb_id = m.tmdb_id AND uws.media_type = ? AND uws.state = 'seen'",
	)
	assert.equal(watched?.condition, null)
	const not = watchedTypeJoin("didnt-watch")
	assert.equal(
		flat(not?.join ?? ""),
		"LEFT JOIN user_watch_state uws ON uws.user_id = ? AND uws.tmdb_id = m.tmdb_id AND uws.media_type = ? AND uws.state <> 'not_started'",
	)
	assert.equal(not?.condition, "uws.user_id IS NULL")
	assert.match(watchedTypeJoin("want-to-watch")?.join ?? "", /user_wishlist/)
	assert.equal(watchedTypeJoin("else" as "watched"), null)
})

test("no server module, route, hook or component names the retired table, except account deletion", () => {
	const app = new URL("../", import.meta.url)
	const named: string[] = []
	const walk = (dir: URL) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const url = new URL(
				entry.isDirectory() ? `${entry.name}/` : entry.name,
				dir,
			)
			if (entry.isDirectory()) walk(url)
			else if (
				/\.tsx?$/.test(entry.name) &&
				!entry.name.endsWith(".test.ts") &&
				readFileSync(url, "utf8").includes("user_watch_history")
			)
				named.push(url.href.slice(app.href.length))
		}
	}
	walk(app)
	// The fake says in a comment that it has no such table. Account deletion still clears the backup.
	assert.deepEqual(named.sort(), [
		"server/tracking-fake-crate.ts",
		"server/tracking.server.ts",
	])
})

// ---------------------------------------------------------------------------------------------------------
// Today's Seen button, through its endpoint
// ---------------------------------------------------------------------------------------------------------

test("Seen on a movie records one watch, clears Want to See and Not interested, and one more press removes it", async () => {
	db.seed("user_wishlist", [titleRow(movie)])
	db.seed("user_not_interested", [titleRow(movie)])
	const before = Date.now()
	assert.equal(await press(movie, "add", "press-movie-0001"), "success")
	assert.deepEqual(watches(movie), [["press-movie-0001", "single", "moment"]])
	const [watch] = logOf(movie)
	assert.ok(Number(watch.watched_at) >= before)
	assert.equal(stateOf(movie)?.state, "seen")
	assert.equal(onWishlist(movie), false)
	assert.equal(notInterested(movie), false)
	assert.equal((await memberData()).watchState["movie-603"].state, "seen")

	// The same press sent again, and a second "mark", record nothing more.
	assert.equal(await press(movie, "add", "press-movie-0001"), "success")
	assert.equal(await press(movie, "add"), "success")
	assert.equal(logOf(movie).length, 1)

	assert.equal(await press(movie, "remove"), "success")
	assert.deepEqual(logOf(movie), [])
	assert.equal(stateOf(movie), null)
	assert.equal((await memberData()).watchState["movie-603"], undefined)
	// Nothing is left to remove.
	assert.equal(await press(movie, "remove"), "failed")
})

test("Seen on a show is the Seen press: a watch for every aired regular episode, and one more press takes it back", async () => {
	db.seed("user_wishlist", [titleRow(show)])
	assert.equal(await press(show, "add", "press-show-0001"), "success")
	// Not the special, and not the episode that airs tomorrow.
	assert.deepEqual(ticks(show), ["1.1", "1.2", "2.1"])
	assert.ok(
		logOf(show).every(
			(r) =>
				r.origin === "seen" &&
				r.group_id === "press-show-0001" &&
				r.watched_at === null,
		),
	)
	const row = stateOf(show)
	assert.deepEqual(
		[row?.state, row?.seen_press_group, row?.seen_press_from],
		["seen", "press-show-0001", "not_started"],
	)
	assert.equal(onWishlist(show), false)
	// A second "mark" on a Seen show writes nothing.
	assert.equal(await press(show, "add"), "success")
	assert.equal(logOf(show).length, 3)

	assert.equal(await press(show, "remove"), "success")
	assert.deepEqual(logOf(show), [])
	assert.equal(stateOf(show), null)
	assert.equal((await memberData()).watchState["show-1399"], undefined)
	assert.equal(await press(show, "remove"), "failed")
})

test("Seen on a show without an episode list still makes it Seen, with no watch", async () => {
	assert.equal(await press(noList, "add"), "success")
	assert.deepEqual(logOf(noList), [])
	assert.equal(stateOf(noList)?.state, "seen")
	const entry = (await memberData()).watchState["show-4242"]
	assert.deepEqual(
		[entry.state, entry.count, entry.episodesWatched],
		["seen", 0, 0],
	)
	assert.equal(await press(noList, "remove"), "success")
	assert.equal(stateOf(noList), null)
})

test("without the episode catalog's table a show can still be marked Seen and rated", async (t) => {
	t.mock.method(console, "error", () => {})
	db.before = (statement) => {
		if (statement.sql.includes("FROM episode"))
			throw new Error("RelationUnknown[Relation 'episode' unknown]")
	}
	assert.equal(await press(show, "add"), "success")
	assert.equal(stateOf(show)?.state, "seen")
	assert.deepEqual(logOf(show), [])
	assert.deepEqual(await rate(show, 8), { status: "success" })
	assert.equal(await press(show, "remove"), "success")
	assert.equal(stateOf(show), null)
})

test("Seen pressed on a Watching show, then again, returns to Watching with the episode ticked before", async () => {
	await act(show, { type: "watch", season: 1, number: 1 }, "tick-s1e1")
	assert.equal(stateOf(show)?.state, "watching")
	assert.equal(await press(show, "add"), "success")
	assert.equal(stateOf(show)?.state, "seen")
	assert.deepEqual(ticks(show), ["1.1", "1.2", "2.1"])
	assert.equal(await press(show, "remove"), "success")
	assert.equal(stateOf(show)?.state, "watching")
	assert.deepEqual(
		logOf(show).map((r) => r.watch_id),
		["tick-s1e1"],
	)
})

test("a rated movie stays Seen when Seen is pressed again: the watch its score owns can't be removed", async () => {
	await rate(movie, 8)
	assert.deepEqual(watches(movie), [["score-603", "score", "unknown"]])
	assert.equal(await press(movie, "remove"), "failed")
	assert.deepEqual(watches(movie), [["score-603", "score", "unknown"]])
	// Marking it Seen records the member's watch, which replaces the score's. Removing that brings the score's back.
	assert.equal(await press(movie, "add", "press-movie-0002"), "success")
	assert.deepEqual(watches(movie), [["press-movie-0002", "single", "moment"]])
	assert.equal(await press(movie, "remove"), "success")
	assert.deepEqual(watches(movie), [["score-603", "score", "unknown"]])
	assert.equal(stateOf(movie)?.state, "seen")
})

test("a movie left Seen by a score's watch without a score is taken back by the Seen button", async () => {
	// What the build before the watch log leaves when it clears a score between the migration and its second run.
	await rate(movie, 8)
	dropScore(movie)
	assert.deepEqual(watches(movie), [["score-603", "score", "unknown"]])
	await memberData()
	assert.equal(await press(movie, "remove"), "success")
	assert.deepEqual(logOf(movie), [])
	assert.equal(stateOf(movie), null)
	assert.equal((await memberData()).watchState["movie-603"], undefined)
})

test("the Seen endpoint refuses a request without a member's title", async () => {
	assert.equal(
		await press({ mediaType: "person" as "movie", tmdbId: 1 }, "add"),
		"failed",
	)
	assert.equal(await press({ mediaType: "movie", tmdbId: 0 }, "add"), "failed")
	assert.equal(db.table("user_watch_log").length, 0)
})

// ---------------------------------------------------------------------------------------------------------
// "I watched it" and its undo
// ---------------------------------------------------------------------------------------------------------

const ADDED = Date.UTC(2026, 5, 1, 12)
const wishedAt = (title: TrackedTitle) =>
	db
		.table("user_wishlist")
		.find((r) => r.tmdb_id === title.tmdbId && r.media_type === title.mediaType)
		?.created_at

test("\"I watched it\" on a movie records a watch and takes it off the Wishlist; Undo removes that watch and restores Want to See with its added-at", async () => {
	db.seed("user_wishlist", [titleRow(movie, { created_at: ADDED })])
	const undo = await finishTitle(user, titleKey("movie", MOVIE))
	assert.equal(undo.addedAt, new Date(ADDED).toISOString())
	assert.ok(undo.watchId)
	assert.deepEqual(watches(movie), [[undo.watchId, "single", "moment"]])
	assert.equal(onWishlist(movie), false)
	assert.equal((await memberData()).watchState["movie-603"].state, "seen")

	await undoFinishTitle(user, undo)
	assert.deepEqual(logOf(movie), [])
	assert.equal(stateOf(movie), null)
	assert.equal(wishedAt(movie), ADDED)
	const data = await memberData()
	assert.equal(data.watchState["movie-603"], undefined)
	assert.equal(data.wishlist["movie-603"].createdAt.getTime(), ADDED)
})

test("\"I watched it\" on a show is a Seen press, and Undo takes exactly that press back", async () => {
	db.seed("user_wishlist", [titleRow(show, { created_at: ADDED })])
	const undo = await finishTitle(user, titleKey("show", SHOW))
	assert.equal(stateOf(show)?.seen_press_group, undo.watchId)
	assert.deepEqual(ticks(show), ["1.1", "1.2", "2.1"])
	assert.equal(onWishlist(show), false)

	await undoFinishTitle(user, undo)
	assert.deepEqual(logOf(show), [])
	assert.equal(stateOf(show), null)
	assert.equal(wishedAt(show), ADDED)
})

test("\"I watched it\" on a title that was Seen already records nothing, and its Undo leaves the watch", async () => {
	await act(movie, { type: "watch" }, "earlier-watch")
	db.seed("user_wishlist", [titleRow(movie, { created_at: ADDED })])
	const undo = await finishTitle(user, titleKey("movie", MOVIE))
	assert.deepEqual(
		[undo.watchId, undo.addedAt],
		[null, new Date(ADDED).toISOString()],
	)
	assert.equal(onWishlist(movie), false)
	await undoFinishTitle(user, undo)
	assert.deepEqual(
		logOf(movie).map((r) => r.watch_id),
		["earlier-watch"],
	)
	assert.equal(wishedAt(movie), ADDED)
})

test("Undo of \"I watched it\" leaves a watch recorded since, and an Undo from the build before restores Want to See only", async () => {
	const undo = await finishTitle(user, titleKey("movie", MOVIE))
	await act(movie, { type: "watch", when: { precision: "unknown" } }, "later-watch")
	await undoFinishTitle(user, undo)
	assert.deepEqual(
		logOf(movie).map((r) => r.watch_id),
		["later-watch"],
	)
	// The earlier build's Undo names a row of the retired table by its time.
	await undoFinishTitle(user, {
		key: titleKey("movie", MOVIE),
		addedAt: new Date(ADDED).toISOString(),
	})
	assert.equal(logOf(movie).length, 1)
	assert.equal(wishedAt(movie), ADDED)
})

// ---------------------------------------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------------------------------------

test("rating a movie that has no watch records the score's watch, makes it Seen, and clears Want to See and Not interested", async () => {
	db.seed("user_wishlist", [titleRow(movie)])
	db.seed("user_not_interested", [titleRow(movie)])
	assert.deepEqual(await rate(movie, 8), { status: "success" })
	assert.deepEqual(watches(movie), [["score-603", "score", "unknown"]])
	assert.equal(stateOf(movie)?.state, "seen")
	assert.equal(onWishlist(movie), false)
	assert.equal(notInterested(movie), false)
	const data = await memberData()
	assert.equal(data.scores["movie-603"].score, 8)
	assert.deepEqual(
		[
			data.watchState["movie-603"].state,
			data.watchState["movie-603"].count,
			data.watchState["movie-603"].watchedAt,
		],
		["seen", 1, null],
	)
	// Changing the score writes no second watch.
	await rate(movie, 6)
	assert.equal(logOf(movie).length, 1)
})

test("rating a movie that has a watch writes no watch and leaves Want to See alone", async () => {
	await act(movie, { type: "watch" }, "own-watch")
	db.seed("user_wishlist", [titleRow(movie)])
	await rate(movie, 9)
	assert.deepEqual(watches(movie), [["own-watch", "single", "moment"]])
	assert.equal(onWishlist(movie), true)
})

test("clearing a movie's score removes the watch the score owns, and never a watch the member logged", async () => {
	await rate(movie, 8)
	await rate(movie, null)
	assert.equal(scored(movie), false)
	assert.deepEqual(logOf(movie), [])
	assert.equal(stateOf(movie), null)
	assert.equal((await memberData()).watchState["movie-603"], undefined)

	await act(movie, { type: "watch" }, "own-watch")
	await rate(movie, 8)
	await rate(movie, null)
	assert.deepEqual(watches(movie), [["own-watch", "single", "moment"]])
	assert.equal(stateOf(movie)?.state, "seen")
})

test("rating a show records no watch and changes no state; a score by hand on a Not started show opens the question", async () => {
	db.seed("user_wishlist", [titleRow(show)])
	db.seed("user_not_interested", [titleRow(show)])
	await rate(show, 8)
	assert.deepEqual(logOf(show), [])
	assert.deepEqual(
		[stateOf(show)?.state, stateOf(show)?.seen_question],
		["not_started", "open"],
	)
	// A score never takes a show off the Wishlist. It does take it off Not interested.
	assert.equal(onWishlist(show), true)
	assert.equal(notInterested(show), false)
	const data = await memberData()
	assert.equal(data.scores["show-1399"].score, 8)
	assert.equal(data.watchState["show-1399"], undefined)

	// A Watching show stays Watching.
	await act(noList, { type: "pressSeen" })
	await rate(noList, 7)
	assert.equal(stateOf(noList)?.state, "seen")
	assert.equal(stateOf(noList)?.seen_question, null)
})

test("a taste quiz score records the score's watch for a movie, and asks no question about a show", async () => {
	await rate(movie, 8, false)
	assert.deepEqual(watches(movie), [["score-603", "score", "unknown"]])
	assert.equal(stateOf(movie)?.state, "seen")
	await rate(show, 8, false)
	assert.equal(scored(show), true)
	assert.equal(stateOf(show), null)
	assert.deepEqual(logOf(show), [])
})

// ---------------------------------------------------------------------------------------------------------
// The guest transfer and the IMDb import
// ---------------------------------------------------------------------------------------------------------

test("a transferred guest score records the score's watch for a movie and nothing for a show", async () => {
	db.seed("user_wishlist", [titleRow(movie)])
	const response = await transferRoute.action({
		request: post({
			id: "0b6f5e9a-1c2d-4e3f-9a4b-5c6d7e8f9a0b",
			accountId: user,
			changes: [
				{
					id: "c1",
					kind: "score",
					tmdb_id: MOVIE,
					media_type: "movie",
					value: "8",
					before: null,
				},
				{
					id: "c2",
					kind: "score",
					tmdb_id: SHOW,
					media_type: "show",
					value: "9",
					before: null,
				},
			],
		}),
		params: {},
		context: {},
	})
	assert.equal(response.status, 200)
	assert.deepEqual(await response.json(), {
		success: true,
		completed: ["c1", "c2"],
	})
	assert.equal(scored(movie), true)
	assert.deepEqual(watches(movie), [["score-603", "score", "unknown"]])
	assert.equal(stateOf(movie)?.state, "seen")
	assert.equal(onWishlist(movie), false)
	assert.equal(scored(show), true)
	assert.deepEqual(logOf(show), [])
	assert.equal(stateOf(show), null)
	const data = await memberData()
	assert.equal(data.watchState["movie-603"].state, "seen")
	assert.equal(data.watchState["show-1399"], undefined)
})

const scoreRow = (title: TrackedTitle, score: number): Row =>
	titleRow(title, { score, review: null })
const dropScore = (title: TrackedTitle) =>
	db.rows.set(
		"user_score",
		db
			.table("user_score")
			.filter(
				(r) =>
					!(r.tmdb_id === title.tmdbId && r.media_type === title.mediaType),
			),
	)

test("an IMDb import's scores record the score's watch for its movies, and its undo removes it", async () => {
	const fresh: TrackedTitle = { mediaType: "movie", tmdbId: 11 }
	const watched: TrackedTitle = { mediaType: "movie", tmdbId: 12 }
	const kept: TrackedTitle = { mediaType: "movie", tmdbId: 13 }
	const unrated: TrackedTitle = { mediaType: "movie", tmdbId: 14 }
	await act(watched, { type: "watch" }, "own-watch")
	// What the apply wrote: scores for three movies and a show. The Wishlist is not the import's to touch.
	db.seed("user_score", [
		scoreRow(fresh, 8),
		scoreRow(watched, 6),
		scoreRow(kept, 7),
		scoreRow(show, 9),
	])
	db.seed("user_wishlist", [titleRow(fresh)])
	const items = [fresh, watched, kept, unrated, show].map((title) => ({
		tmdb_id: title.tmdbId,
		media_type: title.mediaType,
	}))
	await settleImportedMovies(user, items)
	assert.deepEqual(watches(fresh), [["score-11", "score", "unknown"]])
	assert.deepEqual(watches(kept), [["score-13", "score", "unknown"]])
	assert.deepEqual(watches(watched), [["own-watch", "single", "moment"]])
	assert.deepEqual(logOf(unrated), [])
	assert.deepEqual(logOf(show), [])
	assert.deepEqual(
		[fresh, watched, kept, unrated, show].map((title) => stateOf(title)?.state),
		["seen", "seen", "seen", undefined, undefined],
	)
	assert.equal(onWishlist(fresh), true)

	// Settling again, as a run that broke off does, writes nothing.
	db.statements.length = 0
	await settleImportedMovies(user, items)
	assert.deepEqual(db.sent("INSERT", "UPDATE", "DELETE"), [])

	// The undo took two of the scores back. One movie has the member's own watch, which stays.
	dropScore(fresh)
	dropScore(watched)
	await settleImportedMovies(user, items)
	assert.deepEqual(logOf(fresh), [])
	assert.equal(stateOf(fresh), null)
	assert.deepEqual(watches(watched), [["own-watch", "single", "moment"]])
	assert.equal(stateOf(watched)?.state, "seen")
	assert.deepEqual(watches(kept), [["score-13", "score", "unknown"]])

	// Both the apply and the undo settle their movies before they mark their items.
	const source = readFileSync(
		new URL("./imdb-import/apply.server.ts", import.meta.url),
		"utf8",
	)
	assert.match(
		source,
		/await applyBatch\(userId, stamp, batch\)\s+await settleImportedMovies\(userId, batch\)\s+await recordStates/,
	)
	assert.match(
		source.slice(source.indexOf("export async function undoImport")),
		/await settleImportedMovies\(userId, written\)[\s\S]+apply_state = 'undone'/,
	)
})

test("settleMovies handles more movies than one statement takes", async () => {
	const ids = Array.from({ length: 1_201 }, (_, i) => 10_000 + i)
	db.seed(
		"user_score",
		ids.map((id) => scoreRow({ mediaType: "movie", tmdbId: id }, 7)),
	)
	db.statements.length = 0
	const settled = await settleMovies(user, ids)
	assert.equal(settled.inserted.length, 1_201)
	assert.equal(db.table("user_watch_state").length, 1_201)
	assert.deepEqual(db.sent("INSERT"), [
		"INSERT user_watch_log",
		"INSERT user_watch_state",
		"INSERT user_watch_log",
		"INSERT user_watch_state",
		"INSERT user_watch_log",
		"INSERT user_watch_state",
	])
})

// ---------------------------------------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------------------------------------

test("deleting a member's tracking data removes their watch log, states and imports, and nobody else's", async () => {
	const other = "another-member"
	await act(movie, { type: "watch" })
	await press(show, "add")
	await applyTrackingEvent(other, movie, { type: "watch" }, "other-watch-1")
	db.seed("user_import", [
		{ id: "imp-1", user_id: user },
		{ id: "imp-2", user_id: other },
	])
	db.seed("user_import_item", [
		{ import_id: "imp-1", row_index: 0, user_id: user },
		{ import_id: "imp-2", row_index: 0, user_id: other },
	])
	await memberData()

	// The fake has no `user_watch_history`, as production after the table is dropped: that is not an error.
	await deleteTrackingData(user)
	const owners = (table: string) => db.table(table).map((r) => r.user_id)
	assert.deepEqual(owners("user_watch_log"), [other])
	assert.deepEqual(owners("user_watch_state"), [other])
	assert.deepEqual(owners("user_import"), [other])
	assert.deepEqual(owners("user_import_item"), [other])
	assert.ok(
		db.statements.some(
			(s) => s.sql === "DELETE FROM user_watch_history WHERE user_id = ?",
		),
	)
	assert.deepEqual((await memberData()).watchState, {})
	assert.equal(stateOf(movie, other)?.state, "seen")
})

// Keep the unused helpers honest: Want to See added by its own writer stays possible on a Seen title today.
test("Want to See can still be added to a Seen title, as before", async () => {
	await act(movie, { type: "watch" })
	await updateWishList({
		user_id: user,
		tmdb_id: MOVIE,
		media_type: "movie",
		action: "add",
	})
	assert.equal(onWishlist(movie), true)
	assert.equal(mediaKey(movie) in (await memberData()).wishlist, true)
})
