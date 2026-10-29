// Old Discover links on the Discover bar: each URL goes the way the page takes it (the loader's redirect of old
// parameter names and type paths, then the filter state the page reads from the URL), and every choice it carries
// shows as a chip in the status line and in the value lines of the bar's tabs.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const {
	filterStateFromParams,
	rewriteLegacyDiscoverParams,
	sortFromParams,
	stateAsApplied,
	typeOfDiscoverPath,
} = await import("~/domain/filter-state")
const { searchText } = await import("~/domain/discover-search")
const { activeChips } = await import("~/ui/filter-bar/labels")
const { titleKey } = await import("~/utils/title-key")
const { barChips } = await import("./chips.ts")
const { tabValues } = await import("./tabs.ts")

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
const GENRES: Record<number, string> = { 18: "Drama", 35: "Comedy" }
const severance = titleKey("show", 95396)
const dune = titleKey("movie", 438631)
const names = {
	title: (key: number) => ({ [severance]: "Severance", [dune]: "Dune" })[key],
	person: (id: number) =>
		({ 1245: "Scarlett Johansson", 525: "Christopher Nolan" })[id],
	service: (id: number) => ({ 8: "Netflix", 337: "Disney Plus" })[id],
	tasteGroup: (key: string) =>
		({ "movie-603": "Slow sci-fi", "2": "Big laughs" })[key],
	ageStep: (age: number) =>
		[...LADDER.steps].reverse().find((step) => step.age <= age)?.label,
}

/** The URL as the page reads it: after the loader's redirects, its state, chips, tab value lines and sort. */
function open(
	href: string,
	{
		member = true,
		ladder = LADDER,
	}: { member?: boolean; ladder?: typeof LADDER } = {},
) {
	const url = new URL(href, "https://goodwatch.app")
	let params = url.searchParams
	const segment = url.pathname.split("/")[2]
	if (segment) {
		const type = typeOfDiscoverPath(segment)
		if (type && !params.has("type")) params.set("type", type)
	}
	params = rewriteLegacyDiscoverParams(params, (id) => GENRES[id]) ?? params
	const defaults = { onMyServices: member, notSeenYet: member }
	const state = filterStateFromParams(params, defaults, member)
	const query = searchText(params.get("q"))
	const applied = stateAsApplied(state, ladder, member, "US")
	const chips = barChips(applied, activeChips(applied, names), {
		query,
		names,
		face: () => null,
	}).map((chip) => [chip.prefix, chip.label].filter(Boolean).join(" "))
	const context = {
		member,
		viewerCountry: "US",
		ladder,
		query,
		tasteGroup: names.tasteGroup,
	}
	const values = Object.fromEntries(
		Object.entries(tabValues(state, context, names)).map(([tab, value]) => [
			tab,
			value.value,
		]),
	)
	return {
		params,
		state,
		chips,
		values,
		sort: sortFromParams(params, query !== null),
	}
}

const MINE = ["On my services", "Not seen yet"]

