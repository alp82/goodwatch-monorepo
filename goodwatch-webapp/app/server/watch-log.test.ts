// The movie watch log's endpoint, /api/watch-log (docs/implementation/tracking/data-model.md, Q4 and the movie rows
// of "Per action"): what a member reads and does in the log, who may, and what Undo puts back. Against the in-memory
// Crate of the tracking tests.

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

// The same stubs as watch-state.test.ts, with an auth that answers with whoever the test signed in.
const MEMBER = "6f1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e"
const OTHER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
const session = globalThis as unknown as { watchLogTestUser: string | null }
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
			source = `export const getUserIdFromRequest = async () => globalThis.watchLogTestUser ?? undefined
				export const getAuthFromRequest = async () => ({
					user: globalThis.watchLogTestUser ? { id: globalThis.watchLogTestUser } : null,
					headers: new Headers(),
				})`
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
const { applyTrackingEvent } = await import("./tracking.server.ts")
const { getUserData } = await import("./userData.server.ts")
const { updateScores } = await import("./scores.server.ts")
const route = await import("../routes/api.watch-log.ts")
type WatchLogEntry = import("../domain/watch-log.ts").WatchLogEntry

class Redis extends CacheTestRedis {
	async set(key: string, value: string) {
		this.values.set(key, value)
	}
}

type Row = Record<string, unknown>
let db: FakeTrackingCrate
const MOVIE = 603
const DAY = 86_400_000
const ADDED = Date.UTC(2024, 0, 15, 12)

beforeEach(() => {
	db = new FakeTrackingCrate()
	setCrateClientForTest(db)
	setRedisClusterForTest(new Redis())
	resetPendingResetsForTest()
	session.watchLogTestUser = MEMBER
	process.env.REC_TRACKING = "on"
	process.env.REC_PREVIEW_USERS = ""
})
afterEach(() => {
	setCrateClientForTest(null)
	setRedisClusterForTest(null)
	resetPendingResetsForTest()
})

interface Answer {
	status?: "applied" | "refused"
	refused?: string | null
	watches?: WatchLogEntry[]
	error?: string
}
const read = async (tmdbId: unknown = MOVIE) => {
	const response: Response = await route.loader({
		request: new Request(`http://goodwatch.test/api/watch-log?tmdb_id=${tmdbId}`),
		params: {},
		context: {},
	})
	return { response, body: (await response.json()) as Answer }
}
const send = async (action: unknown, tmdbId: unknown = MOVIE, method = "POST") => {
	const response: Response = await route.action({
		request: new Request("http://goodwatch.test/api/watch-log", {
			method,
			body: JSON.stringify({ tmdb_id: tmdbId, action }),
		}),
		params: {},
		context: {},
	})
	return { response, body: (await response.json()) as Answer }
}
const act = async (action: unknown) => (await send(action)).body
const logOf = (user = MEMBER, movie = MOVIE) =>
	db.log(user).filter((r) => r.media_type === "movie" && r.tmdb_id === movie)
const stateOf = () => db.state(MEMBER, "movie", MOVIE)
const titleRow = (rest: Row = {}): Row => ({
	user_id: MEMBER,
	tmdb_id: MOVIE,
	media_type: "movie",
	created_at: 1_000,
	updated_at: 2_000,
	...rest,
})
const on = (table: string) =>
	db.table(table).find((r) => r.user_id === MEMBER && r.tmdb_id === MOVIE)
const rate = (score: number | null) =>
	updateScores({
		user_id: MEMBER,
		tmdb_id: MOVIE,
		media_type: "movie",
		score: score as 8 | null,
	})
const shape = (watches: WatchLogEntry[] = []) =>
	watches.map((w) => [w.id, w.origin, w.precision])
const today = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------------------------------------
// Who may
// ---------------------------------------------------------------------------------------------------------

