// Newly available on a member's services (#456): when a title landed on a service, which landings are news for a
// member, and what the signal and the pages say.

import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	baseService,
	firstSeenOf,
	landingOn,
	titlesThatCanLand,
	newlyAvailableOf,
	signalOf,
	lineOf,
} = await import("./newly-available.ts")
const { newShowCount, openerWords } = await import(
	"./newly-available-signal.ts"
)
const { landedWords, showsWords, landedLine } = await import(
	"./newly-available-words.ts"
)
const { titleKey } = await import("../utils/title-key.ts")

const DAY = 86_400_000
const LAUNCH = Date.parse("2026-10-12T00:00:00Z")
const day = (n: number) => LAUNCH + n * DAY

const NETFLIX = 8
const PRIME = 9
const AMAZON_VIDEO = 10
const PRIME_OTHER = 119
const APPLE = 2
const APPLE_PLUS = 350
const MAX = 1899

const dune = titleKey("movie", 438631)
const heat = titleKey("movie", 949)
const severance = titleKey("show", 95396)

/** The member's saved services as the viewer context holds them: each with its duplicates. */
const mine = (...services: number[]) => new Set(services.map(baseService))

test("duplicate service ids are one service", () => {
	assert.equal(baseService(AMAZON_VIDEO), PRIME)
	assert.equal(baseService(PRIME_OTHER), PRIME)
	assert.equal(baseService(APPLE_PLUS), APPLE)
	assert.equal(baseService(NETFLIX), NETFLIX)
})

// ---------------------------------------------------------------------------------------------------------
// The times the availability index keeps

test("the index keeps the time a service first carried a title, only for what appeared after its start", () => {
	const seen = firstSeenOf(
		[
			// An offer from before: no time is kept, the title has been there.
			[heat, NETFLIX, day(-40)],
			[dune, NETFLIX, day(2)],
			[dune, MAX, day(5)],
		],
		LAUNCH,
	)
	assert.equal(seen.has(heat), false)
	assert.deepEqual(
		[...(seen.get(dune) ?? [])],
		[
			[NETFLIX, day(2)],
			[MAX, day(5)],
		],
	)
})

test("a service's earliest row counts, across its duplicate ids and its kinds of offer", () => {
	const seen = firstSeenOf(
		[
			// Amazon Video carried Dune before; Amazon Prime Video listing it now is not a new service.
			[dune, AMAZON_VIDEO, day(-300)],
			[dune, PRIME, day(3)],
			// Two rows of one service (with ads, then without): the first one is when it appeared.
			[heat, APPLE_PLUS, day(4)],
			[heat, APPLE, day(1)],
		],
		LAUNCH,
	)
	assert.equal(seen.has(dune), false)
	assert.deepEqual([...(seen.get(heat) ?? [])], [[APPLE, day(1)]])
})

// ---------------------------------------------------------------------------------------------------------
// When a title landed on a member's services

test("a title lands when none of the member's services carried it and one does now", () => {
	const fresh = new Map([[NETFLIX, day(2)]])
	assert.deepEqual(landingOn([NETFLIX], fresh, mine(NETFLIX, PRIME)), {
		at: day(2),
		service: NETFLIX,
	})
})

test("a title that was already watchable on one of the member's services has not landed", () => {
	// Prime has had it; Netflix adding it is a further service, not news.
	const fresh = new Map([[NETFLIX, day(2)]])
	assert.equal(landingOn([PRIME, NETFLIX], fresh, mine(NETFLIX, PRIME)), null)
	// A member with Netflix alone could not watch it before.
	assert.deepEqual(landingOn([PRIME, NETFLIX], fresh, mine(NETFLIX)), {
		at: day(2),
		service: NETFLIX,
	})
})

test("the landing is the earliest of the member's services that carry it now", () => {
	const fresh = new Map([
		[MAX, day(6)],
		[NETFLIX, day(2)],
	])
	assert.deepEqual(landingOn([MAX, NETFLIX], fresh, mine(NETFLIX, MAX)), {
		at: day(2),
		service: NETFLIX,
	})
})

