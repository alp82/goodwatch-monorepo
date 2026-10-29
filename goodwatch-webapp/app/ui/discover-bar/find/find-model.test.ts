import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { defaultFilterState } = await import("~/domain/filter-state")
const { MOODS } = await import("~/domain/moods")
const { titleKey } = await import("~/utils/title-key")
const { moodOptionsOf } = await import("../mood/mood-model.ts")
const {
	FIRST_ROWS,
	enterPick,
	findHits,
	flatHits,
	groupHits,
	growRows,
	moveActive,
	settingOn,
	toggleSetting,
} = await import("./find-model.ts")

type Sources = Parameters<typeof findHits>[1]
type State = Sources["state"]
type Hit = ReturnType<typeof findHits>[number]

const NOW = 2026
const US = [
	{ age: 0, label: "G", show: "TV-G" },
	{ age: 8, label: "PG", show: "TV-PG" },
	{ age: 14, label: "PG-13", show: "TV-14" },
	{ age: 17, label: "R", show: "TV-MA" },
]
const empty = defaultFilterState({ onMyServices: false, notSeenYet: false })

function sources(over: Partial<Sources> = {}): Sources {
	const state: State = over.state ?? empty
	const options = moodOptionsOf(state, null)
	const moods = Object.fromEntries(
		Object.entries(options).map(([group, list]) => [
			group,
			list.map((option) => ({ ...option, on: false, n: null, dead: false })),
		]),
	) as unknown as Sources["moods"]
	return {
		state,
		now: NOW,
		member: true,
		ladder: US,
		shown: () => true,
		counts: null,
		titles: [],
		people: [],
		moods,
		mixes: [],
		searching: false,
		services: {
			country: [
				{ id: 8, name: "Netflix" },
				{ id: 1796, name: "Netflix basic with Ads" },
				{ id: 9, name: "Amazon Prime Video" },
			],
			mine: [8],
		},
		countries: ["US", "JP", "GB", "DE", "FR"],
		groups: [
			{ key: "movie-603", name: "Mind-bending puzzles", number: 1, hues: [] },
		],
		forYou: false,
		bestFirst: false,
		acts: {
			update: () => {},
			toggleMood: () => {},
			applyMix: () => {},
			setForYou: () => {},
			setBestFirst: () => {},
		},
		...over,
	}
}

/** The best results' labels, highest score first. */
const top = (text: string, n = 3, over: Partial<Sources> = {}) =>
	findHits(text, sources(over))
		.sort((a, b) => b.score - a.score)
		.slice(0, n)
		.map((hit) => hit.label)

/** What Enter picks with nothing highlighted. */
const enter = (text: string, over: Partial<Sources> = {}) => {
	const hits = findHits(text, sources(over))
	return enterPick(flatHits(groupHits(hits, FIRST_ROWS, totals(0))), -1)?.label
}
const totals = (n: number) => ({
	title: { n, full: false },
	person: { n, full: false },
})

test("names match in order: whole, start, a word's start, every word, inside, extra words", () => {
	const score = (text: string, label: string) =>
		findHits(text, sources()).find((hit) => hit.label === label)?.score
	const table: [string, string, number][] = [
		["netflix", "Netflix", 100],
		["netf", "Netflix", 85],
		["prime", "Amazon Prime Video", 70],
		["hidden gems", "Hidden gems", 100],
		["gems hid", "Hidden gems", 65],
		["mazon", "Amazon Prime Video", 50],
		["feel-good", "Cozy", 35],
		["watchlist", "On your wishlist", 35],
	]
	for (const [text, label, expected] of table)
		assert.equal(score(text, label), expected, `${text} → ${label}`)
})

test("one letter finds no names, only values", () => {
	assert.deepEqual(top("n", 5), [])
	assert.deepEqual(
		top("8", 1),
		["PG"].map((r) => `Up to ${r} · TV-PG`),
	)
})

test("cross-tab queries", () => {
	const nolan = {
		titles: [
			{
				key: titleKey("movie", 27205),
				title: "Inception",
				year: "2010",
				poster: null,
				mediaType: "movie" as const,
			},
		],
		people: [
			{
				id: 525,
				name: "Christopher Nolan",
				profile: null,
				department: "Directing",
			},
		],
	}
	// Services: the service by its whole name leads, then the one named after it.
	assert.deepEqual(top("netflix", 2), ["Netflix", "Netflix basic with Ads"])
	// Mood: the current name, and the old name as an alias.
	assert.equal(top("cozy", 1)[0], "Cozy")
	assert.equal(top("feel-good", 1)[0], "Cozy")
	assert.equal(top("romance", 1)[0], "Romantic")
	// People and titles come from the searches.
	assert.equal(enter("nolan", nolan), "Christopher Nolan")
	assert.equal(enter("inception", nolan), "Inception")
	assert.equal(
		findHits("inception", sources(nolan)).find((h) => h.kind === "title")?.note,
		"2010 · Movie",
	)
	// Made in: the country and the film industry.
	assert.deepEqual(top("japan", 2).sort(), ["Japan", "Japanese"])
	// Popularity by every typed word.
	assert.equal(top("hidden gems", 1)[0], "Hidden gems")
	// Values: a year reads as Released and Enter takes it over a title named 1999.
	const named1999 = {
		titles: [
			{
				key: titleKey("movie", 1),
				title: "1999",
				year: "2002",
				poster: null,
				mediaType: "movie" as const,
			},
		],
	}
	assert.equal(enter("1999", named1999), "Released in 1999")
	assert.equal(enter("12"), "Up to PG-13 · TV-14")
	assert.deepEqual(top("90 min", 2), [
		"Movies under 90 min",
		"Movies 90 min or more",
	])
	assert.equal(enter("pg-13"), "Up to PG-13 · TV-14")
})