test("the log is private and never cached; a guest is told to sign in and nothing is read or written", async () => {
	const member = await read()
	assert.equal(member.response.status, 200)
	assert.equal(member.response.headers.get("Cache-Control"), "private, no-store")
	assert.deepEqual(member.body, { watches: [] })

	session.watchLogTestUser = null
	const before = db.statements.length
	const guestRead = await read()
	assert.equal(guestRead.response.status, 401)
	assert.equal(guestRead.response.headers.get("Cache-Control"), "private, no-store")
	assert.equal(guestRead.body.watches, undefined)
	const guestWrite = await send({ type: "watch", watchId: "watch-0000001" })
	assert.equal(guestWrite.response.status, 401)
	assert.equal(db.statements.length, before)
})

test("while REC_TRACKING hides the log from the viewer there is no such endpoint", async () => {
	process.env.REC_TRACKING = "off"
	assert.equal((await read()).response.status, 404)
	assert.equal(
		(await send({ type: "watch", watchId: "watch-0000001" })).response.status,
		404,
	)
	assert.deepEqual(logOf(), [])
	// In preview only the listed members have it.
	process.env.REC_TRACKING = "preview"
	assert.equal((await read()).response.status, 404)
	process.env.REC_PREVIEW_USERS = MEMBER
	assert.equal((await read()).response.status, 200)
})

test("a request that names no movie or no action is refused before anything is written", async () => {
	for (const id of ["", "abc", "-1", "0", "1.5"])
		assert.equal((await read(id)).response.status, 400, `tmdb_id=${id}`)
	const bad: unknown[] = [
		{ type: "watch" },
		{ type: "watch", watchId: "x" },
		{ type: "watch", watchId: "watch-0000001", when: { precision: "week" } },
		{ type: "watch", watchId: "watch-0000001", when: { precision: "day", day: "2026-13-40" } },
		{ type: "editDate", watchId: "watch-0000001", when: { precision: "moment" } },
		{ type: "editDate", watchId: "watch-0000001" },
		{ type: "delete" },
		{ type: "restore", rows: [] },
		{ type: "restore", rows: [{ id: "watch-0000001" }] },
		{ type: "pressSeen" },
		null,
	]
	for (const action of bad)
		assert.equal(
			(await send(action)).response.status,
			400,
			JSON.stringify(action),
		)
	assert.equal((await send({ type: "removeAll" }, "abc")).response.status, 400)
	assert.equal(
		(await send({ type: "removeAll" }, MOVIE, "PUT")).response.status,
		405,
	)
	assert.deepEqual(db.sent("INSERT", "UPDATE", "DELETE"), [])
})

// ---------------------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------------------

test("the log lists the member's watches of the movie newest first, undated below, with an import's platform", async () => {
	db.seed("user_import", [
		{ id: "imp-1", user_id: MEMBER, source: "letterboxd" },
		{ id: "imp-2", user_id: MEMBER, source: "imdb" },
	])
	const row = (rest: Row): Row => ({
		user_id: MEMBER,
		media_type: "movie",
		tmdb_id: MOVIE,
		episode_tmdb_id: null,
		season_number: null,
		episode_number: null,
		group_id: null,
		import_id: null,
		pass: 1,
		origin: "single",
		updated_at: 5,
		...rest,
	})
	db.seed("user_watch_log", [
		row({ watch_id: "i-00000000000000000000000000000002", watched_at: null, watched_at_precision: "unknown", origin: "import", import_id: "imp-2", created_at: 10 }),
		row({ watch_id: "i-00000000000000000000000000000001", watched_at: Date.UTC(2019, 2, 12), watched_at_precision: "day", origin: "import", import_id: "imp-1", created_at: 11 }),
		row({ watch_id: "watch-0000001", watched_at: Date.UTC(2026, 8, 28, 19, 40), watched_at_precision: "moment", created_at: 12 }),
		// Another movie's and another member's watches are not in it.
		row({ watch_id: "watch-0000002", tmdb_id: 604, watched_at: null, watched_at_precision: "unknown", created_at: 13 }),
		row({ watch_id: "watch-0000003", user_id: OTHER, watched_at: null, watched_at_precision: "unknown", created_at: 14 }),
	])
	const { body } = await read()
	assert.deepEqual(body.watches, [
		{ id: "watch-0000001", at: Date.UTC(2026, 8, 28, 19, 40), precision: "moment", origin: "single", importId: null, source: null, createdAt: 12 },
		{ id: "i-00000000000000000000000000000001", at: Date.UTC(2019, 2, 12), precision: "day", origin: "import", importId: "imp-1", source: "letterboxd", createdAt: 11 },
		{ id: "i-00000000000000000000000000000002", at: null, precision: "unknown", origin: "import", importId: "imp-2", source: "imdb", createdAt: 10 },
	])
})

