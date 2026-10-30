// The member navigation's addresses, and every row of the old-address table (docs: the member-nav build plan, §3):
// status, target with the query kept, and whether the redirect depends on who asks.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	GUEST,
	type Move,
	type PathViewer,
	WATCH_MOVIE_LISTS,
	WATCH_PATHS,
	WATCH_SHOW_LISTS,
	member,
	moveResponse,
	oldToNew,
	ratePath,
	statusHome,
	tasteHome,
	tastePath,
	watchSeenPath,
} from "./member-paths.ts"

const ANA = member("ana")
const NO_HANDLE = member(null)
const VIEWERS: [string, PathViewer][] = [
	["guest", GUEST],
	["member without a handle", NO_HANDLE],
	["member with a handle", ANA],
]

const shared = (to: string): Move => ({ to, status: 301, private: false })
const personal = (to: string): Move => ({ to, status: 302, private: true })

test("Taste paths: profile, tabs, Rate more's query", () => {
	assert.equal(tastePath("ana"), "/u/ana")
	assert.equal(tastePath("ana", "tropes"), "/u/ana/tropes")
	assert.equal(tastePath("ana", "scores"), "/u/ana/scores")
	assert.equal(tastePath("ana", "not-rated"), "/u/ana/scores/not-rated")
	assert.equal(
		tastePath("ana", "rate", { mode: "quick" }),
		"/u/ana/scores/rate?mode=quick",
	)
	assert.equal(
		tastePath("ana", "rate", { view: "taste" }),
		"/u/ana/scores/rate?view=taste",
	)
	assert.equal(tastePath("ana", "stats"), "/u/ana/stats")
	assert.equal(tastePath("ana", "lists"), "/u/ana/lists")
	assert.equal(
		tastePath("ana", "seen", { as: "visitor", x: undefined }),
		"/u/ana/seen?as=visitor",
	)
	assert.equal(tasteHome(ANA), "/u/ana")
	assert.equal(tasteHome(NO_HANDLE), "/taste")
	assert.equal(tasteHome(GUEST), "/taste")
	assert.equal(
		ratePath(ANA, { mode: "quick" }),
		"/u/ana/scores/rate?mode=quick",
	)
	assert.equal(ratePath(NO_HANDLE, { mode: "quick" }), "/taste/quiz?mode=quick")
	assert.equal(ratePath(GUEST), "/taste/quiz")
})

test("Watch paths: Seen per kind, and every list slug names a Watch path", () => {
	assert.equal(watchSeenPath("show"), "/watch/seen")
	assert.equal(watchSeenPath("movie"), "/watch/movies/seen")
	const paths = new Set<string>(Object.values(WATCH_PATHS))
	for (const slug of Object.keys(WATCH_SHOW_LISTS))
		assert.ok(paths.has(`/watch/${slug}`), slug)
	for (const slug of Object.keys(WATCH_MOVIE_LISTS))
		assert.ok(paths.has(`/watch/movies/${slug}`), slug)
	assert.deepEqual(WATCH_SHOW_LISTS["not-started"], {
		status: "want",
		kind: "show",
		sort: null,
	})
	assert.equal(WATCH_MOVIE_LISTS.recent, undefined)
	assert.deepEqual(WATCH_MOVIE_LISTS.wishlist, {
		status: "want",
		kind: "movie",
		sort: null,
	})
})

test("statusHome: library statuses land on Watch, Not rated on Taste", () => {
	assert.equal(statusHome("want", "all", ANA), "/watch/movies/wishlist")
	assert.equal(statusHome("want", "movie", ANA), "/watch/movies/wishlist")
	assert.equal(statusHome("want", "show", ANA), "/watch/not-started")
	assert.equal(statusHome("seen", "show", ANA), "/watch/seen")
	assert.equal(statusHome("seen", "all", ANA), "/watch/movies/seen")
	assert.equal(statusHome("on_hold", "all", GUEST), "/watch/on-hold")
	assert.equal(statusHome("unrated", "all", ANA), "/u/ana/scores/not-rated")
	assert.equal(statusHome("unrated", "all", NO_HANDLE), "/taste")
})

// Rows that are the same for everyone: 301, query kept.
const SHARED_ROWS: [string, string, string][] = [
	["/my-shows", "?from=menu", "/watch?from=menu"],
	["/my-movies", "", "/watch/movies"],
	["/for-you", "?mood=cozy", "/watch/for-you?mood=cozy"],
	["/my-library/want", "?sort=title&type=show", "/watch/not-started?sort=title"],
	["/my-library/want", "?type=movie", "/watch/movies/wishlist"],
	// Recently added is Want to Watch's newest-first order now.
	["/watch/movies/recent", "", "/watch/movies/wishlist?sort=added"],
	[
		"/watch/movies/recent",
		"?sort=title&q=dune",
		"/watch/movies/wishlist?sort=added&q=dune",
	],
	["/my-library/seen", "?type=show&sort=score", "/watch/seen?sort=score"],
	["/my-library/seen", "?type=movie", "/watch/movies/seen"],
	["/my-library/seen", "?q=alien", "/watch/movies/seen?q=alien"],
	["/my-library/watching", "", "/watch/watching"],
	["/my-library/on-hold", "?sort=title", "/watch/on-hold?sort=title"],
	["/my-library/dropped", "", "/watch/dropped"],
	["/my-library/hidden", "?from=menu", "/settings/not-interested?from=menu"],
	["/settings/hidden", "", "/settings/not-interested"],
	["/taste/everyone", "", "/taste#everyone"],
	["/taste/fingerprint", "?a=1", "/taste?a=1#fingerprint"],
	["/watch-next", "?sort=top", "/watch/movies?sort=top"],
	["/my-library", "?status=watching", "/watch/watching"],
	[
		"/my-library",
		"?status=seen&type=show&sort=score",
		"/watch/seen?sort=score",
	],
	["/my-library", "?status=want&q=dune", "/watch/movies/wishlist?q=dune"],
	["/my-library", "?status=nonsense", "/watch/movies/wishlist"],
]

