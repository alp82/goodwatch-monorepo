import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { FILTER_NAMES, defaultFilterState } = await import(
	"~/domain/filter-state"
)
const { MOOD_BY_KEY } = await import("~/domain/moods")
const { THEME_BY_KEY } = await import("~/domain/themes-styles")
const { activeChips } = await import("~/ui/filter-bar/labels")
const { titleKey } = await import("~/utils/title-key")
const {
	GROUP_PLACES,
	MAIN_TABS,
	SUB_TABS,
	clearAll,
	clearAllCount,
	defaultSubTab,
	groupsOf,
	headPlus,
	isSubTabShown,
	subTabBadge,
	subTabShown,
	subTabsOf,
	tabBadge,
	tabValues,
} = await import("./tabs.ts")

type State = ReturnType<typeof defaultFilterState>
type Context = Parameters<typeof tabBadge>[2]

const LADDER = {
	country: "US",
	local: true,
	steps: [
		{ age: 0, label: "G", show: "TV-G" },
		{ age: 8, label: "PG", show: "TV-PG" },
		{ age: 14, label: "PG-13", show: "TV-14" },
		{ age: 17, label: "R", show: "TV-MA" },
	],
}
const member: Context = { member: true, ladder: LADDER, query: null }
const guest: Context = { member: false, ladder: LADDER, query: null }
const empty = defaultFilterState({ onMyServices: false, notSeenYet: false })
const severance = titleKey("show", 95396)

/** One or more choices on every sub-tab that has a filter group. */
const busy: State = {
	...empty,
	type: "movie",
	similarTo: [severance],
	people: [17419, 1245],
	moods: ["funny", "scary"],
	themes: ["crime"],
	genres: ["Drama"],
	services: [8],
	minScore: 80,
	sourceScores: { imdb: 70, metacritic: 80 },
	productionCountries: ["FR"],
	runtime: { max: 120 },
	years: { min: 1990, max: 1999 },
	ageLimit: 14,
	minMatch: 80,
	notSeenYet: true,
}
const searching: Context = { ...member, query: "space" }

const shownIds = (
	tab: (typeof MAIN_TABS)[number],
	state: State,
	context: Context,
) => subTabsOf(tab, state, context).map((sub) => sub.id)

test("four main tabs, each with its sub-tabs", () => {
	assert.deepEqual(MAIN_TABS, ["search", "mood", "watch", "you"])
	assert.deepEqual(shownIds("search", empty, member), ["titles", "people"])
	assert.deepEqual(shownIds("mood", empty, member), ["combos", "everything"])
	assert.deepEqual(shownIds("watch", empty, member), [
		"services",
		"scores",
		"popularity",
		"shows",
		"madeIn",
		"released",
		"length",
		"budget",
		"age",
	])
	assert.deepEqual(shownIds("you", empty, member), ["taste"])
})

test("every filter group has its place, in a sub-tab that exists", () => {
	assert.deepEqual(Object.keys(GROUP_PLACES).sort(), [...FILTER_NAMES].sort())
	const ids = new Set(SUB_TABS.map((sub) => sub.id))
	for (const { subTab } of Object.values(GROUP_PLACES))
		if (subTab) assert.ok(ids.has(subTab), subTab)
	assert.deepEqual(groupsOf("scores"), ["minScore", "sourceScores", "scoreGap"])
	assert.deepEqual(groupsOf("taste"), ["minMatch", "notSeenYet", "wishlist"])
})

test("a sub-tab counts its choices, and a tab's badge is the sum of its sub-tabs", () => {
	const badge = (id: Parameters<typeof subTabBadge>[0]) =>
		subTabBadge(id, busy, searching)
	assert.equal(badge("titles"), 3) // the search, Like Severance, Movies
	assert.equal(badge("people"), 2)
	// The picks count on Everything, not Combos.
	assert.equal(badge("combos"), 0)
	assert.equal(badge("everything"), 4)
	assert.equal(badge("services"), 1)
	assert.equal(badge("scores"), 3)
	assert.equal(badge("madeIn"), 1)
	assert.equal(badge("released"), 1)
	assert.equal(badge("length"), 1)
	assert.equal(badge("age"), 1)
	assert.equal(badge("taste"), 2)
	for (const tab of MAIN_TABS)
		assert.equal(
			tabBadge(tab, busy, searching),
			subTabsOf(tab, busy, searching).reduce(
				(n, sub) => n + subTabBadge(sub.id, busy, searching),
				0,
			),
			tab,
		)
	assert.deepEqual(
		MAIN_TABS.map((tab) => tabBadge(tab, busy, searching)),
		[5, 4, 8, 2],
	)
	// Without a ladder, Age and content hides and its choice doesn't count.
	const noLadder = { ...searching, ladder: null }
	assert.ok(!isSubTabShown("age", busy, noLadder))
	assert.equal(tabBadge("watch", busy, noLadder), 7)
	// On my services is the member's default: it counts nowhere. Not seen yet counts on You.
	const defaults = { ...empty, onMyServices: true, notSeenYet: true }
	assert.deepEqual(
		MAIN_TABS.map((tab) => tabBadge(tab, defaults, member)),
		[0, 0, 0, 1],
	)
})

