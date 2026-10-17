// Newly available on a member's services (#456): when a title landed on a service, which landings are news for a
// member, and what the signal says. And the 14 days a landing counts for (#489): what the row of My movies and My
// shows lists and says, which title leads a home door, and what the door says.

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
	LANDED_DAYS,
	daysSinceLanding,
	recentlyLandedOf,
	listedLandingsOf,
	landedFirst,
} = await import("./newly-available.ts")
const { newShowCount, openerWords } = await import(
	"./newly-available-signal.ts"
)
const {
	landedWords,
	showsWords,
	newOn,
	landedRowWords,
	landedDayWords,
	doorNewOn,
} = await import("./newly-available-words.ts")
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
			[heat, NETFLIX, day(-40), null, day(-40)],
			[dune, NETFLIX, day(2), null, day(2)],
			[dune, MAX, day(5), null, day(5)],
		],
		LAUNCH,
	)
	assert.equal(seen.has(heat), false)
	assert.deepEqual(
		[...(seen.get(dune) ?? [])],
		[
			[NETFLIX, { at: day(2), learnedAt: day(2), previousServices: [] }],
			[MAX, { at: day(5), learnedAt: day(5), previousServices: [] }],
		],
	)
})

test("a service's earliest row counts, across its duplicate ids and its kinds of offer", () => {
	const seen = firstSeenOf(
		[
			// Amazon Video carried Dune before; Amazon Prime Video listing it now is not a new service.
			[dune, AMAZON_VIDEO, day(-300), null, day(-300)],
			[dune, PRIME, day(3), null, day(3)],
			// Two rows of one service (with ads, then without): the first one is when it appeared.
			[heat, APPLE_PLUS, day(4), null, day(4)],
			[heat, APPLE, day(1), null, day(1)],
		],
		LAUNCH,
	)
	assert.equal(seen.has(dune), false)
	assert.deepEqual(
		[...(seen.get(heat) ?? [])],
		[[APPLE, { at: day(1), learnedAt: day(1), previousServices: [] }]],
	)
})

// ---------------------------------------------------------------------------------------------------------
// When a title landed on a member's services

test("a title lands when none of the member's services carried it and one does now", () => {
	const fresh = new Map([
		[NETFLIX, { at: day(2), learnedAt: day(2), previousServices: [] }],
	])
	assert.deepEqual(landingOn([NETFLIX], fresh, mine(NETFLIX, PRIME)), {
		at: day(2),
		learnedAt: day(2),
		service: NETFLIX,
	})
})

test("a title that was already watchable on one of the member's services has not landed", () => {
	// Prime has had it; Netflix adding it is a further service, not news.
	const fresh = new Map([
		[NETFLIX, { at: day(2), learnedAt: day(2), previousServices: [] }],
	])
	assert.equal(landingOn([PRIME, NETFLIX], fresh, mine(NETFLIX, PRIME)), null)
	// A member with Netflix alone could not watch it before.
	assert.deepEqual(landingOn([PRIME, NETFLIX], fresh, mine(NETFLIX)), {
		at: day(2),
		learnedAt: day(2),
		service: NETFLIX,
	})
})

test("the landing is the earliest of the member's services that carry it now", () => {
	const fresh = new Map([
		[MAX, { at: day(6), learnedAt: day(6), previousServices: [] }],
		[NETFLIX, { at: day(2), learnedAt: day(2), previousServices: [] }],
	])
	assert.deepEqual(landingOn([MAX, NETFLIX], fresh, mine(NETFLIX, MAX)), {
		at: day(2),
		learnedAt: day(2),
		service: NETFLIX,
	})
})

test("a title on none of the member's services, or with no offer known, has not landed", () => {
	const fresh = new Map([
		[NETFLIX, { at: day(2), learnedAt: day(2), previousServices: [] }],
	])
	assert.equal(landingOn([NETFLIX], fresh, mine(PRIME)), null)
	assert.equal(landingOn([], undefined, mine(NETFLIX)), null)
	// A member without a saved service has no service to land on.
	assert.equal(landingOn([NETFLIX], fresh, mine()), null)
})