for (const [from, search, to] of SHARED_ROWS)
	for (const [who, viewer] of VIEWERS)
		test(`${from}${search} → ${to}, 301 for a ${who}`, () => {
			assert.deepEqual(oldToNew(from, search, viewer), shared(to))
		})

// Rows that depend on who asks: [old, query, guest, member without a handle, member with handle "ana"]. Null: no
// redirect, the page stays.
const PERSONAL_ROWS: [
	string,
	string,
	string | null,
	string | null,
	string | null,
][] = [
	["/my-library", "", "/watch", "/taste", "/u/ana"],
	[
		"/my-library",
		"?status=unrated&sort=title",
		"/taste",
		"/taste",
		"/u/ana/scores/not-rated?sort=title",
	],
	[
		"/my-library/scores",
		"?sort=rated",
		"/taste",
		"/taste",
		"/u/ana/scores?sort=rated",
	],
	[
		"/my-library/not-rated",
		"?type=movie",
		"/taste",
		"/taste",
		"/u/ana/scores/not-rated",
	],
	["/taste", "?side=you", null, null, "/u/ana?side=you"],
	["/taste/quiz", "?mode=quick", null, null, "/u/ana/scores/rate?mode=quick"],
	["/taste/quiz", "?view=taste", null, null, "/u/ana/scores/rate?view=taste"],
	[
		"/wishlist",
		"?sortBy=highest_score",
		"/watch/movies?sortBy=highest_score",
		"/watch/movies/wishlist?sortBy=highest_score",
		"/watch/movies/wishlist?sortBy=highest_score",
	],
]

for (const [from, search, ...targets] of PERSONAL_ROWS)
	VIEWERS.forEach(([who, viewer], i) => {
		const to = targets[i]
		test(`${from}${search} for a ${who} → ${to ?? "stays"}`, () => {
			assert.deepEqual(oldToNew(from, search, viewer), to ? personal(to) : null)
		})
	})

test("the owner's /u/:h/seen, /wishlist and /shows go to Watch; visitors and ?as=visitor stay", () => {
	assert.deepEqual(
		oldToNew("/u/ana/seen", "", ANA),
		personal("/watch/movies/seen"),
	)
	assert.deepEqual(
		oldToNew("/u/ana/seen", "?type=show", ANA),
		personal("/watch/seen"),
	)
	assert.deepEqual(
		oldToNew("/u/Ana/wishlist", "?type=show", ANA),
		personal("/watch/not-started"),
	)
	assert.deepEqual(
		oldToNew("/u/ana/shows", "", ANA),
		personal("/watch/watching"),
	)
	assert.equal(oldToNew("/u/ana/seen", "?as=visitor", ANA), null)
	assert.equal(oldToNew("/u/ana/seen", "", member("bo")), null)
	assert.equal(oldToNew("/u/ana/wishlist", "", NO_HANDLE), null)
	assert.equal(oldToNew("/u/ana/shows", "", GUEST), null)
})

test("new addresses and pages that stay answer null", () => {
	for (const path of [
		"/watch",
		"/watch/movies",
		"/u/ana",
		"/u/ana/scores",
		"/settings/imports",
		"/discover",
		"/lists/mine",
		"/my-library/nope",
	])
		assert.equal(oldToNew(path, "", ANA), null, path)
})

test("a trailing slash and a leading ? both work", () => {
	assert.deepEqual(
		oldToNew("/my-shows/", "from=menu", GUEST),
		shared("/watch?from=menu"),
	)
	assert.deepEqual(
		oldToNew("/taste/", new URLSearchParams("side=x"), ANA),
		personal("/u/ana?side=x"),
	)
})

test("moveResponse: 301 has no Cache-Control, 302 is private, no-store with Vary: Cookie", () => {
	const permanent = moveResponse(shared("/watch"))
	assert.equal(permanent.status, 301)
	assert.equal(permanent.headers.get("Location"), "/watch")
	assert.equal(permanent.headers.get("Cache-Control"), null)
	const temporary = moveResponse(personal("/u/ana"))
	assert.equal(temporary.status, 302)
	assert.equal(temporary.headers.get("Cache-Control"), "private, no-store")
	assert.equal(temporary.headers.get("Vary"), "Cookie")
})
