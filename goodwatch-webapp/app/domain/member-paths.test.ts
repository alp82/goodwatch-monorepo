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
	assert.equal(watchSeenPath("show"), "/watch/seen?type=show")
	assert.equal(watchSeenPath("movie"), "/watch/seen?type=movie")
	const paths = new Set<string>(Object.values(WATCH_PATHS))
	for (const slug of Object.keys(WATCH_SHOW_LISTS))
		assert.ok(paths.has(`/watch/shows/${slug}`), slug)
	for (const slug of Object.keys(WATCH_MOVIE_LISTS))
		assert.ok(paths.has(`/watch/movies/${slug}`), slug)
	assert.deepEqual(WATCH_SHOW_LISTS["not-started"], {
		status: "want",
		kind: "show",
		sort: null,
	})
	assert.equal(WATCH_MOVIE_LISTS.recent, undefined)
	assert.deepEqual(WATCH_MOVIE_LISTS.want, {
		status: "want",
		kind: "movie",
		sort: null,
	})
})

test("statusHome: library statuses land on Watch, Not rated on Taste", () => {
	assert.equal(statusHome("want", "all", ANA), "/watch/movies/want")
	assert.equal(statusHome("want", "movie", ANA), "/watch/movies/want")
	assert.equal(statusHome("want", "show", ANA), "/watch/shows/not-started")
	assert.equal(statusHome("seen", "show", ANA), "/watch/seen")
	assert.equal(statusHome("seen", "all", ANA), "/watch/seen")
	assert.equal(statusHome("on_hold", "all", GUEST), "/watch/shows/on-hold")
	assert.equal(statusHome("unrated", "all", ANA), "/u/ana/scores/not-rated")
	assert.equal(statusHome("unrated", "all", NO_HANDLE), "/taste")
})

// Rows that are the same for everyone: 301, query kept.
const SHARED_ROWS: [string, string, string][] = [
	["/watch", "", "/watch/shows"],
	["/u/ana/taste", "?x=1", "/u/ana/stats?x=1"],
	["/u/ana/taste/everyone", "", "/u/ana/stats/everyone"],
	["/hot-on-socials", "?from=menu", "/hot?from=menu"],
	["/explorer", "?grouping=mood", "/map?grouping=mood"],
	["/settings/streaming", "?from=menu", "/settings/services?from=menu"],
	["/settings/where-you-watch", "", "/settings/country"],
	["/my-shows", "?from=menu", "/watch/shows?from=menu"],
	["/my-movies", "", "/watch/movies"],
	["/for-you", "?mood=cozy", "/watch/for-you?mood=cozy"],
	[
		"/my-library/want",
		"?sort=title&type=show",
		"/watch/shows/not-started?sort=title",
	],
	["/my-library/want", "?type=movie", "/watch/movies/want"],
	[
		"/my-library/seen",
		"?type=show&sort=score",
		"/watch/seen?type=show&sort=score",
	],
	["/my-library/seen", "?type=movie", "/watch/seen?type=movie"],
	["/my-library/seen", "?q=alien", "/watch/seen?q=alien"],
	["/my-library/watching", "", "/watch/shows/watching"],
	["/my-library/on-hold", "?sort=title", "/watch/shows/on-hold?sort=title"],
	["/my-library/dropped", "", "/watch/shows/dropped"],
	["/my-library/hidden", "?from=menu", "/settings/not-interested?from=menu"],
	["/settings/hidden", "", "/settings/not-interested"],
	["/watch-next", "?sort=top", "/watch/movies?sort=top"],
	["/my-library", "?status=watching", "/watch/shows/watching"],
	[
		"/my-library",
		"?status=seen&type=show&sort=score",
		"/watch/seen?type=show&sort=score",
	],
	["/my-library", "?status=want&q=dune", "/watch/movies/want?q=dune"],
	["/my-library", "?status=nonsense", "/watch/movies/want"],
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
	["/my-library", "", "/watch/shows", "/taste", "/u/ana"],
	[
		"/taste/everyone",
		"?view=taste",
		"/taste?view=taste#everyone",
		"/taste?view=taste#everyone",
		"/u/ana?view=taste#everyone",
	],
	[
		"/taste/fingerprint",
		"",
		"/taste#fingerprint",
		"/taste#fingerprint",
		"/u/ana#fingerprint",
	],
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
		"/watch/movies",
		"/watch/movies/want",
		"/watch/movies/want",
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
	assert.deepEqual(oldToNew("/u/ana/seen", "", ANA), personal("/watch/seen"))
	assert.deepEqual(
		oldToNew("/u/ana/seen", "?type=show", ANA),
		personal("/watch/seen?type=show"),
	)
	assert.deepEqual(
		oldToNew("/u/Ana/wishlist", "?type=show", ANA),
		personal("/watch/shows/not-started"),
	)
	assert.deepEqual(
		oldToNew("/u/ana/shows", "", ANA),
		personal("/watch/shows/watching"),
	)
	assert.equal(oldToNew("/u/ana/seen", "?as=visitor", ANA), null)
	assert.equal(oldToNew("/u/ana/seen", "", member("bo")), null)
	assert.deepEqual(
		oldToNew("/u/ana/wishlist", "", NO_HANDLE),
		shared("/u/ana/want"),
	)
	assert.equal(oldToNew("/u/ana/shows", "", GUEST), null)
})