test("a saved service stands for its duplicates", () => {
	// The member saved Amazon Prime Video; the context expands it to 9, 10 and 119, which are one service here.
	const fresh = new Map([
		[PRIME, { at: day(3), learnedAt: day(3), previousServices: [] }],
	])
	assert.deepEqual(
		landingOn([PRIME], fresh, mine(PRIME, AMAZON_VIDEO, PRIME_OTHER)),
		{ at: day(3), learnedAt: day(3), service: PRIME },
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
	landing: { at, learnedAt: at, service: NETFLIX },
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
			// The launch day itself counts.
			landed(heat, LAUNCH),
			landed(severance, day(1)),
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

const NONE = { ids: [], only: null }

test("the signal is told how many titles landed, and names the title and the service when it is one", () => {
	assert.equal(signalOf({ movies: NONE, shows: NONE }), null)
	assert.deepEqual(
		signalOf({
			movies: { ids: [438631], only: { title: "Dune", service: "Netflix" } },
			shows: NONE,
		}),
		{
			movies: {
				count: 1,
				ids: [438631],
				only: { title: "Dune", service: "Netflix" },
			},
			shows: { count: 0, ids: [], only: null },
		},
	)
	// Several are counted, and none of them is named.
	assert.deepEqual(
		signalOf({ movies: { ids: [1, 2, 3, 4], only: null }, shows: NONE })
			?.movies,
		{ count: 4, ids: [1, 2, 3, 4], only: null },
	)
	// One title whose name or service could not be read is still counted.
	assert.deepEqual(
		signalOf({ movies: { ids: [5], only: null }, shows: NONE })?.movies,
		{ count: 1, ids: [5], only: null },
	)
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
// Recently landed (#489): 14 days from the day a title landed, flat

const keysOf = (landings: { key: number }[]) => landings.map(({ key }) => key)
/** A time on the nth day after the launch, at an hour of the day (UTC). */
const at = (n: number, hour: number) => day(n) + hour * 3_600_000

test("a landing counts for 14 days from the day it landed, the day itself included", () => {
	assert.equal(LANDED_DAYS, 14)
	// Landed late on day 2: it counts through day 15, whatever the hour, and not on day 16.
	const candidates = [landed(dune, at(2, 22))]
	const on = (now: number) =>
		keysOf(recentlyLandedOf(candidates, { launch: LAUNCH, now }).movies)
	assert.deepEqual(on(at(2, 23)), [dune])
	assert.deepEqual(on(at(3, 1)), [dune])
	assert.deepEqual(on(at(15, 23)), [dune])
	assert.deepEqual(on(at(16, 0)), [])
	assert.deepEqual(on(at(40, 12)), [])
})

test("the days since a landing are counted by the calendar", () => {
	assert.equal(daysSinceLanding(at(2, 22), at(2, 23)), 0)
	// Three hours later is the next day.
	assert.equal(daysSinceLanding(at(2, 22), at(3, 1)), 1)
	assert.equal(daysSinceLanding(at(2, 1), at(14, 23)), 12)
	// A clock that runs behind does not count backwards.
	assert.equal(daysSinceLanding(at(2, 1), at(1, 12)), 0)
})

test("the 14 days are flat: opening the page does not end them, and they need the rule of what landed", () => {
	const tar = titleKey("movie", 817758)
	const recent = recentlyLandedOf(
		[
			landed(dune, day(5)),
			// Before the launch, and at the launch itself: never landed for anyone.
			landed(heat, day(-1)),
			// Added after its offer appeared: the member found it there.
			landed(tar, day(5), day(6)),
			{ key: titleKey("movie", 1), addedAt: day(-30), landing: null },
			// A show the member watches has no time it was added.
			landed(severance, day(4), null),
		],
		// No visit is asked for: there is nothing to pass.
		{ launch: LAUNCH, now: day(10) },
	)
	assert.deepEqual(keysOf(recent.movies), [dune])
	assert.deepEqual(keysOf(recent.shows), [severance])
})

test("recently landed titles come the latest first", () => {
	const tar = titleKey("movie", 817758)
	const recent = recentlyLandedOf(
		[landed(dune, day(2)), landed(heat, day(9)), landed(tar, day(6))],
		{ launch: LAUNCH, now: day(10) },
	)
	assert.deepEqual(keysOf(recent.movies), [heat, tar, dune])
})

test("a title lands once: a second service that comes later does not start the 14 days again", () => {
	// On Netflix since day 2, on Amazon Prime Video since day 12. Both are the member's.
	const fresh = new Map([
		[NETFLIX, { at: day(2), learnedAt: day(2), previousServices: [] }],
		[PRIME, { at: day(12), learnedAt: day(12), previousServices: [] }],
	])
	const landing = landingOn([NETFLIX, PRIME], fresh, mine(NETFLIX, PRIME))
	// The service it landed on is the one that is named.
	assert.deepEqual(landing, { at: day(2), learnedAt: day(2), service: NETFLIX })
	const candidates = [{ key: dune, addedAt: day(-30), landing }]
	const on = (now: number) =>
		recentlyLandedOf(candidates, { launch: LAUNCH, now }).movies
	assert.deepEqual(on(day(13)), [
		{ key: dune, tmdbId: 438631, at: day(2), service: NETFLIX },
	])
	// Four days after the second service came, the 14 days of the first are over.
	assert.deepEqual(on(day(16)), [])
})

test("the row lists what landed in the 14 days, opened page or not, and an older landing only while it is news", () => {
	const tar = titleKey("movie", 817758)
	const candidates = [
		landed(dune, day(18)),
		landed(heat, day(10)),
		// 19 days before: past the 14 days.
		landed(tar, day(1)),
		landed(severance, day(1), null),
	]
	const rule = { launch: LAUNCH, now: day(20) }
	// The member never opened either page: the signal counts all four, and the pages have to say them.
	const unseen = listedLandingsOf(candidates, { ...rule, visits: never })
	assert.deepEqual(keysOf(unseen.movies), [dune, heat, tar])
	assert.deepEqual(keysOf(unseen.shows), [severance])
	// They opened both yesterday: what is within the 14 days stays, the older ones are gone.
	const seen = listedLandingsOf(candidates, {
		...rule,
		visits: { movie: day(19), show: day(19) },
	})
	assert.deepEqual(keysOf(seen.movies), [dune, heat])
	assert.deepEqual(keysOf(seen.shows), [])
})

// ---------------------------------------------------------------------------------------------------------
// The row that replaces the line shown when the page opened

const netflix = { id: NETFLIX, name: "Netflix", logo_path: "/netflix.png" }
const title = (
	name: string,
	days: number,
	service: typeof netflix | null = netflix,
) => ({
	mediaType: "movie" as const,
	tmdbId: name.length,
	title: name,
	poster_path: null,
	at: day(20 - days),
	days,
	service,
})

test("the row names the latest title with its service and its day, and counts the others", () => {
	assert.equal(landedRowWords([]), null)
	assert.deepEqual(landedRowWords([title("Dune: Part Two", 1)]), {
		title: "Dune: Part Two",
		says: "is new on Netflix",
		when: "yesterday",
		more: null,
	})
	assert.deepEqual(
		landedRowWords([
			title("Dune: Part Two", 0),
			title("Heat", 3),
			title("Tár", 12),
		]),
		{
			title: "Dune: Part Two",
			says: "is new on Netflix",
			when: "today",
			more: "and 2 more",
		},
	)
	// A service the catalog has no name for.
	assert.deepEqual(landedRowWords([title("Heat", 5, null)]), {
		title: "Heat",
		says: "is new on your services",
		when: "5 days ago",
		more: null,
	})
})

test("each title of the row has its day: the distance within a week, the date after it", () => {
	// 12 October 2026 is the launch.
	assert.deepEqual(landedDayWords(day(8), 0), {
		when: "Today",
		detail: "20 Oct",
	})
	assert.deepEqual(landedDayWords(day(7), 1), {
		when: "Yesterday",
		detail: "19 Oct",
	})
	assert.deepEqual(landedDayWords(day(2), 6), {
		when: "6 days ago",
		detail: "14 Oct",
	})
	assert.deepEqual(landedDayWords(day(1), 7), {
		when: "13 Oct",
		detail: "7 days ago",
	})
	assert.deepEqual(landedDayWords(at(0, 23), 13), {
		when: "12 Oct",
		detail: "13 days ago",
	})
})

test("a title says the service it is new on", () => {
	assert.equal(newOn("Netflix"), "New on Netflix")
	assert.equal(newOn(null), "New on your services")
})

// ---------------------------------------------------------------------------------------------------------
// Home's doors

test("a landed title leads its own door, the latest first, and the rest keeps its order", () => {
	const behind = () => true
	// Best match first: 1, 2, 3, 4. Title 3 landed yesterday, title 9 before it; 9 is not in the door's first ones.
	assert.deepEqual(landedFirst([1, 2, 3, 4], [3, 9], behind), [3, 9, 1, 2, 4])
	// Nothing landed: the door is as it was.
	assert.deepEqual(landedFirst([1, 2, 3], [], behind), [1, 2, 3])
})

test("a landed title that is not behind the door does not lead it", () => {
	// A show the member is in the middle of landed, and a show to start did: only the second is behind Start a show.
	const toStart = new Set([301, 302, 303])
	assert.deepEqual(
		landedFirst([301, 302, 303], [202, 303], (id) => toStart.has(id)),
		[303, 301, 302],
	)
	assert.deepEqual(
		landedFirst([301, 302, 303], [202], (id) => toStart.has(id)),
		[301, 302, 303],
	)
})

test("the door's small line says where its first title is new, unless the pill names that title already", () => {
	const led = { title: "Dune: Part Two", newOn: "Netflix" }
	// The member opened My movies since: no pill.
	assert.equal(doorNewOn(led, null), "New on Netflix")
	// One landing they have not seen: the pill is the sentence, and the door does not repeat it.
	const pill = landedWords("movie", {
		count: 1,
		ids: [1],
		only: { title: "Dune: Part Two", service: "Netflix" },
	})
	assert.equal(pill?.door, "Dune: Part Two is now on Netflix")
	assert.equal(doorNewOn(led, pill?.door ?? null), null)
	// On a phone the pill counts, and so it does for several: the line says the service.
	assert.equal(doorNewOn(led, pill?.doorShort ?? null), "New on Netflix")
	assert.equal(
		doorNewOn(led, "4 movies are now on your services"),
		"New on Netflix",
	)
	// The pill names another title: the one that leads still says why.
	assert.equal(doorNewOn(led, "Heat is now on Netflix"), "New on Netflix")
	// A door that is not led by a landed title says nothing.
	assert.equal(doorNewOn({ title: "Past Lives" }, null), null)
	assert.equal(doorNewOn({ title: null }, null), null)
})

test("a show with a new episode that also landed: the door that opens My shows says the episode, and the show leads no door", () => {
	const episodes = {
		shows: 1,
		ids: [95480],
		only: { title: "Slow Horses", season: 5, number: 3, episodes: 1 },
	}
	const both = {
		count: 1,
		ids: [95480],
		only: { title: "Slow Horses", service: "Netflix" },
	}
	const pill = showsWords(episodes, both)
	// One show, counted once, and its episode is what is said.
	assert.equal(pill?.badge, "1")
	assert.ok(!pill?.door.includes("is now on"))
	// The show is in Continue, so it is not behind Start a show and the shows to start keep their order.
	assert.deepEqual(
		landedFirst([301, 302], [95480], (id) => id === 301 || id === 302),
		[301, 302],
	)
	// Start a show is led by another show: its line is not what the pill says.
	assert.equal(
		doorNewOn({ title: "Andor", newOn: "Disney+" }, pill?.door ?? null),
		"New on Disney+",
	)
})