test("Clear all counts the search and every chip, and keeps On my services and Not seen yet", () => {
	assert.equal(clearAllCount(empty, member), 0)
	const defaults = { ...empty, onMyServices: true, notSeenYet: true }
	assert.equal(clearAllCount(defaults, member), 0)
	// Everything the tabs count except Not seen yet.
	const total = MAIN_TABS.reduce(
		(n, tab) => n + tabBadge(tab, busy, searching),
		0,
	)
	assert.equal(clearAllCount(busy, searching), total - 1)
	const cleared = clearAll({ ...busy, onMyServices: true })
	assert.equal(cleared.onMyServices, true)
	assert.equal(cleared.notSeenYet, true)
	assert.deepEqual(activeChips(cleared), [])
	assert.deepEqual(
		MAIN_TABS.map((tab) => tabBadge(tab, cleared, member)),
		[0, 0, 0, 1],
	)
	// Old URLs' filters live in no tab, but Clear all counts and clears them.
	const legacy = { ...empty, legacy: { maxScore: "90" } }
	assert.equal(clearAllCount(legacy, member), 1)
	assert.equal(clearAll(legacy).legacy, undefined)
})

test("Budget and Shows follow the list's kind, Age the ladder", () => {
	const budget = SUB_TABS.find((sub) => sub.id === "budget")
	const shows = SUB_TABS.find((sub) => sub.id === "shows")
	assert.ok(budget && shows)
	for (const type of ["all", "movie", "show"] as const) {
		const state = { ...empty, type }
		assert.equal(isSubTabShown("budget", state, member), type !== "show")
		assert.equal(isSubTabShown("shows", state, member), type !== "movie")
	}
	// Active choices keep their tab reachable after switching kind.
	assert.ok(
		isSubTabShown(
			"budget",
			{ ...empty, type: "show", budget: { min: 100 } },
			member,
		),
	)
	assert.ok(
		isSubTabShown(
			"shows",
			{ ...empty, type: "movie", showStatus: "ended" },
			member,
		),
	)
	assert.ok(!subTabShown(budget, [], empty, member))
	assert.ok(isSubTabShown("age", empty, member))
	assert.ok(!isSubTabShown("age", empty, { ...member, ladder: undefined }))
})

test("each tab opens on its first sub-tab; Mood on Everything once something is picked", () => {
	assert.deepEqual(
		MAIN_TABS.map((tab) => defaultSubTab(tab, empty)),
		["titles", "combos", "services", "taste"],
	)
	assert.equal(
		defaultSubTab("mood", { ...empty, genres: ["Drama"] }),
		"everything",
	)
	assert.equal(
		defaultSubTab("mood", { ...empty, styles: ["slow"] }),
		"everything",
	)
})

