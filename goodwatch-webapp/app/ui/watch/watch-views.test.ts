// Watch's tabs and views (round 9): the Seen tab, Up next's and Ready to watch's views, All shows, the
// Seen tab's kinds, and the redirect of /watch/movies/seen.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	moviesSeenMove,
	readyViews,
	seenKinds,
	seenTab,
	statusViews,
	upNextSplit,
	upNextViews,
	watchTabOf,
	watchTabsFor,
} from "./watch-views.ts"

const counts = {
	chips: {
		"not-started": 3,
		watching: 2,
		"on-hold": 1,
		dropped: 0,
		wishlist: 9,
	},
	seenShows: 4,
	seenMovies: 7,
}

test("Up next's views: Next episodes, then the statuses, with the page's view current", () => {
	const views = upNextViews("/watch/watching/", counts)
	assert.deepEqual(
		views?.map((c) => c.key),
		["next-episodes", "not-started", "watching", "on-hold", "dropped"],
	)
	assert.deepEqual(
		views?.filter((c) => c.here).map((c) => c.key),
		["watching"],
	)
	assert.equal(views?.[1].count, 3)
	assert.equal(upNextViews("/watch/movies", counts), null)
	assert.equal(upNextViews("/watch/seen", counts), null)
})

test("Ready to watch's views, and guests get no counts", () => {
	const views = readyViews("/watch/movies/recent", null)
	assert.deepEqual(
		views?.map((c) => [c.key, c.here, c.count]),
		[
			["tonight", false, undefined],
			["wishlist", false, undefined],
			["recent", true, undefined],
		],
	)
	assert.equal(readyViews("/watch", counts), null)
	assert.equal(readyViews("/watch/for-you", counts), null)
})

test("Next episodes | All shows, All shows current on each status page", () => {
	const onNext = upNextSplit(upNextViews("/watch", counts) ?? [])
	assert.deepEqual(
		onNext.map((c) => [c.key, c.here, c.href, c.count]),
		[
			["next-episodes", true, "/watch", undefined],
			["all-shows", false, "/watch/watching", 6],
		],
	)
	const onDropped = upNextSplit(upNextViews("/watch/dropped", counts) ?? [])
	assert.equal(onDropped[1].here, true)
	assert.equal(
		upNextSplit(upNextViews("/watch", null) ?? [])[1].count,
		undefined,
	)
	assert.equal(statusViews(upNextViews("/watch", counts) ?? []).length, 4)
})

test("/watch/seen is the Seen tab, and none of the three is current", () => {
	assert.equal(watchTabOf("/watch/seen"), "seen")
	assert.equal(watchTabOf("/watch/on-hold"), "up-next")
	assert.equal(seenTab("/watch/seen/").here, true)
	assert.equal(seenTab("/watch").here, false)
	assert.ok(watchTabsFor("/watch/seen").every((t) => !t.here))
	assert.equal(watchTabsFor("/watch")[0].here, true)
})

test("the Seen tab's kinds keep the rest of the query", () => {
	const kinds = seenKinds("?type=movie&sort=score", counts)
	assert.deepEqual(
		kinds.map((c) => [c.key, c.here, c.href, c.count]),
		[
			["all", false, "/watch/seen?sort=score", 11],
			["movie", true, "/watch/seen?type=movie&sort=score", 7],
			["show", false, "/watch/seen?type=show&sort=score", 4],
		],
	)
	assert.equal(seenKinds("", null)[0].here, true)
	assert.equal(seenKinds("", null)[0].href, "/watch/seen")
	assert.equal(seenKinds("?type=nope", null)[0].here, true)
})

test("/watch/movies/seen goes to the Seen tab with Movies picked", () => {
	assert.equal(moviesSeenMove(""), "/watch/seen?type=movie")
	assert.equal(
		moviesSeenMove("?sort=score&type=show"),
		"/watch/seen?sort=score&type=movie",
	)
})
