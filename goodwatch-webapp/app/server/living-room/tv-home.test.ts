// What the start page with the new TV loads: the same for every guest, and a member's Tonight and My shows shaped
// from what home's doors read.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { TonightParts } from "~/server/home-doors.server"
import type {
	MyShows,
	MyShowsRow,
	MyShowsStart,
} from "~/server/my-shows.server"
import type { TitleCard } from "~/server/title-cards.server"

const {
	countryCatalog,
	guestHome,
	keepCountryServices,
	memberHome,
	tonightShowIds,
	tvServices,
} = await import("./tv-home.server.ts")

const card = (media_type: "movie" | "show", tmdb_id: number): TitleCard => ({
	key: tmdb_id * 2 + (media_type === "show" ? 1 : 0),
	tmdb_id,
	media_type,
	title: `${media_type} ${tmdb_id}`,
	poster_path: `/poster-${tmdb_id}.jpg`,
	backdrop_path: `/backdrop-${tmdb_id}.jpg`,
	release_year: 2020,
	runtime: 100,
	tagline: null,
	goodwatch_overall_score_normalized_percent: 80,
	goodwatch_overall_score_voting_count: 5000,
	match: 90,
	reasons: [],
	services: [],
	seen: false,
	wantToSee: true,
	notInterested: false,
	rating: null,
})

/** A show the member is in the middle of. `episode` is its Next episode's number; null leaves the list unread. */
const row = (id: number, episode: number | null = 4): MyShowsRow =>
	({
		id,
		kind: "next",
		left: 6,
		title: `Show ${id}`,
		poster_path: `/poster-${id}.jpg`,
		backdrop_path: `/backdrop-${id}.jpg`,
		next:
			episode === null
				? null
				: {
						season: 2,
						number: episode,
						name: `Episode ${episode}`,
						airDate: "2026-01-01",
						runtime: 48,
					},
		upcoming: null,
	}) as MyShowsRow

const toStart = (id: number): MyShowsStart => ({
	id,
	title: `Start ${id}`,
	poster_path: `/poster-${id}.jpg`,
	backdrop_path: `/backdrop-${id}.jpg`,
	match: 77,
	seasons: 1,
	episodes: 8,
	episodeMinutes: 50,
	running: true,
	service: "Netflix",
})

const parts = (
	shows: Partial<MyShows>,
	movies: TitleCard[] = [],
): TonightParts => ({
	shows: {
		continue: [],
		start: [],
		pickUp: [],
		waiting: [],
		onHold: [],
		dropped: [],
		total: 0,
		...shows,
	},
	movieCount: movies.length,
	movies,
	movieFits: true,
	movieByMatch: true,
	newOn: { movie: null, start: null },
})

const cardsFor = (p: TonightParts) =>
	tonightShowIds(p).map((id) => card("show", id))
const tonightOf = (p: TonightParts) =>
	memberHome(p, cardsFor(p)).tonight.map((pick) => [
		`${pick.card.media_type}-${pick.card.tmdb_id}`,
		pick.href,
	])

test("a guest's home holds the start titles and the first picture, and nothing personal", () => {
	const titles = [
		{
			media_type: "movie" as const,
			tmdb_id: 603,
			title: "The Matrix",
			release_year: 1999,
			poster_path: "/matrix.jpg",
		},
	]
	const services = [{ id: 8, name: "Netflix", logo_path: "/netflix.jpg" }]
	assert.deepEqual(
		guestHome({ titles, picture: "/matrix-backdrop.jpg" }, services),
		{
			member: false,
			startTitles: titles,
			picture: "/matrix-backdrop.jpg",
			tonight: [],
			shows: null,
			services,
		},
	)
})

test("Tonight's pick is the Next episode of the first show to continue, then the movies", () => {
	const p = parts({ continue: [row(10), row(11)], start: [toStart(20)] }, [
		card("movie", 1),
		card("movie", 2),
		card("movie", 3),
	])
	assert.deepEqual(tonightShowIds(p), [10, 20])
	const { tonight } = memberHome(p, cardsFor(p))
	assert.deepEqual(tonightOf(p), [
		["show-10", "/my-shows"],
		["movie-1", "/my-movies"],
		["movie-2", "/my-movies"],
	])
	assert.deepEqual(tonight[0].episode, { code: "S2 E4", name: "Episode 4" })
	assert.equal(tonight[1].episode, undefined)
})

test("without a show to continue the first movie is the pick, and the first show to start follows the movies", () => {
	const p = parts({ start: [toStart(20), toStart(21)] }, [
		card("movie", 1),
		card("movie", 2),
	])
	assert.deepEqual(tonightShowIds(p), [20])
	assert.deepEqual(tonightOf(p), [
		["movie-1", "/my-movies"],
		["movie-2", "/my-movies"],
		["show-20", "/my-shows#start"],
	])
	// Three movies leave no place for it.
	assert.deepEqual(
		tonightOf(
			parts({ start: [toStart(20)] }, [
				card("movie", 1),
				card("movie", 2),
				card("movie", 3),
			]),
		),
		[
			["movie-1", "/my-movies"],
			["movie-2", "/my-movies"],
			["movie-3", "/my-movies"],
		],
	)
})