test("a title on none of the member's services, or with no offer known, has not landed", () => {
	const fresh = new Map([[NETFLIX, day(2)]])
	assert.equal(landingOn([NETFLIX], fresh, mine(PRIME)), null)
	assert.equal(landingOn([], undefined, mine(NETFLIX)), null)
	// A member without a saved service has no service to land on.
	assert.equal(landingOn([NETFLIX], fresh, mine()), null)
})

test("a saved service stands for its duplicates", () => {
	// The member saved Amazon Prime Video; the context expands it to 9, 10 and 119, which are one service here.
	const fresh = new Map([[PRIME, day(3)]])
	assert.deepEqual(
		landingOn([PRIME], fresh, mine(PRIME, AMAZON_VIDEO, PRIME_OTHER)),
		{ at: day(3), service: PRIME },
	)
})

// ---------------------------------------------------------------------------------------------------------
// Which titles, and which landings are news

const entry = (state: string) => ({ state })

test("Want to See titles can land, and shows the member is Watching or has On hold", () => {
	const watching = titleKey("show", 1)
	const onHold = titleKey("show", 2)
	const dropped = titleKey("show", 3)
	const seen = titleKey("show", 4)
	const titles = titlesThatCanLand(
		new Map([
			[dune, new Date(day(1))],
			[severance, new Date(day(2))],
		]),
		{
			"show-1": entry("watching"),
			"show-2": entry("on_hold"),
			"show-3": entry("dropped"),
			"show-4": entry("seen"),
			// A movie has no status that counts.
			"movie-949": entry("seen"),
		},
	)
	assert.deepEqual(titles, [
		{ key: dune, addedAt: day(1) },
		{ key: severance, addedAt: day(2) },
		// A show the member watches has no time it was added: it counts from the start.
		{ key: watching, addedAt: null },
		{ key: onHold, addedAt: null },
	])
	assert.equal(
		titles.some(({ key }) => key === dropped || key === seen || key === heat),
		false,
	)
})

test("a Want to See show the member is also Watching counts as the show they watch", () => {
	assert.deepEqual(
		titlesThatCanLand(new Map([[severance, new Date(day(9))]]), {
			"show-95396": entry("watching"),
		}),
		[{ key: severance, addedAt: null }],
	)
})

const landed = (
	key: number,
	at: number,
	addedAt: number | null = day(-30),
) => ({
	key,
	addedAt,
	landing: { at, service: NETFLIX },
})
const never = { movie: null, show: null }

test("a landing is news when it came after the member last opened the title's page", () => {
	const candidates = [landed(dune, day(5)), landed(severance, day(5))]
	// My movies was opened after Dune landed; My shows before Severance did.
	const news = newlyAvailableOf(candidates, {
		launch: LAUNCH,
		visits: { movie: day(6), show: day(4) },
	})
	assert.deepEqual(news.movies, [])
	assert.deepEqual(news.shows, [
		{ key: severance, tmdbId: 95396, at: day(5), service: NETFLIX },
	])
})

test("movies clear with My movies and shows with My shows, each on its own", () => {
	const candidates = [landed(dune, day(5)), landed(severance, day(5))]
	const news = newlyAvailableOf(candidates, {
		launch: LAUNCH,
		visits: { movie: day(4), show: day(6) },
	})
	assert.deepEqual(
		news.movies.map(({ key }) => key),
		[dune],
	)
	assert.deepEqual(news.shows, [])
})

test("nothing from before the launch is news, also for a member who never opened the page", () => {
	const news = newlyAvailableOf(
		[
			// The catch-up of late September 2026: offers that look new and are not.
			landed(dune, day(-14)),
			// At the launch itself is not after it.
			landed(heat, LAUNCH),
			landed(severance, day(1)),
		],
		{ launch: LAUNCH, visits: never },
	)
	assert.deepEqual(news.movies, [])
	assert.deepEqual(
		news.shows.map(({ key }) => key),
		[severance],
	)
})

