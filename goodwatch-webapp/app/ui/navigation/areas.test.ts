// The navigation's areas: which area each page belongs to, the tabs and which one is current, Watch's chips and its
// To watch | Seen switch, the Taste row for owners, visitors and members without a handle, and the places list.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	GUEST,
	RATE_FALLBACK_PATH,
	SETTINGS_PATHS,
	WATCH_PATHS,
	member,
} from "../../domain/member-paths.ts"
import {
	MENU_FOOTER,
	MENU_SETUP,
	MENU_WATCH,
	SETTINGS_COLUMN,
	SETTINGS_PLACES,
	areaKeys,
	areaOf,
	bestSwitch,
	exploreTabs,
	litArea,
	placeHere,
	scoresSwitch,
	tasteRow,
	watchChips,
	watchPlaceOf,
	watchTabs,
} from "./areas.ts"

const ANA = member("ana")
const NO_HANDLE = member(null)
const hereOf = (tabs: { key: string; here: boolean }[]) =>
	tabs.filter((t) => t.here).map((t) => t.key)

test("areaOf: Watch, Explore, Taste, or none", () => {
	const cases: [string, ReturnType<typeof areaOf>][] = [
		["/watch/shows", "watch"],
		["/watch/seen", "watch"],
		["/watch/for-you", "watch"],
		["/discover", "explore"],
		["/discover/movies", "explore"],
		["/new", "explore"],
		["/new/de/netflix", "explore"],
		["/hot", "explore"],
		["/movies/best", "explore"],
		["/shows/drama", "explore"],
		["/people", "explore"],
		["/map", "explore"],
		["/u/ana", "taste"],
		["/u/bo/stats/numbers", "taste"],
		["/settings", "taste"],
		["/settings/imports", "taste"],
		["/taste", "taste"],
		["/taste/quiz", "taste"],
		["/lists/new", "taste"],
		["/", null],
		["/movie/123-dune", null],
		["/person/1-ana", null],
		["/use-with-ai", null],
		["/discord", null],
		["/support", null],
		["/watchlist", null],
	]
	for (const [path, area] of cases) assert.equal(areaOf(path), area, path)
})

test("litArea: a guest on a profile lights no key; a member on someone else's lights Taste", () => {
	assert.equal(litArea("/u/bo", GUEST), null)
	assert.equal(litArea("/u/bo", ANA), "taste")
	assert.equal(litArea("/taste", GUEST), "taste")
	assert.equal(litArea("/watch/shows", GUEST), "watch")
})

test("areaKeys: Taste leads to the profile, or /taste without a handle", () => {
	assert.deepEqual(
		areaKeys(ANA).map((a) => [a.key, a.href]),
		[
			["watch", "/watch/shows"],
			["explore", "/discover"],
			["taste", "/u/ana"],
		],
	)
	assert.equal(areaKeys(NO_HANDLE)[2].href, "/taste")
	assert.equal(areaKeys(GUEST)[2].href, "/taste")
})

test("the third key says Profile, and every tab of every area has an icon", () => {
	assert.deepEqual(
		areaKeys(ANA).map((a) => a.label),
		["Watch", "Explore", "Profile"],
	)
	const rows = [
		watchTabs("/watch/shows"),
		exploreTabs("/discover"),
		tasteRow({ pathname: "/u/ana", viewer: ANA })?.tabs ?? [],
		tasteRow({ pathname: "/u/bo", viewer: ANA })?.trailing ?? [],
		tasteRow({ pathname: "/taste", viewer: GUEST })?.tabs ?? [],
	]
	for (const tabs of rows) {
		assert.ok(tabs.length > 0)
		for (const tab of tabs) assert.ok(tab.icon, tab.key)
	}
})