test("without a show to continue and without a movie the first show to start is the pick, once", () => {
	const p = parts({ start: [toStart(20), toStart(21)] })
	assert.deepEqual(tonightOf(p), [["show-20", "/my-shows#start"]])
})

test("a show waiting for its list is no episode pick: Continue's first row must have a Next episode", () => {
	// `tonightsPickOf` takes the first Continue row only when it is of the kind "next".
	const seenNew = { ...row(10), kind: "seenNew" } as MyShowsRow
	const p = parts({ continue: [seenNew] }, [card("movie", 1)])
	assert.deepEqual(tonightOf(p), [["movie-1", "/my-movies"]])
	// The episode's name comes with the show's list; without it the pick has no episode line.
	const unread = parts({ continue: [row(10, null)] })
	assert.equal(
		memberHome(unread, cardsFor(unread)).tonight[0].episode,
		undefined,
	)
})

test("a member with nothing to pick from has no Tonight, and a show the catalog lacks is left out", () => {
	assert.deepEqual(memberHome(parts({}), []), {
		tonight: [],
		shows: { next: [], start: [] },
	})
	const p = parts({ continue: [row(10)] }, [card("movie", 1)])
	assert.deepEqual(
		memberHome(p, []).tonight.map((pick) => pick.card.tmdb_id),
		[1],
	)
})

test("My shows on the TV: three shows to continue and three to start", () => {
	const p = parts({
		continue: [row(10), row(11, null), row(12), row(13)],
		pickUp: [row(30)],
		start: [toStart(20), toStart(21), toStart(22), toStart(23)],
	})
	const { shows } = memberHome(p, cardsFor(p))
	assert.deepEqual(
		shows?.next.map((show) => show.id),
		[10, 11, 12],
	)
	assert.deepEqual(shows?.next[0], {
		id: 10,
		title: "Show 10",
		poster_path: "/poster-10.jpg",
		backdrop_path: "/backdrop-10.jpg",
		episode: { code: "S2 E4", name: "Episode 4", runtime: 48 },
		left: 6,
		caughtUp: false,
	})
	assert.equal(shows?.next[1].episode, null)
	assert.deepEqual(
		shows?.start.map((show) => show.id),
		[20, 21, 22],
	)
	assert.deepEqual(shows?.start[0], {
		id: 20,
		title: "Start 20",
		poster_path: "/poster-20.jpg",
		backdrop_path: "/backdrop-20.jpg",
		match: 77,
		service: "Netflix",
		seasons: 1,
	})
})

test("My shows on the TV: a Seen show with new episodes says how many are new", () => {
	const back = { ...row(40, 1), kind: "seenNew", left: 2 } as MyShowsRow
	const p = parts({ continue: [row(10), back] })
	const next = memberHome(p, cardsFor(p)).shows?.next
	assert.deepEqual(
		next?.map((show) => [show.id, show.left, show.caughtUp]),
		[
			[10, 6, false],
			[40, 2, true],
		],
	)
})

test("without a show to continue, My shows lists the shows to pick up", () => {
	const p = parts({ pickUp: [row(30), row(31)] })
	assert.deepEqual(
		memberHome(p, []).shows?.next.map((show) => show.id),
		[30, 31],
	)
})

// ---- The person's two streaming services: the Remote's keys and home's tiles after the apps.

const NETFLIX = { id: 8, name: "Netflix", logo_path: "/netflix.jpg" }
const PRIME = { id: 9, name: "Amazon Prime Video", logo_path: "/prime.jpg" }
const DISNEY = { id: 337, name: "Disney Plus", logo_path: "/disney.jpg" }
const HULU = { id: 15, name: "Hulu", logo_path: "/hulu.jpg" }
const MAX = { id: 1899, name: "Max", logo_path: "/max.jpg" }
/** The catalog as the data cache hands it over: every service with its place in each country that has it. */
const PROVIDERS: (typeof NETFLIX & {
	order_by_country?: Record<string, number>
})[] = [
	{ ...HULU, order_by_country: { US: 3 } },
	{ ...DISNEY, order_by_country: { US: 2, DE: 2 } },
	{ ...NETFLIX, order_by_country: { US: 0, DE: 1 } },
	{ ...MAX, order_by_country: { US: 4 } },
	{ ...PRIME, order_by_country: { US: 1, DE: 0 } },
	{
		id: 99,
		name: "Elsewhere",
		logo_path: "/e.jpg",
		order_by_country: { JP: 0 },
	},
	{ id: 100, name: "Nowhere", logo_path: "/n.jpg" },
]
const ids = (services: { id: number }[]) => services.map(({ id }) => id)