test("a title added to Want to See after its offer appeared is not news", () => {
	const news = newlyAvailableOf(
		[
			// Added on the day after it landed: the member found it there.
			landed(dune, day(3), day(4)),
			landed(heat, day(3), day(2)),
			// A show the member watches has no such time.
			landed(severance, day(3), null),
		],
		{ launch: LAUNCH, visits: never },
	)
	assert.deepEqual(
		news.movies.map(({ key }) => key),
		[heat],
	)
	assert.deepEqual(
		news.shows.map(({ key }) => key),
		[severance],
	)
})

test("a title that has not landed is never news, and the latest landing comes first", () => {
	const tar = titleKey("movie", 817758)
	const news = newlyAvailableOf(
		[
			landed(dune, day(2)),
			{ key: tar, addedAt: day(-30), landing: null },
			landed(heat, day(7)),
		],
		{ launch: LAUNCH, visits: never },
	)
	assert.deepEqual(
		news.movies.map(({ key }) => key),
		[heat, dune],
	)
})

// ---------------------------------------------------------------------------------------------------------
// What the signal is told

const named = (ids: number[], titles: string[], service: string | null) => ({
	ids,
	titles,
	service,
})
const NONE = named([], [], null)

test("the signal is told how many titles landed, and names the title and the service when it is one", () => {
	assert.equal(signalOf({ movies: NONE, shows: NONE }), null)
	assert.deepEqual(
		signalOf({ movies: named([438631], ["Dune"], "Netflix"), shows: NONE }),
		{
			movies: {
				count: 1,
				ids: [438631],
				only: { title: "Dune", service: "Netflix" },
			},
			shows: { count: 0, ids: [], only: null },
		},
	)
	// Several are counted. Three names are read for the page's line, however many landed.
	assert.deepEqual(
		signalOf({
			movies: named([1, 2, 3, 4], ["A", "B", "C"], "Netflix"),
			shows: NONE,
		})?.movies,
		{ count: 4, ids: [1, 2, 3, 4], only: null },
	)
	// One title whose name or service could not be read is still counted.
	assert.deepEqual(
		signalOf({ movies: named([5], [], null), shows: NONE })?.movies,
		{ count: 1, ids: [5], only: null },
	)
})

test("a page is told what landed for its line, or nothing", () => {
	assert.equal(lineOf(NONE), null)
	assert.deepEqual(lineOf(named([1, 2], ["A", "B"], "Netflix")), {
		count: 2,
		titles: ["A", "B"],
		service: "Netflix",
	})
})

// ---------------------------------------------------------------------------------------------------------
// What the signal says

const one = {
	count: 1,
	ids: [438631],
	only: { title: "Dune", service: "Netflix" },
}
const several = { count: 3, ids: [1, 2, 3], only: null }
const nothing = { count: 0, ids: [], only: null }

test("one landed title is named with its service; several are counted", () => {
	assert.equal(landedWords("movie", nothing), null)
	assert.equal(landedWords("movie", null), null)
	assert.deepEqual(landedWords("movie", one), {
		badge: "1",
		// The tile's line is cut on a phone: the service comes first.
		tile: "Now on Netflix: Dune",
		door: "Dune is now on Netflix",
		doorShort: "1 movie",
	})
	assert.deepEqual(landedWords("movie", several), {
		badge: "3",
		tile: "3 now on your services",
		door: "3 movies are now on your services",
		doorShort: "3 movies",
	})
	assert.deepEqual(landedWords("show", several), {
		badge: "3",
		tile: "3 now on your services",
		door: "3 shows are now on your services",
		doorShort: "3 shows",
	})
	// Without a name to say, one title is counted too.
	assert.deepEqual(landedWords("show", { count: 1, ids: [7], only: null }), {
		badge: "1",
		tile: "1 now on your services",
		door: "1 show is now on your services",
		doorShort: "1 show",
	})
	assert.equal(
		landedWords("movie", { count: 120, ids: [], only: null })?.badge,
		"99+",
	)
})