test("a value and its name share one result", () => {
	const hits = findHits("pg-13", sources())
	assert.equal(hits.filter((hit) => hit.key === "age:14").length, 1)
	const length = findHits("under 90 min", sources())
	assert.equal(length.filter((hit) => hit.key === "runtime:-90").length, 1)
})

test("hidden sub-tabs drop their results", () => {
	const shows = sources({ shown: (id) => id !== "budget" && id !== "age" })
	const subs = (text: string) => findHits(text, shows).map((hit) => hit.subTab)
	assert.ok(!subs("$100m").includes("budget"))
	assert.ok(!subs("12").includes("age"))
	assert.ok(!subs("blockbuster").includes("budget"))
	// Without a ladder there are no age steps to find.
	assert.ok(
		!findHits("pg", sources({ ladder: null })).some((h) => h.subTab === "age"),
	)
})

test("guests see You locked: faint, off, inert", () => {
	let picked = 0
	const guest = sources({
		member: false,
		acts: { ...sources().acts, update: () => picked++ },
	})
	const list = findHits("wishlist", guest).find((h) => h.subTab === "taste")
	assert.equal(list?.locked, true)
	list?.pick()
	assert.equal(picked, 0)
	assert.ok(
		findHits("taste", guest).some((h) => h.label === "Your taste groups"),
	)
	// Enter never picks a locked result.
	const flat = flatHits(
		groupHits(findHits("seen before", guest), FIRST_ROWS, totals(0)),
	)
	assert.ok(flat.some((hit) => hit.label === "Seen before"))
	assert.equal(enterPick(flat, -1), null)
	assert.equal(
		enterPick(
			flat,
			flat.findIndex((h) => h.locked),
		),
		null,
	)
})

test("picks go through the tabs' patches", () => {
	let state: State = empty
	const live = () =>
		sources({
			state,
			acts: {
				...sources().acts,
				update: (change: (s: State) => State) => {
					state = change(state)
				},
			},
		})
	const pick = (text: string, label: string) =>
		findHits(text, live())
			.find((hit) => hit.label === label)
			?.pick()
	pick("netflix", "Netflix")
	assert.deepEqual(state.services, [8])
	pick("1999", "Released in 1999")
	assert.deepEqual(state.years, { min: 1999, max: 1999 })
	pick("1999", "Released in 1999")
	assert.equal(state.years, undefined)
	// Movies under 90 leaves episodes as they were.
	pick("90 min", "Movies under 90 min")
	assert.deepEqual(state.runtime, { max: 90 })
	assert.equal(state.episodeRuntime, null)
	pick("japan", "Japanese")
	assert.deepEqual(state.productionCountries, ["JP"])
	assert.ok(findHits("japan", live()).find((h) => h.label === "Japan")?.on)
	pick("80", "IMDb 8.0+")
	assert.deepEqual(state.sourceScores, { imdb: 80 })
	pick("12", "Up to PG-13 · TV-14")
	assert.equal(state.ageLimit, 14)
	assert.ok(settingOn(state, { kind: "ageLimit", age: 14 }, NOW, US))
	assert.equal(
		toggleSetting(state, { kind: "ageLimit", age: 14 }, NOW, US).ageLimit,
		undefined,
	)
})

test("rows grow 4, 12, then 12 more, with the count beside More", () => {
	const titles = Array.from({ length: 20 }, (_, i) => ({
		key: titleKey("movie", i + 1),
		title: `Dark ${i}`,
		year: "",
		poster: null,
		mediaType: "movie" as const,
	}))
	const hits = findHits("dark", sources({ titles }))
	const titleGroup = (rows: typeof FIRST_ROWS) =>
		groupHits(hits, rows, { ...totals(0), title: { n: 20, full: true } })[0]
			.subs[0]
	assert.equal(titleGroup(FIRST_ROWS).rows.length, 4)
	assert.equal(titleGroup(FIRST_ROWS).more?.count, "4 of 20+")
	const twelve = growRows(FIRST_ROWS, "title")
	assert.equal(twelve.title, 12)
	assert.equal(growRows(twelve, "title").title, 24)
	assert.equal(titleGroup(growRows(twelve, "title")).rows.length, 20)
})

test("columns come in tab order, rows before chips, and the arrows wrap", () => {
	const hits: Hit[] = findHits("dark", sources())
	const columns = groupHits(hits, FIRST_ROWS, totals(0))
	const order = ["search", "mood", "watch", "you"]
	const tabs = columns.map((c) => c.tab)
	assert.deepEqual(
		tabs,
		[...tabs].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
	)
	assert.ok(
		columns.some((c) => c.tab === "mood"),
		"Dark is a mood",
	)
	assert.equal(moveActive(-1, 1, 3), 0)
	assert.equal(moveActive(-1, -1, 3), 2)
	assert.equal(moveActive(2, 1, 3), 0)
	assert.equal(moveActive(0, 1, 0), -1)
	assert.ok(MOODS.length > 0)
})

for (const [text, expected] of [
	["120", "Movies under 2 h"],
	["45", "Episodes under 45 min"],
	["8", "Up to PG · TV-PG"],
	["1999", "Released in 1999"],
]) {
	test(`Enter prefers the value for ${text} over matching titles and people`, () => {
		assert.equal(
			enter(text, {
				titles: [
					{
						key: titleKey("movie", 1),
						title: text,
						year: "2020",
						poster: null,
						mediaType: "movie",
					},
				],
				people: [{ id: 1, name: text, profile: null, department: "Acting" }],
			}),
			expected,
		)
	})
}