test("a country's catalog comes in the country's own order, without the services it does not have", () => {
	assert.deepEqual(ids(countryCatalog(PROVIDERS, "US")), [8, 9, 337, 15, 1899])
	assert.deepEqual(ids(countryCatalog(PROVIDERS, "DE")), [9, 8, 337])
	assert.deepEqual(ids(countryCatalog(PROVIDERS, "JP")), [99])
	assert.deepEqual(countryCatalog(PROVIDERS, "FR"), [])
	// Services at the same place keep the order they came in.
	assert.deepEqual(
		ids(
			countryCatalog(
				[
					{ ...HULU, order_by_country: { US: 1 } },
					{ ...MAX, order_by_country: { US: 1 } },
					{ ...NETFLIX, order_by_country: { US: 0 } },
				],
				"US",
			),
		),
		[8, 15, 1899],
	)
})

test("a guest's two services are the first two of their country's catalog, by the app's short names", () => {
	assert.deepEqual(tvServices([], countryCatalog(PROVIDERS, "US")), [
		{ id: 8, name: "Netflix", logo_path: "/netflix.jpg" },
		{ id: 9, name: "Prime", logo_path: "/prime.jpg" },
	])
	assert.deepEqual(tvServices([], countryCatalog(PROVIDERS, "DE")), [
		{ id: 9, name: "Prime", logo_path: "/prime.jpg" },
		{ id: 8, name: "Netflix", logo_path: "/netflix.jpg" },
	])
})

test("a member's two services are their first two saved ones, in the order they saved them", () => {
	const catalog = countryCatalog(PROVIDERS, "US")
	assert.deepEqual(tvServices([MAX, DISNEY, NETFLIX], catalog), [
		{ id: 1899, name: "Max", logo_path: "/max.jpg" },
		{ id: 337, name: "Disney+", logo_path: "/disney.jpg" },
	])
})

test("a member with one saved service, or none, is filled up from their country's catalog", () => {
	const catalog = countryCatalog(PROVIDERS, "US")
	assert.deepEqual(ids(tvServices([HULU], catalog)), [15, 8])
	// The country's first is the one they saved: the second key is the next one.
	assert.deepEqual(ids(tvServices([NETFLIX], catalog)), [8, 9])
	assert.deepEqual(ids(tvServices([], catalog)), [8, 9])
})

test("two plans or channels of one brand are one key", () => {
	const ads = {
		id: 1796,
		name: "Netflix Standard with Ads",
		logo_path: "/a.jpg",
	}
	const channel = { id: 1825, name: "Max Amazon Channel", logo_path: "/c.jpg" }
	assert.deepEqual(
		tvServices([NETFLIX, ads, MAX, channel, HULU], []).map(({ id }) => id),
		[8, 1899],
	)
	assert.deepEqual(ids(tvServices([ads], [NETFLIX, MAX])), [1796, 1899])
	// The key is named by the brand, whichever plan it stands for.
	assert.equal(tvServices([ads], [])[0].name, "Netflix")
})

test("where the catalog has too few, the fixed pair fills up: Netflix and Prime Video", () => {
	assert.deepEqual(tvServices([], []), [
		{ id: 8, name: "Netflix", logo_path: null },
		{ id: 9, name: "Prime", logo_path: null },
	])
	assert.deepEqual(
		ids(tvServices([], countryCatalog(PROVIDERS, "JP"))),
		[99, 8],
	)
	assert.deepEqual(ids(tvServices([PRIME], [])), [9, 8])
	// A service without a logo in the catalog has none.
	assert.equal(
		tvServices([{ id: 5, name: "Plain", logo_path: "" }], [])[0].logo_path,
		null,
	)
})

test("a country's services are read once per country and day, and a request in between waits for that read", async () => {
	let now = 1_000
	const reads: string[] = []
	const load = keepCountryServices(
		async (country: string) => {
			reads.push(country)
			return PROVIDERS
		},
		() => now,
	)
	const [a, b] = await Promise.all([load("US"), load("US")])
	assert.equal(a, b)
	assert.deepEqual(ids(a), [8, 9, 337, 15])
	assert.deepEqual(ids(await load("DE")), [9, 8, 337])
	now += 23 * 60 * 60 * 1000
	await load("US")
	assert.deepEqual(reads, ["US", "DE"])
	now += 2 * 60 * 60 * 1000
	await load("US")
	assert.deepEqual(reads, ["US", "DE", "US"])
})

test("a failed read answers no services and is tried again after a minute", async (t) => {
	t.mock.method(console, "error", () => {})
	let now = 0
	let fails = true
	let reads = 0
	const load = keepCountryServices(
		async () => {
			reads++
			if (fails) throw new Error("no catalog")
			return PROVIDERS
		},
		() => now,
	)
	assert.deepEqual(await load("US"), [])
	// The fixed pair fills up what the read could not give.
	assert.deepEqual(ids(tvServices([], await load("US"))), [8, 9])
	assert.equal(reads, 1)
	fails = false
	now += 59_000
	assert.deepEqual(await load("US"), [])
	now += 2_000
	assert.deepEqual(ids(await load("US")), [8, 9, 337, 15])
	assert.equal(reads, 2)
})