test("a rated movie without a watch reads as the one row its score owns", async () => {
	await rate(8)
	assert.deepEqual(shape((await read()).body.watches), [
		["score-603", "score", "unknown"],
	])
})

// ---------------------------------------------------------------------------------------------------------
// Doing
// ---------------------------------------------------------------------------------------------------------

test("\"Watched it again\" adds a watch beside the first: now, a day, or no date, and answers with the log", async () => {
	db.seed("user_wishlist", [titleRow()])
	const first = await act({ type: "watch", watchId: "watch-0000001" })
	assert.deepEqual(
		[first.status, shape(first.watches)],
		["applied", [["watch-0000001", "single", "moment"]]],
	)
	assert.equal(on("user_wishlist"), undefined)
	const second = await act({
		type: "watch",
		watchId: "watch-0000002",
		when: { precision: "day", day: "2024-05-01" },
	})
	const third = await act({
		type: "watch",
		watchId: "watch-0000003",
		when: { precision: "unknown" },
	})
	assert.equal(second.status, "applied")
	assert.deepEqual(shape(third.watches), [
		["watch-0000001", "single", "moment"],
		["watch-0000002", "single", "day"],
		["watch-0000003", "single", "unknown"],
	])
	assert.equal(third.watches?.[1].at, Date.UTC(2024, 4, 1))
	// The same request again records nothing more.
	const again = await act({ type: "watch", watchId: "watch-0000003", when: { precision: "unknown" } })
	assert.equal(again.watches?.length, 3)
	const data = await getUserData({ user_id: MEMBER })
	assert.deepEqual(
		[data.watchState["movie-603"].state, data.watchState["movie-603"].count],
		["seen", 3],
	)
})

test("\"I watched it\" on a movie that is Seen through its score turns the score's row into the member's watch", async () => {
	await rate(8)
	const mine = await act({ type: "watch", watchId: "watch-0000001", when: { precision: "unknown" } })
	assert.deepEqual(shape(mine.watches), [["watch-0000001", "single", "unknown"]])
	// Clearing the score at the score control leaves it.
	await rate(null)
	assert.deepEqual(shape((await read()).body.watches), [["watch-0000001", "single", "unknown"]])
})

test("editing a watch's date sets a day or no date, and never a time", async () => {
	await act({ type: "watch", watchId: "watch-0000001" })
	const day = await act({
		type: "editDate",
		watchId: "watch-0000001",
		when: { precision: "day", day: "2024-05-01" },
	})
	assert.deepEqual(
		[day.status, day.watches?.[0].at, day.watches?.[0].precision],
		["applied", Date.UTC(2024, 4, 1), "day"],
	)
	const unknown = await act({
		type: "editDate",
		watchId: "watch-0000001",
		when: { precision: "unknown" },
	})
	assert.deepEqual(
		[unknown.watches?.[0].at, unknown.watches?.[0].precision],
		[null, "unknown"],
	)
	// A watch that is not in this log, and a day that has not come, change nothing and say so.
	const missing = await act({ type: "editDate", watchId: "watch-9999999", when: { precision: "unknown" } })
	assert.deepEqual([missing.status, missing.refused], ["refused", "That watch is not in the log."])
	const ahead = new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10)
	const early = await act({ type: "editDate", watchId: "watch-0000001", when: { precision: "day", day: ahead } })
	assert.equal(early.status, "refused")
	assert.equal(early.watches?.[0].precision, "unknown")
})

