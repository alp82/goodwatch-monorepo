// Watch's views under each place Seen can sit (round 8 options): the current view, the Seen tab, and the redirect of
// /watch/movies/seen on the Seen tab.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	moviesSeenMove,
	seenTab,
	watchTabOf,
	watchTabsFor,
	watchViews,
} from "./watch-views.ts"

const counts = {
	chips: { "not-started": 3, watching: 2, wishlist: 9 },
	seenShows: 4,
	seenMovies: 7,
}

test("a tab's views are its to-watch chips, then Seen, with the page's view current", () => {
	const views = watchViews("/watch/watching", "chip", counts)
	assert.ok(views)
	assert.equal(views.tab, "up-next")
	assert.deepEqual(
		views.toWatch.map((c) => c.key),
		["next-episodes", "not-started", "watching", "on-hold", "dropped"],
	)
	assert.equal(views.current.key, "watching")
	assert.equal(views.seen.href, "/watch/seen")
	assert.equal(views.seen.count, 4)
	assert.equal(views.seen.here, false)
})

test("Seen pages keep the same views, with Seen current", () => {
	for (const option of ["chip", "picker"] as const) {
		const shows = watchViews("/watch/seen", option, counts)
		assert.equal(shows?.current.key, "seen")
		assert.equal(shows?.toWatch.length, 5)
		assert.ok(shows?.toWatch.every((c) => !c.here))
		const movies = watchViews("/watch/movies/seen/", option, counts)
		assert.equal(movies?.tab, "ready")
		assert.equal(movies?.seen.count, 7)
		assert.equal(movies?.current.href, "/watch/movies/seen")
	}
})

test("guests get no counts", () => {
	const views = watchViews("/watch/movies", "picker", null)
	assert.equal(views?.current.key, "tonight")
	assert.equal(views?.seen.count, undefined)
	assert.equal(views?.toWatch[1].count, undefined)
})

test("For you and pages outside Watch have no views", () => {
	assert.equal(watchViews("/watch/for-you", "chip", counts), null)
	assert.equal(watchViews("/discover", "picker", counts), null)
})

test("seen=tab: /watch/seen is the Seen tab, and none of the three is current", () => {
	assert.equal(watchTabOf("/watch/seen", "tab"), "seen")
	assert.equal(watchTabOf("/watch/seen", "chip"), "up-next")
	assert.equal(seenTab("/watch/seen", "tab").here, true)
	assert.equal(seenTab("/watch", "tab").here, false)
	assert.ok(watchTabsFor("/watch/seen", "tab").every((t) => !t.here))
	assert.equal(watchTabsFor("/watch/seen", "chip")[0].here, true)
	assert.equal(watchViews("/watch/seen", "tab", counts), null)
	assert.equal(
		watchViews("/watch/movies/wishlist", "tab", counts)?.current.key,
		"wishlist",
	)
})

test("seen=tab sends /watch/movies/seen to the Seen tab with Movies picked", () => {
	assert.equal(moviesSeenMove("", "tab"), "/watch/seen?type=movie")
	assert.equal(
		moviesSeenMove("?sort=score&type=show", "tab"),
		"/watch/seen?sort=score&type=movie",
	)
	assert.equal(moviesSeenMove("", "chip"), null)
	assert.equal(moviesSeenMove("", "picker"), null)
})
