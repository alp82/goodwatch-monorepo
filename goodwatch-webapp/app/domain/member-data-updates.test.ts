// What the browser shows right after an action, and what counts as Seen in the member data map.
import "../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const { afterScore, afterSeenPress } = await import("./member-data-updates.ts")
const {
	isSeen,
	seenKeys,
	watchStateSignature,
	withLegacyWatched,
	withWatchState,
	ACTED_ON,
} = await import("../types/user-data.ts")
type UserData = import("../types/user-data.ts").UserData
type WatchStateEntry = import("../types/user-data.ts").WatchStateEntry

const NOW = new Date("2026-10-07T20:00:00Z")
const EARLIER = new Date("2026-09-01T20:00:00Z")
const stamp = { updatedAt: EARLIER }

const data = (parts: Partial<UserData> = {}): UserData => ({
	scores: {},
	wishlist: {},
	watchState: {},
	favorites: {},
	skipped: {},
	notInterested: {},
	...parts,
})
const entry = (parts: Partial<WatchStateEntry> = {}): WatchStateEntry => ({
	state: "seen",
	watchedAt: EARLIER,
	precision: "moment",
	count: 1,
	pass: 1,
	episodesWatched: 0,
	furthest: null,
	lastActivityAt: EARLIER,
	...parts,
})
/** A movie that is Seen only through its score: one undated watch. */
const byScore = entry({
	watchedAt: null,
	precision: "unknown",
	lastActivityAt: null,
})
const score = { score: 8 as const, review: null, updatedAt: EARLIER }
const wish = { createdAt: EARLIER, updatedAt: EARLIER }

test("counts as Seen: the state Seen, or a score", () => {
	const member = data({
		scores: { "show-1": score },
		watchState: {
			"movie-2": entry(),
			"show-3": entry({ state: "watching" }),
			"show-4": entry({ state: "dropped" }),
		},
	})
	assert.equal(isSeen(member, "show-1"), true, "a rated show, never started")
	assert.equal(isSeen(member, "movie-2"), true)
	assert.equal(isSeen(member, "show-3"), false, "Watching is not Seen")
	assert.equal(isSeen(member, "show-4"), false)
	assert.equal(isSeen(member, "movie-9"), false)
	assert.equal(isSeen(undefined, "movie-2"), false)
	assert.deepEqual(seenKeys(member).sort(), ["movie-2", "show-1"])
})

test("across the deploy: the answer to an earlier page carries `watched`, and an earlier answer gets a watchState", () => {
	const member = data({
		watchState: {
			"movie-2": entry(),
			"show-3": entry({ state: "watching" }),
			"show-5": entry({ watchedAt: null, lastActivityAt: null }),
		},
	})
	const answer = withLegacyWatched(member)
	// The earlier page takes an entry in `watched` to mean Seen.
	assert.deepEqual(answer.watched, {
		"movie-2": { updatedAt: EARLIER },
		"show-5": { updatedAt: new Date(0) },
	})
	assert.equal(answer.watchState, member.watchState)
	const { watchState: _, ...earlier } = data({ watched: { "movie-2": stamp } })
	assert.deepEqual(withWatchState(earlier as UserData).watchState, {})
	assert.equal(withWatchState(member), member)
})

test("the keys of acted-on titles include the watch state and no longer `watched`", () => {
	assert.deepEqual([...ACTED_ON].sort(), [
		"notInterested",
		"scores",
		"skipped",
		"watchState",
		"wishlist",
	])
})

test("the watch state's signature changes with a state, a title and a watch, and not with the order", () => {
	const one = { "movie-2": entry(), "show-3": entry({ state: "watching" }) }
	const signature = watchStateSignature(one)
	assert.equal(signature, "seen:1,watching:1/2")
	assert.equal(
		watchStateSignature({ "show-3": one["show-3"], "movie-2": one["movie-2"] }),
		signature,
	)
	assert.notEqual(
		watchStateSignature({ ...one, "show-3": entry({ state: "seen" }) }),
		signature,
	)
	assert.notEqual(
		watchStateSignature({ ...one, "movie-2": entry({ count: 2 }) }),
		signature,
	)
	assert.equal(watchStateSignature({}), "/0")
})

