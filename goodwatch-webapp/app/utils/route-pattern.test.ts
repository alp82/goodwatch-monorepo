import assert from "node:assert/strict"
import { test } from "node:test"

const { createRoutePatternMatcher } = await import("./route-pattern.ts")

// The shape Remix gives the app's flat routes: every route hangs under `root`, and nested ones under their parent.
const manifest = {
	root: { id: "root", path: "" },
	"routes/_index": { id: "routes/_index", parentId: "root", index: true },
	"routes/movie.$movieKey": {
		id: "routes/movie.$movieKey",
		parentId: "root",
		path: "movie/:movieKey",
	},
	"routes/discover.($type)": {
		id: "routes/discover.($type)",
		parentId: "root",
		path: "discover/:type?",
	},
	"routes/u.$handle.lists.$id": {
		id: "routes/u.$handle.lists.$id",
		parentId: "root",
		path: "u/:handle/lists/:id",
	},
	"routes/og.$": { id: "routes/og.$", parentId: "root", path: "og/*" },
	"routes/og.$first": {
		id: "routes/og.$first",
		parentId: "root",
		path: "og/:first",
	},
	"routes/settings": {
		id: "routes/settings",
		parentId: "root",
		path: "settings",
	},
	"routes/settings.country": {
		id: "routes/settings.country",
		parentId: "routes/settings",
		path: "country",
	},
	"routes/$type._index": {
		id: "routes/$type._index",
		parentId: "root",
		path: ":type",
		index: true,
	},
	"routes/$type.$category._index": {
		id: "routes/$type.$category._index",
		parentId: "root",
		path: ":type/:category",
		index: true,
	},
	"routes/api.search": {
		id: "routes/api.search",
		parentId: "root",
		path: "api/search",
	},
}
const patternOf = createRoutePatternMatcher(manifest)

test("the home page is `/`", () => {
	assert.equal(patternOf("/"), "/")
})

test("a title page reports the pattern, never the title key", () => {
	assert.equal(patternOf("/movie/603-the-matrix"), "/movie/:movieKey")
	assert.equal(patternOf("/movie/603-the-matrix/"), "/movie/:movieKey")
})

test("a share list reports the pattern, never the handle or the list id", () => {
	assert.equal(patternOf("/u/some-handle/lists/42"), "/u/:handle/lists/:id")
})

test("an optional segment keeps one pattern with and without the segment", () => {
	assert.equal(patternOf("/discover"), "/discover/:type?")
	assert.equal(patternOf("/discover/movies"), "/discover/:type?")
})

test("a nested route joins its parents' paths", () => {
	assert.equal(patternOf("/settings"), "/settings")
	assert.equal(patternOf("/settings/country"), "/settings/country")
})

test("an index route with its own path reports that path", () => {
	assert.equal(patternOf("/movies"), "/:type")
	assert.equal(patternOf("/movies/moods"), "/:type/:category")
})

test("the more specific route wins over a splat", () => {
	assert.equal(patternOf("/og/index.png"), "/og/:first")
	assert.equal(patternOf("/og/a/b/c/d.png"), "/og/*")
})

test("a path no route serves has no pattern", () => {
	assert.equal(patternOf("/assets/build/root-abc123.js"), null)
	assert.equal(patternOf("/a/b/c/d"), null)
})

test("every answer is one of the manifest's patterns, whatever the pathname", () => {
	const known = new Set([
		"/",
		"/movie/:movieKey",
		"/discover/:type?",
		"/u/:handle/lists/:id",
		"/og/*",
		"/og/:first",
		"/settings",
		"/settings/country",
		"/api/search",
	])
	for (const pathname of [
		"/movie/1",
		"/movie/2-two",
		"/u/a/lists/1",
		"/u/b/lists/2",
		"/og/x.png",
		"/og/x/y.png",
		"/api/search",
	]) {
		const pattern = patternOf(pathname)
		assert.ok(pattern && known.has(pattern), `${pathname} gave ${pattern}`)
	}
})