test("Watch: tabs, the To watch | Seen switch and the chips for every page", () => {
	const cases: [string, string, "to-watch" | "seen" | null, string | null][] = [
		["/watch/shows", "up-next", "to-watch", "next-episodes"],
		["/watch/shows/not-started", "up-next", "to-watch", "not-started"],
		["/watch/shows/watching", "up-next", "to-watch", "watching"],
		["/watch/shows/on-hold", "up-next", "to-watch", "on-hold"],
		["/watch/shows/dropped", "up-next", "to-watch", "dropped"],
		["/watch/seen", "up-next", "seen", null],
		["/watch/movies", "ready", "to-watch", "tonight"],
		["/watch/movies/want", "ready", "to-watch", "wishlist"],
		["/watch/for-you", "for-you", null, null],
		["/watch/for-you/tropes", "for-you", null, null],
	]
	for (const [path, tab, side, chip] of cases) {
		assert.deepEqual(watchPlaceOf(path), { tab, side, chip }, path)
		assert.deepEqual(hereOf(watchTabs(path)), [tab], path)
		const chips = watchChips(path)
		assert.deepEqual(
			chips ? hereOf(chips.choices) : null,
			chip ? [chip] : null,
			path,
		)
	}
	assert.equal(watchPlaceOf("/watch/nope"), null)
	assert.equal(watchPlaceOf("/discover"), null)
})

test("Watch tabs read My shows, My movies, Recommendations, each with its second line", () => {
	assert.deepEqual(
		watchTabs("/watch/shows").map((t) => [t.label, t.sub, t.href]),
		[
			["My shows", "Up next", "/watch/shows"],
			["My movies", "Ready to watch", "/watch/movies"],
			["Recommendations", "Curated For You", "/watch/for-you"],
		],
	)
})

test("the chips point at their own tab's pages and carry counts", () => {
	assert.deepEqual(
		watchChips("/watch/movies", { wishlist: 40 })?.choices.map((c) => [
			c.label,
			c.count,
		]),
		[
			["Next Movie", undefined],
			["Want to Watch", 40],
		],
	)
	assert.equal(watchChips("/watch/shows")?.choices.length, 5)
})

test("Explore tabs: one current tab per page; Best covers both kinds; guests' New goes to their country", () => {
	const cases: [string, string[]][] = [
		["/discover", ["discover"]],
		["/new/de", ["new"]],
		["/hot", ["hot"]],
		["/movies/best", ["best"]],
		["/shows/best", ["best"]],
		["/movies", ["movies"]],
		["/movies/drama/2", ["movies"]],
		["/shows", ["shows"]],
		["/people", ["people"]],
		["/map", ["map"]],
	]
	for (const [path, here] of cases)
		assert.deepEqual(hereOf(exploreTabs(path)), here, path)
	assert.equal(
		exploreTabs("/discover", { newHref: "/new/de" }).find(
			(t) => t.key === "new",
		)?.href,
		"/new/de",
	)
	assert.deepEqual(hereOf(bestSwitch("/shows/best")?.choices ?? []), ["shows"])
	assert.equal(bestSwitch("/movies"), null)
})

test("Taste row, owner: five tabs with Rate more after Scores, the gear, the current tab per page", () => {
	const cases: [string, string[]][] = [
		["/u/ana", ["profile"]],
		["/u/ana/tropes", ["tropes"]],
		["/u/ana/scores", ["scores"]],
		["/u/ana/scores/not-rated", ["scores"]],
		["/u/ana/scores/rate", ["rate"]],
		["/u/ana/scores/rate/", ["rate"]],
		["/u/ana/stats", ["stats"]],
		["/u/ana/stats/numbers", ["stats"]],
		["/u/ana/lists", ["lists"]],
		["/u/ana/lists/abc", ["lists"]],
		["/settings", []],
		["/settings/imports", []],
	]
	for (const [path, here] of cases) {
		const row = tasteRow({
			pathname: path,
			viewer: ANA,
			counts: { scores: 300 },
		})
		assert.ok(row, path)
		assert.deepEqual(hereOf(row.tabs), here, path)
		assert.deepEqual(
			row.tabs.map((t) => t.label),
			["Taste", "Tropes", "Scores", "Rate more", "Lists", "Stats"],
		)
		assert.deepEqual(row.trailing, [])
		assert.deepEqual(
			row.gear,
			{ href: "/settings", here: path.startsWith("/settings") },
			path,
		)
		assert.equal(row.tabs[2].count, 300)
	}
	assert.equal(
		tasteRow({ pathname: "/u/ana", viewer: ANA })?.tabs[0].href,
		"/u/ana",
	)
	assert.equal(tasteRow({ pathname: "/watch/shows", viewer: ANA }), null)
	// Same label and icon as the guests' Rate more.
	const guestRate = tasteRow({ pathname: "/taste", viewer: GUEST })?.tabs[1]
	const rate = tasteRow({ pathname: "/u/ana", viewer: ANA })?.tabs[3]
	assert.deepEqual(
		[rate?.key, rate?.label, rate?.href, rate?.icon === guestRate?.icon],
		["rate", "Rate more", "/u/ana/scores/rate", true],
	)
})