test("deleting a watch removes that one; the last one leaves the movie not Seen, or Seen through its score", async () => {
	await act({ type: "watch", watchId: "watch-0000001" })
	await act({ type: "watch", watchId: "watch-0000002", when: { precision: "day", day: today() } })
	const one = await act({ type: "delete", watchId: "watch-0000002" })
	assert.deepEqual(shape(one.watches), [["watch-0000001", "single", "moment"]])
	const none = await act({ type: "delete", watchId: "watch-0000001" })
	assert.deepEqual([none.status, none.watches, stateOf()], ["applied", [], null])
	assert.equal((await getUserData({ user_id: MEMBER })).watchState["movie-603"], undefined)

	await rate(8)
	await act({ type: "watch", watchId: "watch-0000003" })
	const rated = await act({ type: "delete", watchId: "watch-0000003" })
	assert.deepEqual(shape(rated.watches), [["score-603", "score", "unknown"]])
	// The score's own row is not deleted in the log.
	const refused = await act({ type: "delete", watchId: "score-603" })
	assert.equal(refused.status, "refused")
	assert.deepEqual(shape(refused.watches), [["score-603", "score", "unknown"]])
})

test("Undo of the first watch removes it and puts the movie back on the Wishlist with its place", async () => {
	db.seed("user_wishlist", [titleRow({ created_at: ADDED })])
	await act({ type: "watch", watchId: "watch-0000001" })
	assert.equal(on("user_wishlist"), undefined)
	const undone = await act({
		type: "delete",
		watchId: "watch-0000001",
		back: { wantToSeeAddedAt: new Date(ADDED).toISOString() },
	})
	assert.deepEqual([undone.status, undone.watches], ["applied", []])
	assert.equal(on("user_wishlist")?.created_at, ADDED)
	const data = await getUserData({ user_id: MEMBER })
	assert.equal(data.wishlist["movie-603"].createdAt.getTime(), ADDED)

	// Not interested comes back the same way; a time in the future is not taken as the place in the list.
	db.rows.set("user_wishlist", [])
	db.seed("user_not_interested", [titleRow()])
	await act({ type: "watch", watchId: "watch-0000002" })
	assert.equal(on("user_not_interested"), undefined)
	await act({ type: "delete", watchId: "watch-0000002", back: { notInterested: true } })
	assert.notEqual(on("user_not_interested"), undefined)
	db.rows.set("user_not_interested", [])
	await act({ type: "watch", watchId: "watch-0000003" })
	const future = new Date(Date.now() + 30 * DAY).toISOString()
	await act({ type: "delete", watchId: "watch-0000003", back: { wantToSeeAddedAt: future } })
	assert.ok(Number(on("user_wishlist")?.created_at) <= Date.now())
	// Nothing comes back when the watch was not there to delete, or when the movie is still Seen.
	db.rows.set("user_wishlist", [])
	await act({ type: "delete", watchId: "watch-0000003", back: { wantToSeeAddedAt: new Date(ADDED).toISOString() } })
	assert.equal(on("user_wishlist"), undefined)
})

test("\"Remove all N watches\" removes every watch the member logged and nobody else's", async () => {
	await applyTrackingEvent(OTHER, { mediaType: "movie", tmdbId: MOVIE }, { type: "watch" }, "watch-other-1")
	await act({ type: "watch", watchId: "watch-0000001" })
	await act({ type: "watch", watchId: "watch-0000002", when: { precision: "unknown" } })
	const removed = await act({ type: "removeAll" })
	assert.deepEqual([removed.status, removed.watches, stateOf()], ["applied", [], null])
	assert.equal(logOf(OTHER).length, 1)
})