test("Seen pressed on a movie: Seen with a watch dated now, off the Wishlist and off Not interested", () => {
	const before = data({
		wishlist: { "movie-2": wish },
		notInterested: { "movie-2": stamp },
	})
	const after = afterSeenPress(before, "movie", 2, "add", NOW)
	assert.deepEqual(after?.watchState["movie-2"], {
		state: "seen",
		watchedAt: NOW,
		precision: "moment",
		count: 1,
		pass: 1,
		episodesWatched: 0,
		furthest: null,
		lastActivityAt: NOW,
	})
	assert.deepEqual(after?.wishlist, {})
	assert.deepEqual(after?.notInterested, {})
	assert.deepEqual(before.watchState, {}, "the map before is left as it was")
})

test("Seen pressed on a rated movie replaces the watch its score owns: still one watch", () => {
	const before = data({
		scores: { "movie-2": score },
		watchState: { "movie-2": byScore },
	})
	const after = afterSeenPress(before, "movie", 2, "add", NOW)
	assert.deepEqual(
		[after?.watchState["movie-2"].count, after?.watchState["movie-2"].watchedAt],
		[1, NOW],
	)
})

test("Seen taken back: an unrated movie is no longer Seen, a rated one stays Seen through its score", () => {
	const unrated = afterSeenPress(
		data({ watchState: { "movie-2": entry() } }),
		"movie",
		2,
		"remove",
		NOW,
	)
	assert.equal(unrated?.watchState["movie-2"], undefined)
	const rated = afterSeenPress(
		data({
			scores: { "movie-2": score },
			watchState: { "movie-2": entry({ count: 2 }) },
		}),
		"movie",
		2,
		"remove",
		NOW,
	)
	assert.deepEqual(rated?.watchState["movie-2"], byScore)
})

test("Seen pressed on a show makes it Seen and keeps what the map knew; taking it back removes the entry", () => {
	const watching = entry({
		state: "watching",
		count: 3,
		episodesWatched: 3,
		furthest: [1, 3],
	})
	const before = data({
		watchState: { "show-3": watching },
		wishlist: { "show-3": wish },
	})
	const after = afterSeenPress(before, "show", 3, "add", NOW)
	assert.deepEqual(after?.watchState["show-3"], {
		...watching,
		state: "seen",
		lastActivityAt: NOW,
	})
	assert.deepEqual(after?.wishlist, {})
	const fresh = afterSeenPress(data(), "show", 4, "add", NOW)
	assert.deepEqual(
		[fresh?.watchState["show-4"].state, fresh?.watchState["show-4"].count],
		["seen", 0],
	)
	const back = afterSeenPress(after, "show", 3, "remove", NOW)
	assert.equal(back?.watchState["show-3"], undefined)
})

test("rating a movie that has no watch makes it Seen through its score and takes it off the Wishlist", () => {
	const before = data({
		wishlist: { "movie-2": wish },
		notInterested: { "movie-2": stamp },
	})
	const after = afterScore(before, "movie", 2, 8, null, NOW)
	assert.deepEqual(after?.scores["movie-2"], {
		score: 8,
		review: null,
		updatedAt: NOW,
	})
	assert.deepEqual(after?.watchState["movie-2"], byScore)
	assert.deepEqual(after?.wishlist, {})
	assert.deepEqual(after?.notInterested, {})
})

test("rating a movie that has a watch changes no watch state and leaves the Wishlist", () => {
	const before = data({
		watchState: { "movie-2": entry() },
		wishlist: { "movie-2": wish },
	})
	const after = afterScore(before, "movie", 2, 8, null, NOW)
	assert.deepEqual(after?.watchState, before.watchState)
	assert.deepEqual(after?.wishlist, before.wishlist)
})

test("clearing a movie's score takes away the watch the score owned, and leaves a watch the member logged", () => {
	const alone = afterScore(
		data({
			scores: { "movie-2": score },
			watchState: { "movie-2": byScore },
		}),
		"movie",
		2,
		null,
		null,
		NOW,
	)
	assert.deepEqual([alone?.scores, alone?.watchState], [{}, {}])
	const logged = afterScore(
		data({
			scores: { "movie-2": score },
			watchState: { "movie-2": entry() },
		}),
		"movie",
		2,
		null,
		null,
		NOW,
	)
	assert.deepEqual(logged?.scores, {})
	assert.equal(logged?.watchState["movie-2"].state, "seen")
})

