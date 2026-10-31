import assert from "node:assert/strict"
import { test } from "node:test"
import {
	KEEP,
	emptyContext,
	offsetOf,
	remember,
	restoredEntry,
} from "./discovery-continuity.ts"

test("a listing's entry point opens with its last filters", () => {
	const context = remember(
		emptyContext(),
		"/wishlist",
		"/wishlist?sort=score",
		0,
	)
	assert.equal(restoredEntry("/wishlist", "", context), "/wishlist?sort=score")
	assert.equal(restoredEntry("/wishlist", "?type=movies", context), null)
	assert.equal(restoredEntry("/movies", "", context), null)
})

test("Discover opens fresh without a query, never with the last search", () => {
	let context = remember(emptyContext(), "/discover", "/discover?q=heist", 0)
	context = remember(
		context,
		"/discover/movies",
		"/discover/movies?moods=dark",
		0,
	)
	assert.equal(restoredEntry("/discover", "", context), null)
	assert.equal(restoredEntry("/discover/movies", "", context), null)
	assert.equal(
		context.positions["/discover?q=heist"],
		0,
		"scroll places are still kept",
	)
})

test("title pages, taste, the start page and other pages never redirect", () => {
	let context = emptyContext()
	for (const url of [
		"/movie/1-a?tab=x",
		"/taste?step=2",
		"/?tv=1",
		"/settings?x=1",
	])
		context = remember(context, url.split("?")[0], url, 0)
	assert.equal(restoredEntry("/movie/1-a", "", context), null)
	assert.equal(restoredEntry("/taste", "", context), null)
	assert.equal(restoredEntry("/", "", context), null)
	assert.equal(restoredEntry("/settings", "", context), null)
})

test("the stored paths and URLs stay bounded, and a revisited one counts as new", () => {
	let context = remember(emptyContext(), "/wishlist", "/wishlist?sort=score", 0)
	for (let i = 0; i < KEEP * 2; i++)
		context = remember(context, `/movie/${i}-x`, `/movie/${i}-x`, i)
	assert.equal(Object.keys(context.routes).length, KEEP)
	assert.equal(Object.keys(context.positions).length, KEEP)
	assert.equal(
		restoredEntry("/wishlist", "", context),
		null,
		"the oldest path went",
	)

	context = remember(emptyContext(), "/wishlist", "/wishlist?sort=score", 0)
	for (let i = 0; i < KEEP - 1; i++)
		context = remember(context, `/movie/${i}-x`, `/movie/${i}-x`, i)
	context = remember(context, "/wishlist", "/wishlist?sort=score", 40)
	context = remember(context, "/movie/new-x", "/movie/new-x", 0)
	assert.equal(restoredEntry("/wishlist", "", context), "/wishlist?sort=score")
	assert.equal(context.positions["/wishlist?sort=score"], 40)
})

test("leaving a page keeps the offset it had, not the next page's", () => {
	const win = {
		location: { pathname: "/discover", search: "?type=movies" },
		scrollY: 0,
	}
	const offset = offsetOf("/discover?type=movies", win)
	win.scrollY = 1000
	assert.equal(offset(), 1000)
	// The router changed the address and scrolled to the top of the next page before the cleanup runs.
	win.location = { pathname: "/movie/1-a", search: "" }
	win.scrollY = 0
	assert.equal(offset(), 1000)
	win.location = { pathname: "/discover", search: "?type=shows" }
	assert.equal(offset(), 1000, "another query is another page")
})


test("Watch restores list filters while the Taste profile keeps its requested tab", () => {
 let context = remember(emptyContext(), "/watch/movies/want", "/watch/movies/want?type=show&q=alien", 80)
 context = remember(context, "/u/ana/scores", "/u/ana/scores?sort=rated", 40)
 assert.equal(restoredEntry("/watch/movies/want", "", context), "/watch/movies/want?type=show&q=alien")
 assert.equal(restoredEntry("/u/ana/scores", "", context), null)
})

test("By your tropes opens the full list: a remembered ?trope= pick is never restored", () => {
	const context = remember(
		emptyContext(),
		"/watch/for-you/tropes",
		"/watch/for-you/tropes?trope=BlackAndGrayMorality",
		0,
	)
	assert.equal(restoredEntry("/watch/for-you/tropes", "", context), null)
})