test("Taste row: Rate more is the owner's own tab, never in a visitor's view", () => {
	for (const [path, search, viewer] of [
		["/u/ana", "?as=visitor", ANA],
		["/u/ana/scores", "?as=visitor", ANA],
		["/u/bo", "", ANA],
		["/u/bo/scores", "", ANA],
		["/u/bo", "", GUEST],
	] as const) {
		const row = tasteRow({ pathname: path, search, viewer })
		assert.ok(row, path)
		const keys = row.tabs.concat(row.trailing).map((t) => t.key)
		assert.ok(!keys.includes("rate"), `${path}${search}`)
	}
})

test("Taste row, owner as visitor: visitor tabs keep ?as=visitor, no gear", () => {
	const row = tasteRow({
		pathname: "/u/ana/stats",
		search: "?as=visitor",
		viewer: ANA,
	})
	assert.ok(row)
	assert.equal(row.label, "Profile")
	assert.equal(row.asVisitor, true)
	assert.equal(row.gear, null)
	assert.equal(row.tabs[0].href, "/u/ana?as=visitor")
	assert.deepEqual(
		row.trailing.map((t) => t.href),
		[
			"/u/ana/seen?as=visitor",
			"/u/ana/want?as=visitor",
			"/u/ana/shows?as=visitor",
		],
	)
})

test("Taste row, someone else's profile: a member sees the Taste chrome, a guest sees @handle without the area icon", () => {
	const asMember = tasteRow({ pathname: "/u/bo/seen", viewer: ANA })
	assert.ok(asMember)
	assert.equal(asMember.label, "@bo")
	assert.equal(asMember.areaIcon, true)
	assert.equal(asMember.gear, null)
	assert.deepEqual(hereOf(asMember.trailing), ["seen"])
	assert.equal(asMember.tabs[0].href, "/u/bo")
	const asGuest = tasteRow({ pathname: "/u/bo", viewer: GUEST })
	assert.ok(asGuest)
	assert.equal(asGuest.areaIcon, false)
	assert.equal(asGuest.label, "@bo")
	assert.deepEqual(
		asGuest.trailing.map((t) => t.label),
		["Seen", "Wishlist", "Shows"],
	)
})

test("Taste row: visible and mark narrow the tabs; marks show to the owner only", () => {
	const visible = (tab: string) => tab !== "tropes" && tab !== "wishlist"
	const mark = (tab: string) => (tab === "lists" ? ("me" as const) : undefined)
	const owner = tasteRow({ pathname: "/u/ana", viewer: ANA, visible, mark })
	assert.deepEqual(
		owner?.tabs.map((t) => t.key),
		["profile", "scores", "rate", "lists", "stats"],
	)
	assert.equal(owner?.tabs.find((t) => t.key === "lists")?.mark, "me")
	const visitor = tasteRow({ pathname: "/u/ana", viewer: GUEST, visible, mark })
	assert.deepEqual(
		visitor?.trailing.map((t) => t.key),
		["seen", "shows"],
	)
	assert.equal(visitor?.tabs.at(-1)?.mark, undefined)
})