test("rating a show changes no watch state and leaves the Wishlist; it takes the show off Not interested", () => {
	const before = data({
		wishlist: { "show-3": wish },
		notInterested: { "show-3": stamp },
	})
	const after = afterScore(before, "show", 3, 9, null, NOW)
	assert.equal(after?.scores["show-3"].score, 9)
	assert.deepEqual(after?.watchState, {})
	assert.deepEqual(after?.wishlist, before.wishlist)
	assert.deepEqual(after?.notInterested, {})
	assert.equal(afterScore(undefined, "show", 3, 9, null, NOW), undefined)
})

// ---------------------------------------------------------------------------------------------------------
// The movie watch log
// ---------------------------------------------------------------------------------------------------------

const { afterWatchLog } = await import("./member-data-updates.ts")
type WatchLogEntry = import("./watch-log.ts").WatchLogEntry

const logged = (
	id: string,
	parts: Partial<WatchLogEntry> = {},
): WatchLogEntry => ({
	id,
	at: NOW.getTime(),
	precision: "moment",
	origin: "single",
	importId: null,
	source: null,
	createdAt: NOW.getTime(),
	...parts,
})

test("a first watch in the log makes the movie Seen with its date and count, and takes it off both lists", () => {
	const before = data({
		wishlist: { "movie-603": wish },
		notInterested: { "movie-603": stamp },
	})
	const after = afterWatchLog(before, 603, [logged("w1")], { watched: true })
	assert.deepEqual(after?.watchState["movie-603"], {
		state: "seen",
		watchedAt: NOW,
		precision: "moment",
		count: 1,
		pass: 1,
		episodesWatched: 0,
		furthest: null,
		lastActivityAt: NOW,
	})
	assert.deepEqual([after?.wishlist, after?.notInterested], [{}, {}])
	assert.equal("movie-603" in before.wishlist, true, "the map before is left")
})

test("the entry follows the log: the count, the latest dated watch, and no date when every watch is undated", () => {
	const three = afterWatchLog(
		data({ watchState: { "movie-603": entry() } }),
		603,
		[
			logged("d", { at: Date.parse("2026-10-01T00:00:00Z"), precision: "day" }),
			logged("m", { at: EARLIER.getTime() }),
			logged("u", { at: null, precision: "unknown" }),
		],
	)
	assert.deepEqual(
		[
			three?.watchState["movie-603"].count,
			three?.watchState["movie-603"].watchedAt,
			three?.watchState["movie-603"].precision,
		],
		[3, new Date("2026-10-01T00:00:00Z"), "day"],
	)
	const undated = afterWatchLog(data(), 603, [
		logged("u", { at: null, precision: "unknown", origin: "import" }),
	])
	assert.deepEqual(
		[
			undated?.watchState["movie-603"].watchedAt,
			undated?.watchState["movie-603"].precision,
			// An undated imported watch counts for nothing in "watched lately".
			undated?.watchState["movie-603"].lastActivityAt,
		],
		[null, "unknown", null],
	)
})

test("editing or deleting a watch leaves the Wishlist alone; an empty log is a movie that is not Seen", () => {
	const wished = data({
		wishlist: { "movie-603": wish },
		watchState: { "movie-603": entry({ count: 2 }) },
	})
	const edited = afterWatchLog(wished, 603, [logged("w1")])
	assert.equal("movie-603" in (edited?.wishlist ?? {}), true)
	const empty = afterWatchLog(wished, 603, [])
	assert.equal(empty?.watchState["movie-603"], undefined)
})

test("Undo of the first watch puts the movie back on the lists it was taken off, with its place", () => {
	const after = afterWatchLog(
		data({ watchState: { "movie-603": entry() } }),
		603,
		[],
		{ back: { wishlist: wish, notInterested: stamp } },
	)
	assert.deepEqual(
		[after?.watchState, after?.wishlist, after?.notInterested],
		[{}, { "movie-603": wish }, { "movie-603": stamp }],
	)
})

test("no member data, no guess about the log", () => {
	assert.equal(afterWatchLog(undefined, 603, [logged("w1")]), undefined)
})
