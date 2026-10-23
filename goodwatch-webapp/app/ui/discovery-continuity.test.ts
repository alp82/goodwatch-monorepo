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
		"/discover",
		"/discover?genres=18",
		0,
	)
	assert.equal(restoredEntry("/discover", "", context), "/discover?genres=18")
	assert.equal(restoredEntry("/discover", "?type=movies", context), null)
	assert.equal(restoredEntry("/movies", "", context), null)
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
	let context = remember(emptyContext(), "/discover", "/discover?genres=18", 0)
	for (let i = 0; i < KEEP * 2; i++)
		context = remember(context, `/movie/${i}-x`, `/movie/${i}-x`, i)
	assert.equal(Object.keys(context.routes).length, KEEP)
	assert.equal(Object.keys(context.positions).length, KEEP)
	assert.equal(
		restoredEntry("/discover", "", context),
		null,
		"the oldest path went",
	)

	context = remember(emptyContext(), "/discover", "/discover?genres=18", 0)
	for (let i = 0; i < KEEP - 1; i++)
		context = remember(context, `/movie/${i}-x`, `/movie/${i}-x`, i)
	context = remember(context, "/discover", "/discover?genres=18", 40)
	context = remember(context, "/movie/new-x", "/movie/new-x", 0)
	assert.equal(restoredEntry("/discover", "", context), "/discover?genres=18")
	assert.equal(context.positions["/discover?genres=18"], 40)
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