test("Profile row without a profile: Taste → /taste, Rate more → /taste/quiz, Lists, the gear for members", () => {
	for (const [path, viewer, here, gear] of [
		["/taste", NO_HANDLE, "profile", { href: "/settings", here: false }],
		["/taste/quiz", NO_HANDLE, "rate", { href: "/settings", here: false }],
		["/settings/profile", NO_HANDLE, null, { href: "/settings", here: true }],
		["/lists/mine", NO_HANDLE, "lists", { href: "/settings", here: false }],
		["/taste", GUEST, "profile", null],
		["/taste/quiz", GUEST, "rate", null],
		["/lists/new", GUEST, "lists", null],
	] as const) {
		const row = tasteRow({ pathname: path, viewer })
		assert.ok(row, path)
		assert.equal(row.handle, null)
		assert.equal(row.label, "Profile")
		assert.deepEqual(
			row.tabs.map((t) => [t.label, t.href]),
			[
				["Taste", "/taste"],
				["Rate more", "/taste/quiz"],
				["Lists", viewer === GUEST ? "/lists/new" : "/lists/mine"],
			],
		)
		assert.deepEqual(hereOf(row.tabs), here ? [here] : [], path)
		assert.deepEqual(row.gear, gear, path)
	}
})

test("Scores switch: Scored | Not rated on the two score pages only", () => {
	const sw = scoresSwitch("ana", "/u/ana/scores/not-rated", {
		scored: 300,
		notRated: 12,
	})
	assert.deepEqual(
		sw?.choices.map((c) => [c.label, c.href, c.here, c.count]),
		[
			["Scored", "/u/ana/scores", false, 300],
			["Not rated", "/u/ana/scores/not-rated", true, 12],
		],
	)
	assert.equal(scoresSwitch("ana", "/u/ana/scores/rate"), null)
	assert.equal(scoresSwitch("ana", "/u/ana/stats"), null)
})

test("Menu: Watch leads to the Watch pages and what's new on the member's services", () => {
	assert.deepEqual(
		MENU_WATCH.map((p) => [p.label, p.href]),
		[
			["My shows", WATCH_PATHS.nextEpisodes],
			["My movies", WATCH_PATHS.tonight],
			["New on my services", "/new"],
			["Recommendations", WATCH_PATHS.forYou],
		],
	)
	assert.equal(MENU_WATCH[0].badge, "new-episodes")
})

test("Menu: Set up has one Settings row; the Settings column keeps every settings row", () => {
	assert.deepEqual(
		MENU_SETUP.map((p) => [p.label, p.href]),
		[
			["Settings", SETTINGS_PATHS.home],
			["Import", SETTINGS_PATHS.imports],
			["Use with AI", "/use-with-ai"],
			["Discord bot", "/discord"],
		],
	)
	const menu = new Set(
		[...MENU_WATCH, ...MENU_SETUP, ...MENU_FOOTER].map((p) => p.id),
	)
	const column = new Set(
		SETTINGS_COLUMN.flatMap((g) => g.places.map((p) => p.id)),
	)
	for (const p of SETTINGS_PLACES) {
		assert.ok(column.has(p.id), p.id)
		assert.ok(!menu.has(p.id), p.id)
	}
})

test("Menu: the footer has real addresses, Feedback acts instead of navigating", () => {
	const href = (id: string) => MENU_FOOTER.find((p) => p.id === id)?.href
	assert.equal(href("how-it-works"), "/how-it-works")
	assert.equal(href("about"), "/about")
	const feedback = MENU_FOOTER.find((p) => p.id === "feedback")
	assert.equal(feedback?.href, undefined)
	assert.equal(feedback?.action, "feedback")
	for (const p of [...MENU_WATCH, ...MENU_SETUP, ...MENU_FOOTER])
		assert.ok(p.href || p.action, p.id)
})

test("placeHere: All settings only on /settings, other rows on their page and below", () => {
	const all = SETTINGS_COLUMN.flatMap((g) => g.places)
	const here = (path: string) =>
		all.filter((p) => placeHere(p, path)).map((p) => p.id)
	assert.deepEqual(here("/settings"), ["settings"])
	assert.deepEqual(here("/settings/imports"), ["imports"])
	assert.deepEqual(here("/settings/services/"), ["services"])
})