/** Old and current links, what the redirect leaves of their parameters (when it rewrites them), and their chips. */
const LINKS: {
	href: string
	params?: string
	chips: string[]
	sort?: string
}[] = [
	{
		href: "/discover?withGenres=18,35&minScore=75&withStreamingProviders=8,337&sortBy=aggregated_score&sortDirection=desc&type=movies",
		params:
			"type=movie&genres=Drama%2CComedy&services=8%2C337&score=70&sort=top",
		chips: [
			"Netflix or Disney Plus",
			"Not seen yet",
			"Movies",
			"Drama",
			"Comedy",
			"Score 70+",
		],
		sort: "top",
	},
	{
		href: "/discover/movies?streamingPreset=mine&watchedType=didnt-watch",
		params: "type=movie&services=mine&unseen=1",
		chips: [...MINE, "Movies"],
	},
	{
		href: "/discover/shows?streamingPreset=everywhere",
		params: "type=show&services=all",
		chips: ["Not seen yet", "Shows"],
	},
	{
		href: "/discover?type=all&withGenres=18",
		params: "genres=Drama",
		chips: [...MINE, "Drama"],
	},
	{
		href: "/discover?similarTitles=95396:show&withCast=1245&withCrew=525&withCastCombinationType=AND",
		params: "similar=2000000095396&people=1245%2C525",
		chips: [
			"Like Severance",
			"with Scarlett Johansson",
			"with Christopher Nolan",
			...MINE,
		],
	},
	{
		href: "/discover?minYear=1990&maxYear=1999&minRuntime=80&maxRuntime=120",
		chips: [...MINE, "1990–1999", "80–120 min"],
	},
	{ href: "/discover?side=abc&layout=grid", chips: MINE },
	{ href: "/discover?layout=grid&foryou=0", chips: MINE },
	{ href: "/discover?foryou=1", params: "foryou=1", chips: MINE },
	{ href: "/discover?ok=", params: "ok=", chips: MINE },
	{
		href: "/discover?age=8&ok=violence",
		params: "age=8&ok=violence",
		chips: [...MINE, "Age limit PG", "Violence OK"],
	},
	{
		href: "/discover/movies?type=show",
		params: "type=show",
		chips: [...MINE, "Shows"],
	},
	{ href: "/discover?sort=newest&page=3", chips: MINE, sort: "newest" },
	{ href: "/discover?fbclid=1&type=movie&page=2", chips: [...MINE, "Movies"] },
	{
		href: "/discover?q=cozy%20rainy%20day%20mystery&sort=relevance",
		chips: ["cozy rainy day mystery", ...MINE],
		sort: "relevance",
	},
	{
		href: "/discover?moods=funny,dark&themes=mystery&styles=animated&genres=Drama,Comedy&all=moods",
		chips: [
			...MINE,
			"Funny and Dark",
			"Mystery",
			"Animated",
			"Drama",
			"Comedy",
		],
	},
	{
		href: "/discover?services=any&streamingCountry=GB",
		chips: ["Streaming in United Kingdom", "Not seen yet"],
	},
	{
		href: "/discover?services=8,337&unseen=0",
		chips: ["Netflix or Disney Plus"],
	},
	{
		href: "/discover?age=17&hide=drugs",
		chips: [...MINE, "Age limit R", "No drugs"],
	},
	{
		href: "/discover?sources=imdb:65,rtCritics:80&gap=critics&score=70&match=80",
		chips: [
			...MINE,
			"Match 80%+",
			"IMDb 6.5+",
			"Rotten Tomatoes 80%+",
			"Critics liked it more",
			"Score 70+",
		],
	},
	{
		href: "/discover?match=outside&seen=1&wishlist=1&taste=movie-603",
		chips: [
			"On my services",
			"Slow sci-fi",
			"Seen before",
			"On your wishlist",
			"Outside your usual",
		],
	},
	{
		href: "/discover?taste=2,movie-603&match=90",
		chips: [...MINE, "Big laughs", "Slow sci-fi", "Match 90%+"],
	},
	{
		href: "/discover?released=recent&type=show&anime=only",
		chips: [...MINE, "Shows", "Anime only", "Last 3 years"],
	},
	{ href: "/discover?released=2010s", chips: [...MINE, "2010s"] },
	{
		href: "/discover?years=2010-2019&runtime=-90&episodeRuntime=any",
		chips: [...MINE, "2010–2019", "Movies under 1 h 30"],
	},
	{
		href: "/discover?productionCountries=KR,JP&restOfWorld=1",
		chips: [
			...MINE,
			"Rest of the world",
			"Made in South Korea",
			"Made in Japan",
		],
	},
	{
		href: "/discover?votes=1000-&rank=-500&budget=100-&boxOffice=-50&returns=hit",
		chips: [
			...MINE,
			"Blockbuster budget",
			"Box office Up to $50M",
			"Box office hit",
			"1K+ ratings",
			"Top 500",
		],
	},
	{
		href: "/discover?type=show&seasons=1-2&showStatus=ended&hours=-20",
		chips: [
			...MINE,
			"Shows",
			"1 to 2 seasons",
			"Up to 20 h to finish",
			"Ended",
		],
	},
	{
		href: "/discover?loved=show:95396&disliked=movie:438631&people=1245",
		chips: [
			"More like Severance",
			"Less like Dune",
			"with Scarlett Johansson",
			...MINE,
		],
	},
	{
		href: "/discover?maxScore=60&fingerprintConditions=x",
		chips: [...MINE, "Fingerprint conditions", "Score up to 60"],
	},
]

for (const link of LINKS)
	test(`${link.href} shows its choices`, () => {
		const read = open(link.href)
		if (link.params) assert.equal(read.params.toString(), link.params)
		assert.deepEqual(read.chips, link.chips)
		assert.equal(read.sort, link.sort ?? "popular")
	})

test("the bar's value lines name what old links choose", () => {
	const legacy = open(
		"/discover?withGenres=18,35&minScore=75&withStreamingProviders=8,337&type=movies",
	)
	assert.deepEqual(legacy.values, {
		search: "Movies",
		mood: "Drama, Comedy",
		watch: "Netflix, Disney Plus · Score 70+",
		you: "Any match · Not seen yet",
	})
	assert.equal(
		open("/discover?minYear=1990&maxYear=1999&minRuntime=80&maxRuntime=120")
			.values.watch,
		"My services · 80–120 min · 1990–1999",
	)
	assert.equal(
		open("/discover?match=outside&seen=1&wishlist=1&taste=movie-603").values
			.you,
		"Outside your usual · Slow sci-fi +2",
	)
	assert.equal(
		open("/discover?loved=show:95396&disliked=movie:438631&people=1245").values
			.search,
		"Scarlett Johansson, Loved: Severance +1",
	)
})

test("a rating country shows once its ladder answers", () => {
	const germany = {
		...LADDER,
		country: "DE",
		steps: [
			{ age: 0, label: "0", show: "0" },
			{ age: 12, label: "12", show: "12" },
			{ age: 16, label: "16", show: "16" },
			{ age: 18, label: "18", show: "18" },
		],
	}
	const href = "/discover?ratingCountry=DE&age=12"
	assert.ok(
		open(href, { ladder: germany }).chips.includes("Ratings in Germany"),
	)
	// Before the first answer there is no ladder: the age choices wait, the URL keeps them.
	const read = open(href, { ladder: null as unknown as typeof LADDER })
	assert.deepEqual(read.chips, MINE)
	assert.equal(read.params.get("age"), "12")
})

test("guests keep their own defaults and drop member choices", () => {
	assert.deepEqual(
		open("/discover?match=outside&seen=1&wishlist=1&taste=movie-603", {
			member: false,
		}).chips,
		[],
	)
	assert.deepEqual(open("/discover?unseen=1", { member: false }).chips, [
		"Not seen yet",
	])
})