test("new addresses and pages that stay answer null", () => {
	for (const path of [
		"/watch/shows",
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
		shared("/watch/shows?from=menu"),
	)
	assert.deepEqual(
		oldToNew("/taste/", new URLSearchParams("side=x"), ANA),
		personal("/u/ana?side=x"),
	)
})

test("moveResponse: 301 has no Cache-Control, 302 is private, no-store with Vary: Cookie", () => {
	const permanent = moveResponse(shared("/watch/shows"))
	assert.equal(permanent.status, 301)
	assert.equal(permanent.headers.get("Location"), "/watch/shows")
	assert.equal(permanent.headers.get("Cache-Control"), null)
	const temporary = moveResponse(personal("/u/ana"))
	assert.equal(temporary.status, 302)
	assert.equal(temporary.headers.get("Cache-Control"), "private, no-store")
	assert.equal(temporary.headers.get("Vary"), "Cookie")
})

// Every source in the table must land on a page for the same viewer, including section fragments.
test("every redirect lands in one hop", () => {
	const addresses = [
		...SHARED_ROWS.map(([p, q]) => p + q),
		...PERSONAL_ROWS.map(([p, q]) => p + q),
		"/watch",
		"/hot-on-socials?x=1",
		"/explorer?grouping=mood",
		"/taste/everyone?view=taste",
		"/taste/fingerprint",
		...["seen", "wishlist", "want", "shows"].flatMap((tab) =>
			["", "?type=show&sort=title", "?as=visitor"].map(
				(q) => `/u/ana/${tab}${q}`,
			),
		),
		"/lists/new",
		"/u/bo/lists/new",
	]
	for (const [, viewer] of VIEWERS)
		for (const address of addresses) {
			const url = new URL(address, "https://goodwatch.app")
			const move = oldToNew(url.pathname, url.search, viewer)
			if (!move) continue
			const target = new URL(move.to, url)
			assert.equal(
				oldToNew(target.pathname, target.search, viewer),
				null,
				`${address} -> ${move.to}`,
			)
		}
})
test("branch-only addresses have no compatibility redirects", () => {
	for (const [, viewer] of VIEWERS)
		for (const address of [
			"/watch/watching",
			"/watch/not-started",
			"/watch/on-hold",
			"/watch/dropped",
			"/watch/movies/wishlist",
			"/watch/movies/recent",
			"/watch/movies/seen",
		])
			assert.equal(oldToNew(address, "", viewer), null)
})

test("wishlist legacy sort maps only Recently added", () => {
	for (const [, viewer] of VIEWERS) {
		const move = oldToNew(
			"/wishlist",
			"?sortBy=most_recently_added&q=dune",
			viewer,
		)!
		assert.equal(
			new URL(move.to, "https://goodwatch.app").search,
			"?q=dune&sort=added",
		)
		assert.equal(move.status, 302)
		assert.equal(move.private, true)
	}
})