const episodes = (ids: number[]) => ({
	shows: ids.length,
	ids,
	only:
		ids.length === 1
			? { title: "Slow Horses", season: 6, number: 4, episodes: 1 }
			: null,
})

test("My shows counts a show once, whether it has a new episode, landed on a service, or both", () => {
	assert.equal(newShowCount(null, null), 0)
	assert.equal(newShowCount(episodes([1, 2]), null), 2)
	assert.equal(newShowCount(null, several), 3)
	assert.equal(newShowCount(episodes([1, 9]), several), 4)
	// An answer from before the ids were sent: the two are added.
	assert.equal(newShowCount({ shows: 2, only: null }, several), 5)
})

test("the My shows signal says new episodes, a landed show, or both", () => {
	assert.equal(showsWords(null, null), null)
	// New episodes alone read as before.
	assert.equal(
		showsWords(episodes([1]), nothing)?.tile,
		"New: Slow Horses S6 E4",
	)
	assert.equal(
		showsWords(episodes([1, 2]), null)?.door,
		"2 shows have new episodes",
	)
	// A landed show alone.
	assert.equal(
		showsWords(null, {
			count: 1,
			ids: [95396],
			only: { title: "Severance", service: "Apple TV" },
		})?.tile,
		"Now on Apple TV: Severance",
	)
	// Both: the shows are counted, each once.
	assert.deepEqual(showsWords(episodes([1, 9]), several), {
		badge: "4",
		tile: "New in 4 shows",
		door: "4 shows have something new",
		doorShort: "4 shows",
	})
	// One show with a new episode that also landed is that one show, and the episode is what is said.
	assert.deepEqual(
		showsWords(episodes([95396]), {
			count: 1,
			ids: [95396],
			only: { title: "Severance", service: "Apple TV" },
		}),
		{
			badge: "1",
			tile: "New: Slow Horses S6 E4",
			door: "New: Slow Horses S6 E4",
			doorShort: "1 show",
		},
	)
})

test("what opens the hub shows the sum of everything new", () => {
	assert.equal(openerWords(null, null), null)
	assert.equal(openerWords({ shows: 0, only: null }, null), null)
	assert.equal(
		openerWords(episodes([1, 2]), { movies: nothing, shows: nothing })?.badge,
		"2",
	)
	const both = openerWords(episodes([1, 9]), { movies: one, shows: several })
	// Four shows, each once, and one movie.
	assert.equal(both?.badge, "5")
	assert.equal(both?.door, "5 new in your shows and movies")
	assert.equal(
		openerWords(null, { movies: one, shows: nothing })?.door,
		"1 new in your shows and movies",
	)
})

// ---------------------------------------------------------------------------------------------------------
// What the page says on arrival

test("the page says once what landed: the title and the service, or the names when there are several", () => {
	assert.equal(landedLine("movie", null), null)
	assert.deepEqual(
		landedLine("movie", { count: 1, titles: ["Dune"], service: "Netflix" }),
		{ lead: "Dune", rest: "is now on Netflix" },
	)
	assert.deepEqual(
		landedLine("movie", {
			count: 5,
			titles: ["Dune", "Heat", "Tár"],
			service: "Netflix",
		}),
		{ lead: "Now on your services:", rest: "Dune, Heat, Tár and 2 more" },
	)
	assert.deepEqual(
		landedLine("show", {
			count: 2,
			titles: ["Severance", "Pluribus"],
			service: null,
		}),
		{ lead: "Now on your services:", rest: "Severance, Pluribus" },
	)
	// The names could not be read: the count is said.
	assert.deepEqual(
		landedLine("show", { count: 2, titles: [], service: null }),
		{
			lead: "2 shows",
			rest: "are now on your services",
		},
	)
	assert.deepEqual(
		landedLine("movie", { count: 1, titles: [], service: null }),
		{
			lead: "1 movie",
			rest: "is now on your services",
		},
	)
})