test("value lines read the choices, and empty tabs show their placeholders", () => {
	const blank = tabValues(empty, member)
	assert.deepEqual(
		MAIN_TABS.map((tab) => [blank[tab].value, blank[tab].placeholder]),
		[
			[null, "A mood, a title, or like Severance"],
			[null, "Any mood, any genre"],
			[null, "Everywhere"],
			[null, "Any match"],
		],
	)
	assert.equal(blank.you.locked, false)
	const locked = tabValues(empty, guest).you
	assert.equal(locked.placeholder, "Sign up")
	assert.equal(locked.locked, true)

	const names = {
		title: (key: number) => (key === severance ? "Severance" : undefined),
		person: (id: number) =>
			({ 17419: "Bryan Cranston", 1245: "Scarlett Johansson" })[id],
		service: (id: number) =>
			({ 8: "Netflix", 337: "Disney Plus", 9: "Prime Video" })[id],
	}
	const values = tabValues(busy, searching, names)
	assert.equal(values.search.query, "space")
	assert.equal(values.search.value, "Like Severance, Bryan Cranston +2")
	assert.equal(
		values.mood.value,
		`${MOOD_BY_KEY.funny.name}, ${MOOD_BY_KEY.scary.name} · ${THEME_BY_KEY.crime.name} · Drama`,
	)
	assert.deepEqual(values.mood.moods, ["funny", "scary"])
	assert.equal(
		values.watch.value,
		"Netflix · Produced in France · Up to 120 min · Score 80+ · IMDb 7.0+, Metacritic 80+ · 1990–1999 · Age limit 14",
	)
	assert.deepEqual(values.watch.services, [8])
	assert.equal(values.you.value, "Match 80%+ · Not seen yet")

	const mine = tabValues(
		{ ...empty, onMyServices: true, notSeenYet: true },
		member,
	)
	assert.equal(mine.watch.value, "My services")
	assert.equal(mine.watch.services, "mine")
	assert.equal(mine.you.value, "Any match · Not seen yet")
	const three = tabValues({ ...empty, services: [8, 337, 9] }, member, names)
	assert.equal(three.watch.value, "Netflix, Disney Plus +1")
	assert.equal(
		tabValues({ ...empty, services: [8, 4] }, member, names).watch.value,
		"2 services",
	)
	assert.equal(
		tabValues({ ...empty, anyService: true }, member).watch.value,
		"Any service",
	)
	assert.equal(headPlus(["A"]), "A")
})

test("main's newer fields count and clear through their real filter groups", () => {
	const state: State = {
		...empty,
		moods: ["funny", "scary"],
		allOf: ["moods"],
		seenBefore: true,
		onWishlist: true,
		outsideUsual: true,
		ratingCountry: "US",
		episodeRuntime: { max: 35 },
		restOfWorld: true,
		votes: { max: 9999 },
		popularityRank: { min: 1001, max: 10000 },
		sourceScores: { metacriticUsers: 80 },
	}
	// Badges count every pick in either mode; all of only joins the picks into one chip.
	assert.equal(subTabBadge("everything", state, member), 2)
	assert.equal(
		subTabBadge("everything", { ...state, allOf: undefined }, member),
		2,
	)
	assert.equal(subTabBadge("taste", state, member), 3)
	assert.equal(subTabBadge("popularity", state, member), 2)
	assert.equal(subTabBadge("length", state, member), 1)
	assert.equal(subTabBadge("madeIn", state, member), 1)
	assert.equal(subTabBadge("age", state, member), 1)
	assert.equal(subTabBadge("scores", state, member), 1)
	const values = tabValues(state, member)
	assert.equal(values.you.value, "Outside your usual · Seen before +1")
	assert.ok(values.watch.value)
	assert.match(values.watch.value, /Episodes under 35 min/)
	assert.match(values.watch.value, /Metacritic users 8\.0\+/)
	assert.equal(clearAllCount(state, member), 10)
	assert.deepEqual(activeChips(clearAll(state)), [])

	// Member-only URL choices stay unapplied for guests.
	assert.equal(subTabBadge("taste", state, guest), 0)
	assert.equal(tabValues(state, guest).you.value, null)
	// Rating-country chips require a matching ladder and a country different from the default.
	assert.equal(subTabBadge("age", state, { ...member, ladder: null }), 0)
	assert.equal(subTabBadge("age", state, { ...member, viewerCountry: "US" }), 0)
	assert.equal(subTabBadge("age", { ...state, ratingCountry: "DE" }, member), 0)
})

test("Budget and Shows choices feed Watch values, badges and Clear all", () => {
	const state: State = {
		...empty,
		budget: { min: 100 },
		boxOffice: { min: 500 },
		returns: "hit",
		seasons: { min: 1, max: 1 },
		showStatus: "ended",
		hours: { min: 100 },
	}
	assert.deepEqual(groupsOf("budget"), ["budget"])
	assert.deepEqual(groupsOf("shows"), ["shows"])
	assert.equal(subTabBadge("budget", state, member), 3)
	assert.equal(subTabBadge("shows", state, member), 3)
	assert.equal(tabBadge("watch", state, member), 6)
	const watch = tabValues(state, member).watch
	assert.equal(
		watch.value,
		"1 season, A real binge to finish +1 · Blockbuster budget, Box office $500M+ +1",
	)
	assert.equal(clearAllCount(state, member), 6)
	assert.equal(tabBadge("watch", clearAll(state), member), 0)
})
