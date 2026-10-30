// The command palette's pages: who sees which, what the empty palette offers, and what typing finds first.
import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import type { PaletteViewer } from "./palette-pages.ts"

const {
	ESSENTIALS,
	SCORE,
	essentialPages,
	matchPages,
	normalize,
	oneEditApart,
	palettePages,
	placePages,
	typeHint,
} = await import("./palette-pages.ts")

const member: PaletteViewer = {
	member: true,
	handle: "ana",
	signUpHref: "/sign-up",
}
const memberWithoutHandle: PaletteViewer = { ...member, handle: null }
const visitor: PaletteViewer = {
	member: false,
	handle: null,
	signUpHref: "/sign-up?redirectTo=%2F",
}

const keysOf = (pages: { key: string }[]) => pages.map((p) => p.key)
const top = (viewer: PaletteViewer, query: string, n = 1) =>
	keysOf(matchPages(palettePages(viewer), query).map((m) => m.page)).slice(0, n)

test("no two pages share a key or a name with the same section", () => {
	for (const viewer of [member, visitor]) {
		const pages = palettePages(viewer)
		assert.equal(new Set(keysOf(pages)).size, pages.length)
		const names = pages.map((p) => `${p.label} | ${p.sub ?? ""}`)
		assert.equal(new Set(names).size, names.length, "duplicate name")
	}
})

test("every page links inside the site", () => {
	for (const viewer of [member, visitor])
		for (const p of palettePages(viewer))
			assert.match(p.href, /^\/[^/]?/, p.key)
})