test("Undo of a delete puts the same watch back: its id, its date, when it was recorded, and its import", async () => {
	db.seed("user_import", [{ id: "imp-1", user_id: MEMBER, source: "letterboxd" }])
	await act({ type: "watch", watchId: "watch-0000001", when: { precision: "day", day: "2024-05-01" } })
	await act({ type: "watch", watchId: "watch-0000002" })
	const { watches: before = [] } = (await read()).body
	const imported: WatchLogEntry = {
		id: "i-0123456789abcdef0123456789abcdef",
		at: Date.UTC(2019, 2, 12),
		precision: "day",
		origin: "import",
		importId: "imp-1",
		source: "letterboxd",
		createdAt: 77,
	}
	await act({ type: "removeAll" })
	const back = await act({ type: "restore", rows: [...before, imported] })
	assert.equal(back.status, "applied")
	assert.deepEqual(back.watches, [before[0], before[1], imported])
	assert.equal(stateOf()?.state, "seen")
	// Sent again, nothing doubles.
	assert.deepEqual((await act({ type: "restore", rows: before })).watches, back.watches)
})

test("Undo can't write a row into another member's log, another title, or with an origin the member doesn't own", async () => {
	db.seed("user_import", [{ id: "imp-other", user_id: OTHER, source: "trakt" }])
	const row = (parts: Partial<WatchLogEntry> = {}) => ({
		id: "watch-0000001",
		at: null,
		precision: "unknown",
		origin: "single",
		importId: null,
		createdAt: 77,
		...parts,
	})
	// What the schema lets through and the writer refuses.
	const refused: unknown[] = [
		row({ id: "score-999" }),
		row({ id: "g-0193f6a3-11aa-7c55-64122" }),
		row({ id: "i-0123456789abcdef0123456789abcdef", origin: "import", importId: "imp-other" }),
		row({ id: "i-0123456789abcdef0123456789abcdef", origin: "import" }),
		row({ at: Date.UTC(2024, 4, 1, 12), precision: "day" }),
		row({ at: Date.now() + 3 * DAY, precision: "moment" }),
	]
	for (const one of refused) {
		const answer = await act({ type: "restore", rows: [one] })
		assert.equal(answer.status, "refused", JSON.stringify(one))
	}
	// What the schema stops: an origin of the server's, a user id or a title smuggled into the row.
	for (const one of [
		row({ origin: "score" as "single" }),
		row({ origin: "seen" as "single" }),
		{ ...row(), user_id: OTHER },
		{ ...row(), tmdb_id: 604 },
		{ ...row(), media_type: "show" },
	])
		assert.equal(
			(await send({ type: "restore", rows: [one] })).response.status,
			400,
			JSON.stringify(one),
		)
	assert.deepEqual(db.log(MEMBER), [])
	assert.deepEqual(db.log(OTHER), [])
	// A row that is fine lands in the signed-in member's log for the movie the request names, and nowhere else.
	await act({ type: "restore", rows: [row()] })
	assert.deepEqual(
		db.table("user_watch_log").map((r) => [r.user_id, r.media_type, r.tmdb_id, r.watch_id, r.origin]),
		[[MEMBER, "movie", MOVIE, "watch-0000001", "single"]],
	)
})

test("the endpoint is for movies: it never touches a show's watches", async () => {
	db.seed("episode", [
		{ show_id: MOVIE, tmdb_id: 1, season_number: 1, episode_number: 1, name: "E1", air_date: 0, runtime: 45, still_path: null, episode_type: "standard", removed_at: null },
	])
	await applyTrackingEvent(MEMBER, { mediaType: "show", tmdbId: MOVIE }, { type: "pressSeen" }, "press-0000001")
	const show = db.log(MEMBER)
	assert.equal(show.length, 1)
	assert.deepEqual((await read()).body.watches, [])
	await act({ type: "removeAll" })
	await act({ type: "delete", watchId: show[0].watch_id })
	await act({ type: "editDate", watchId: show[0].watch_id, when: { precision: "unknown" } })
	assert.deepEqual(db.log(MEMBER), show)
})
