// The show page's update of the member data map.
import "../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const { afterShowTracking } = await import("./show-member-data.ts")
type UserData = import("../../types/user-data.ts").UserData
type WatchStateEntry = import("../../types/user-data.ts").WatchStateEntry

const EARLIER = new Date("2026-09-01T20:00:00Z")
const stamp = { updatedAt: EARLIER }
const wish = { createdAt: EARLIER, updatedAt: EARLIER }
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

test("the show page tells the map where the show stands: its entry, and a started show leaves both lists", async () => {
	const member = data({
		wishlist: { "show-7": wish, "movie-7": wish },
		notInterested: { "show-7": stamp },
		watchState: { "show-8": entry() },
	})
	const watching = entry({
		state: "watching",
		episodesWatched: 1,
		furthest: [1, 1],
	})
	const started = afterShowTracking(member, 7, watching)
	assert.deepEqual(started?.watchState, {
		"show-8": entry(),
		"show-7": watching,
	})
	assert.deepEqual(started?.wishlist, { "movie-7": wish })
	assert.deepEqual(started?.notInterested, {})
	assert.deepEqual(
		member.wishlist,
		{ "show-7": wish, "movie-7": wish },
		"the map that was given is not changed",
	)

	// Back to Not started: the entry goes, and the lists are the server's to restore.
	const undone = afterShowTracking(started, 7, null)
	assert.deepEqual(undone?.watchState, { "show-8": entry() })
	assert.deepEqual(undone?.wishlist, { "movie-7": wish })

	// A special alone changes nothing the map holds, and neither does the same entry again.
	assert.equal(afterShowTracking(member, 9, null), member)
	assert.equal(afterShowTracking(started, 7, { ...watching }), started)
	assert.equal(afterShowTracking(undefined, 7, watching), undefined)
})