test("the pages named in the brief are all reachable by a member", () => {
	const hrefs = new Set(
		palettePages(member).map((p) => p.href.split(/[?#]/)[0]),
	)
	for (const path of [
		"/watch/shows",
		"/watch/shows/not-started",
		"/watch/shows/watching",
		"/watch/shows/on-hold",
		"/watch/shows/dropped",
		"/watch/seen",
		"/watch/movies",
		"/watch/movies/want",
		"/watch/seen",
		"/watch/for-you",
		"/u/ana",
		"/u/ana/stats",
		"/u/ana/tropes",
		"/u/ana/scores",
		"/u/ana/scores/not-rated",
		"/u/ana/scores/rate",
		"/settings",
		"/settings/not-interested",
		"/settings/export",
		"/settings/country",
		"/settings/services",
		"/settings/language",
		"/settings/discover-privacy",
		"/settings/profile",
		"/settings/account",
		"/settings/imports",
		"/settings/connected-apps",
		"/use-with-ai",
		"/support",
		"/discord",
		"/about",
		"/how-it-works",
		"/hot",
		"/movies/best",
		"/shows/best",
		"/people",
		"/blog",
		"/lists/mine",
		"/lists/new",
		"/movies/genres/horror",
		"/shows/moods",
	])
		assert.ok(hrefs.has(path), path)
})

test("a member without a handle gets /taste for Taste and /taste/quiz for rating", () => {
	const hrefs = new Map(
		palettePages(memberWithoutHandle).map((p) => [p.key, p.href]),
	)
	assert.equal(hrefs.get("taste"), "/taste")
	assert.equal(hrefs.get("tasteQuiz"), "/taste/quiz")
	assert.equal(hrefs.get("myScores"), "/taste")
	assert.equal(hrefs.get("tasteFingerprint"), "/taste#fingerprint")
	const visitorHrefs = new Map(
		palettePages(visitor).map((p) => [p.key, p.href]),
	)
	assert.equal(visitorHrefs.get("taste"), "/taste")
	assert.equal(visitorHrefs.get("tasteQuiz"), "/taste/quiz")
})

test("no page links to an address the new navigation retired", () => {
	for (const viewer of [member, memberWithoutHandle, visitor])
		for (const p of palettePages(viewer))
			assert.doesNotMatch(
				p.href,
				/^\/(my-shows|my-movies|my-library|for-you|watch-next|wishlist)(\/|$|\?)/,
				p.key,
			)
})

test("every settings page in the routes has a palette page", () => {
	const routes = readdirSync(new URL("../../routes/", import.meta.url))
		.filter((f) => /^settings\.[a-z-]+\.tsx$/.test(f))
		.map((f) => `/settings/${f.slice("settings.".length, -".tsx".length)}`)
	const hrefs = new Set(palettePages(member).map((p) => p.href))
	for (const path of routes) assert.ok(hrefs.has(path), path)
})

test("members and visitors see their own pages", () => {
	const memberKeys = new Set(keysOf(palettePages(member)))
	const visitorKeys = new Set(keysOf(palettePages(visitor)))
	for (const key of [
		"wishlist",
		"myScores",
		"settings",
		"imports",
		"profile",
		"profile-stats",
	])
		assert.ok(memberKeys.has(key) && !visitorKeys.has(key), key)
	for (const key of ["signUp", "signIn"])
		assert.ok(visitorKeys.has(key) && !memberKeys.has(key), key)
	for (const key of [
		"myShows",
		"myMovies",
		"forYou",
		"discover",
		"about",
		"feedback",
		"movies-genres-horror",
	])
		assert.ok(memberKeys.has(key) && visitorKeys.has(key), key)
})

test("before a member picks a handle, the profile row goes to picking one and the profile tabs are left out", () => {
	const pages = palettePages(memberWithoutHandle)
	const profile = pages.find((p) => p.key === "profile")
	assert.equal(profile?.href, "/settings/profile")
	assert.equal(profile?.sub, "Pick a handle first")
	assert.ok(!pages.some((p) => p.key.startsWith("profile-")))
})

test("the empty palette shows six to eight essentials, every one of them a page the viewer has", () => {
	for (const viewer of [member, visitor]) {
		const essentials = essentialPages(palettePages(viewer), viewer)
		const wanted = ESSENTIALS[viewer.member ? "member" : "visitor"]
		assert.deepEqual(keysOf(essentials), wanted)
		assert.ok(essentials.length >= 6 && essentials.length <= 8)
	}
	assert.deepEqual(
		keysOf(essentialPages(palettePages(visitor), visitor)).at(-1),
		"signUp",
	)
})

test("the hint rounds the page count down to tens", () => {
	assert.equal(
		typeHint(147),
		"Type to search 140+ pages, plus every title and person",
	)
	assert.equal(
		typeHint(12),
		"Type to search 12 pages, plus every title and person",
	)
	assert.ok(palettePages(visitor).length >= 60)
})

test("normalize drops case, accents, emoji and punctuation, and reads & as and", () => {
	assert.equal(normalize("  Café  Déjà-vu! "), "cafe deja vu")
	assert.equal(normalize("War & Politics"), "war and politics")
	assert.equal(normalize("Scary 👻"), "scary")
	assert.equal(normalize("Don’t"), "dont")
})

test("one edit apart: a letter wrong, missing, extra, or two swapped", () => {
	assert.ok(oneEditApart("setings", "settings"))
	assert.ok(oneEditApart("settigns", "settings"))
	assert.ok(oneEditApart("sertings", "settings"))
	assert.ok(oneEditApart("settingss", "settings"))
	assert.ok(!oneEditApart("stings", "settings"))
	assert.ok(!oneEditApart("abcd", "dcba"))
})

test("typing a page's name finds it first", () => {
	assert.deepEqual(top(member, "settings"), ["settings"])
	assert.deepEqual(top(member, "Taste"), ["taste"])
	assert.deepEqual(top(member, "Profile"), ["taste"])
	assert.deepEqual(top(member, "for you"), ["forYou"])
	assert.deepEqual(top(member, "up next"), ["myShows"])
	assert.deepEqual(top(member, "not interested"), ["notInterested"])
	assert.deepEqual(top(visitor, "about"), ["about"])
	assert.deepEqual(top(member, "feedback"), ["feedback"])
	assert.deepEqual(top(member, "discord"), ["discordBot"])
	assert.deepEqual(top(member, "imports"), ["imports"])
})

test("settings finds the settings page first and every settings page after it", () => {
	const matches = matchPages(palettePages(member), "settings")
	assert.equal(matches[0].page.key, "settings")
	const subs = matches.slice(1).filter((m) => m.page.sub === "Settings")
	assert.equal(subs.length, 10)
	assert.ok(subs.every((m) => m.score === SCORE.section))
})

test("synonyms find pages", () => {
	assert.deepEqual(top(member, "letterboxd"), ["imports"])
	assert.deepEqual(top(member, "netflix", 3).includes("services"), true)
	assert.deepEqual(top(member, "recommendations"), ["forYou"])
	assert.deepEqual(top(member, "watchlist"), ["wishlist"])
	assert.deepEqual(top(member, "password"), ["account"])
	assert.deepEqual(top(visitor, "login"), ["signIn"])
	assert.deepEqual(top(member, "trending"), ["hot"])
	assert.deepEqual(top(member, "actors"), ["people"])
	assert.deepEqual(top(member, "mcp", 2).sort(), ["connectedApps", "useWithAi"])
	assert.deepEqual(top(member, "country"), ["country"])
})

test("new finds the page named New first, then the newest releases", () => {
	assert.deepEqual(top(member, "new", 2), ["new", "discoverNewest"])
	assert.deepEqual(top(visitor, "new"), ["new"])
})

test("prefixes and several words find pages", () => {
	assert.deepEqual(top(member, "sett"), ["settings"])
	assert.deepEqual(top(member, "hot on"), ["hot"])
	assert.deepEqual(top(member, "best shows"), ["bestShows"])
	assert.deepEqual(top(member, "horror", 2), ["movies-genres-horror"])
	assert.deepEqual(top(member, "comedy", 2), [
		"movies-genres-comedy",
		"shows-genres-comedy",
	])
	assert.deepEqual(top(member, "scary mov"), ["movies-moods-scary"])
	assert.deepEqual(top(member, "netflix shows"), ["shows-streaming-netflix"])
})

test("a typo in a longer word still finds the page", () => {
	assert.deepEqual(top(member, "setings"), ["settings"])
	assert.deepEqual(top(member, "discvoer"), ["discover"])
	assert.deepEqual(matchPages(palettePages(member), "xyzzy"), [])
})

test("the main places win ties over the lists by mood and genre", () => {
	assert.deepEqual(top(member, "movies"), ["movies"])
	assert.deepEqual(top(member, "shows"), ["shows"])
})

test("pages named exactly go above the search row, strong matches above the titles, the rest under them", () => {
	const pages = palettePages(member)
	const settings = placePages(matchPages(pages, "settings"))
	assert.deepEqual(keysOf(settings.first), ["settings"])
	assert.equal(settings.beforeTitles.length, 6)
	assert.ok(settings.beforeTitles.every((p) => p.sub === "Settings"))
	assert.ok(settings.afterTitles.length <= 4)

	const typo = placePages(matchPages(pages, "setings"))
	assert.deepEqual(keysOf(typo.first), [])
	assert.deepEqual(keysOf(typo.beforeTitles), [])
	assert.equal(typo.afterTitles[0].key, "settings")

	const prefix = placePages(matchPages(pages, "disc"))
	assert.deepEqual(keysOf(prefix.first), [])
	assert.equal(prefix.beforeTitles[0].key, "discover")
})

test("the call to action and the feedback action don't match by their long line", () => {
	assert.ok(!top(visitor, "learn your taste", 5).includes("signUp"))
	assert.ok(!top(member, "something", 5).includes("feedback"))
})

test("a list by genre ranks under the search row, so Enter still searches", () => {
	const placed = placePages(matchPages(palettePages(member), "horror"))
	assert.deepEqual(keysOf(placed.first), [])
	assert.equal(placed.beforeTitles[0].key, "movies-genres-horror")
})

test("a visitor typing a member page's name finds Sign in", () => {
	for (const q of ["settings", "my library", "imports"])
		assert.deepEqual(top(visitor, q), ["signIn"], q)
})
