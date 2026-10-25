// "New on your services" (#489 Part C): which titles a page lists, in which order, what it says about their day, where
// its addresses lead, and when search engines may list it.

import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	BRANDS,
	brandBySlug,
	brandOfService,
	familyOf,
	serviceIdsOf,
	windowStart,
	arrivalsOf,
	countryArrivalsOf,
	waitsOf,
	rankByScore,
	dayGroupsOf,
	dayWords,
	dayHeading,
	dayStamp,
	arrivalWords,
	tallyWords,
	inCountry,
	readWhere,
	countryPath,
	servicePath,
	sharePath,
	shareTarget,
	countryOffer,
	robotsFor,
	pageCopy,
} = await import("./new-on-services.ts")
const { baseService } = await import("./newly-available.ts")
const { titleKey } = await import("../utils/title-key.ts")

const DAY = 86_400_000
// Sunday, October 25, 2026, 15:00 UTC.
const NOW = Date.parse("2026-10-25T15:00:00Z")
const TODAY = Date.parse("2026-10-25T00:00:00Z")
const ago = (days: number) => TODAY - days * DAY
const LAUNCH = Date.parse("2026-10-01T00:00:00Z")
const NETFLIX = 8
const NETFLIX_ADS = 1796
const HULU = 15

const dune = titleKey("movie", 1)
const arcane = titleKey("show", 2)
const heat = titleKey("movie", 3)

const stay = (over: {
	key: number
	service?: number
	landedOn: number
	exact?: boolean
	backfill?: boolean
	droppedOn?: number | null
}) => ({
	service: NETFLIX,
	exact: true,
	backfill: false,
	droppedOn: null,
	createdAt: over.landedOn + 3_600_000,
	...over,
})

// ---------------------------------------------------------------------------------------------------------
// Services

test("each brand is one service, and its id is the one the rest of the app counts it as", () => {
	assert.equal(brandBySlug("netflix")?.name, "Netflix")
	assert.equal(brandOfService(NETFLIX_ADS)?.slug, "netflix")
	assert.equal(familyOf(NETFLIX_ADS), NETFLIX)
	// Amazon Video folds into Prime Video in the rest of the app; so it does here.
	assert.equal(familyOf(10), 9)
	assert.equal(familyOf(350), familyOf(2))
	for (const brand of BRANDS)
		for (const id of brand.ids) {
			const family = familyOf(id)
			assert.equal(baseService(family), family, `${brand.slug} ${id}`)
		}
	// A service outside the brands is itself.
	assert.equal(familyOf(73), 73)
	assert.equal(brandBySlug("tubi"), null)
})

test("reading a brand reads every id it has, and a service outside the brands reads its duplicates", () => {
	assert.deepEqual(serviceIdsOf([NETFLIX]).sort((a, b) => a - b), [8, 1796])
	assert.deepEqual(
		serviceIdsOf([NETFLIX_ADS, HULU]).sort((a, b) => a - b),
		[8, 15, 1796],
	)
	assert.deepEqual(serviceIdsOf([73]), [73])
})

test("brands use the site's slugs and names: the streaming pages' slugs, the title page's short names", () => {
	assert.deepEqual(
		BRANDS.map(({ slug, name }) => [slug, name]),
		[
			["netflix", "Netflix"],
			["amazon-prime", "Amazon Prime Video"],
			["disney-plus", "Disney+"],
			["hbo-max", "HBO Max"],
			["apple-tv", "Apple TV"],
			["hulu", "Hulu"],
			["peacock", "Peacock"],
			["paramount-plus", "Paramount+"],
			["crunchyroll", "Crunchyroll"],
			["mubi", "MUBI"],
		],
	)
	// The streaming category pages (ui/explore/category/streaming.ts) already use these three slugs.
	for (const slug of ["netflix", "amazon-prime", "disney-plus"])
		assert.ok(brandBySlug(slug), slug)
	assert.equal(brandBySlug("prime-video"), null)
})

test("no service slug looks like a country", () => {
	for (const brand of BRANDS) assert.ok(!/^[a-z]{2}$/.test(brand.slug))
})

// ---------------------------------------------------------------------------------------------------------
// The window: an arrival counts for 14 days, flat, and never before the launch

test("the window holds today and the 13 days before it, and starts no earlier than the launch day", () => {
	assert.equal(windowStart(NOW, LAUNCH), ago(13))
	const lateLaunch = Date.parse("2026-10-20T08:30:00Z")
	assert.equal(windowStart(NOW, lateLaunch), Date.parse("2026-10-20T00:00:00Z"))
})

test("a landing day after today is never listed", () => {
	const arrivals = arrivalsOf(
		[
			stay({ key: dune, landedOn: ago(0) }),
			stay({ key: arcane, landedOn: ago(-1) }),
		],
		{ services: [NETFLIX], since: ago(13), until: NOW },
	)
	assert.deepEqual(
		arrivals.map(({ key }) => key),
		[dune],
	)
})

test("a page lists the titles first seen in its window, newest first", () => {
	const since = windowStart(NOW, LAUNCH)
	const arrivals = arrivalsOf(
		[
			stay({ key: dune, landedOn: ago(13) }),
			stay({ key: arcane, landedOn: ago(0) }),
			stay({ key: heat, landedOn: ago(14) }),
		],
		{ services: [NETFLIX], since },
	)
	assert.deepEqual(
		arrivals.map(({ key, at }) => [key, at]),
		[
			[arcane, ago(0)],
			[dune, ago(13)],
		],
	)
})

// ---------------------------------------------------------------------------------------------------------
// Exact and unknown days

test("an arrival keeps whether its day is exact", () => {
	const arrivals = arrivalsOf(
		[
			stay({ key: dune, landedOn: ago(2), exact: true }),
			stay({ key: arcane, landedOn: ago(1), exact: false }),
		],
		{ services: [NETFLIX], since: ago(13) },
	)
	assert.deepEqual(
		arrivals.map(({ key, exact }) => [key, exact]),
		[
			[arcane, false],
			[dune, true],
		],
	)
})

test("of two offers that start the same day, an exact one makes the day exact", () => {
	const [arrival] = arrivalsOf(
		[
			stay({ key: dune, service: NETFLIX, landedOn: ago(3), exact: false }),
			stay({ key: dune, service: NETFLIX_ADS, landedOn: ago(3), exact: true }),
		],
		{ services: [NETFLIX], since: ago(13) },
	)
	assert.equal(arrival.exact, true)
	assert.equal(arrival.service, NETFLIX)
})

test("a return that joins an older stay takes that stay's day and precision", () => {
	const arrivals = arrivalsOf(
		[
			stay({ key: dune, landedOn: ago(9), exact: false, droppedOn: ago(4) }),
			stay({ key: dune, landedOn: ago(3), exact: true }),
		],
		{ services: [NETFLIX], since: ago(13) },
	)
	assert.deepEqual(arrivals, [
		{ key: dune, service: NETFLIX, at: ago(9), exact: false },
	])
})

// ---------------------------------------------------------------------------------------------------------
// Backfill is never an arrival

test("a backfilled offer is not an arrival, and keeps a later offer of the same service from being one", () => {
	const arrivals = arrivalsOf(
		[
			stay({ key: dune, landedOn: ago(1), backfill: true, exact: false }),
			// Already on Netflix (backfilled), now also on Netflix with ads: not new on Netflix.
			stay({ key: arcane, landedOn: 0, backfill: true, exact: false }),
			stay({ key: arcane, service: NETFLIX_ADS, landedOn: ago(1) }),
		],
		{ services: [NETFLIX], since: ago(13) },
	)
	assert.deepEqual(arrivals, [])
})

test("a title that moves from one service to another is new on the second service's page", () => {
	const arrivals = arrivalsOf(
		[stay({ key: dune, service: NETFLIX, landedOn: ago(2) })],
		{ services: [NETFLIX], since: ago(13) },
	)
	assert.equal(arrivals.length, 1)
})

test("across several services, a title one of them carried before is not new", () => {
	const both = { services: [NETFLIX, HULU], since: ago(13) }
	// On Hulu since long before the window, now on Netflix too.
	assert.deepEqual(
		arrivalsOf(
			[
				stay({ key: dune, service: HULU, landedOn: 0, backfill: true }),
				stay({ key: dune, service: NETFLIX, landedOn: ago(2) }),
			],
			both,
		),
		[],
	)
	// Moved from Hulu to Netflix: Hulu dropped it the day before.
	assert.deepEqual(
		arrivalsOf(
			[
				stay({
					key: dune,
					service: HULU,
					landedOn: 0,
					backfill: true,
					droppedOn: ago(3),
				}),
				stay({ key: dune, service: NETFLIX, landedOn: ago(2) }),
			],
			both,
		),
		[],
	)
	// New on both: the first one counts.
	assert.deepEqual(
		arrivalsOf(
			[
				stay({ key: dune, service: HULU, landedOn: ago(5), exact: false }),
				stay({ key: dune, service: NETFLIX, landedOn: ago(2) }),
			],
			both,
		),
		[{ key: dune, service: HULU, at: ago(5), exact: false }],
	)
})

test("a member waits for their Want to See titles and the shows they watch", () => {
	const waits = waitsOf(
		new Map([
			[dune, new Date(ago(20))],
			[arcane, new Date(ago(20))],
		]),
		{ "show-2": { state: "watching" }, "show-9": { state: "on_hold" } },
	)
	assert.deepEqual(
		[...waits].sort(([a], [b]) => a - b),
		[
			[dune, "want"],
			[arcane, "watching"],
			[titleKey("show", 9), "watching"],
		],
	)
})

test("one read of a country gives each brand's page and the country's page, each by its own rule", () => {
	const stays = [
		// On Hulu since long ago, now on Netflix too: new on Netflix's page, not on the country's page.
		stay({ key: dune, service: HULU, landedOn: 0, backfill: true }),
		stay({ key: dune, service: NETFLIX, landedOn: ago(2) }),
		// Netflix with ads only: Netflix's page.
		stay({ key: arcane, service: NETFLIX_ADS, landedOn: ago(1), exact: false }),
		// Old on Netflix, new on its ad tier: on no page.
		stay({ key: heat, service: NETFLIX, landedOn: 0, backfill: true }),
		stay({ key: heat, service: NETFLIX_ADS, landedOn: ago(1) }),
	]
	const since = ago(13)
	const { brands, all } = countryArrivalsOf(stays, { since, until: NOW })
	assert.deepEqual(
		brands.netflix,
		arrivalsOf(stays, { services: [NETFLIX], since, until: NOW }),
	)
	assert.deepEqual(
		brands.netflix.map(({ key }) => key),
		[arcane, dune],
	)
	assert.equal(brands.hulu, undefined)
	assert.deepEqual(
		all.map(({ key }) => key),
		[arcane],
	)
})

// ---------------------------------------------------------------------------------------------------------
// Ranking and days

test("the ranked list is best score first, titles without a score last, newer first on a tie", () => {
	const list = [
		{ key: dune, at: ago(5), score: 70 },
		{ key: arcane, at: ago(1), score: null },
		{ key: heat, at: ago(2), score: 70 },
		{ key: titleKey("movie", 4), at: ago(9), score: 91 },
	]
	assert.deepEqual(
		rankByScore(list).map(({ key }) => key),
		[titleKey("movie", 4), heat, dune, arcane],
	)
})

test("a title without a poster ranks after the titles with one, in the list and in its day", () => {
	const list = [
		{ key: dune, at: ago(2), score: 90, poster_path: null, exact: true },
		{ key: arcane, at: ago(2), score: 60, poster_path: "/a.jpg", exact: true },
		{ key: heat, at: ago(2), score: null, poster_path: "/h.jpg", exact: true },
	]
	assert.deepEqual(
		rankByScore(list).map(({ key }) => key),
		[arcane, heat, dune],
	)
	assert.deepEqual(
		dayGroupsOf(list)[0].titles.map(({ key }) => key),
		[arcane, heat, dune],
	)
	// Titles without a known day stay newest first, behind the ones with a poster.
	const unknown = list.map((title, i) => ({ ...title, exact: false, at: ago(i) }))
	assert.deepEqual(
		dayGroupsOf(unknown)[0].titles.map(({ key }) => key),
		[arcane, heat, dune],
	)
})

test("day by day groups exact days, the latest first, and puts the titles without a day last", () => {
	const list = [
		{ key: dune, at: ago(2), exact: true, score: 60 },
		{ key: arcane, at: ago(0), exact: true, score: 80 },
		{ key: heat, at: ago(2), exact: true, score: 90 },
		{ key: titleKey("show", 5), at: ago(1), exact: false, score: 99 },
		{ key: titleKey("show", 6), at: ago(4), exact: false, score: 50 },
	]
	assert.deepEqual(
		dayGroupsOf(list).map(({ day, titles }) => [day, titles.map((t) => t.key)]),
		[
			[ago(0), [arcane]],
			[ago(2), [heat, dune]],
			[null, [titleKey("show", 5), titleKey("show", 6)]],
		],
	)
})

// ---------------------------------------------------------------------------------------------------------
// What the page says

test("a title with an exact day says it, one without says only where it is new", () => {
	assert.equal(dayWords(ago(0) + 5_000, NOW), "today")
	assert.equal(dayWords(ago(1), NOW), "yesterday")
	assert.equal(dayWords(ago(3), NOW), "on Thursday")
	assert.equal(dayWords(ago(7), NOW), "on October 18")
	assert.equal(dayHeading(ago(0), NOW), "Today")
	assert.equal(dayHeading(ago(1), NOW), "Yesterday")
	assert.equal(dayHeading(ago(3), NOW), "Thursday, October 22")
	assert.equal(dayStamp(ago(3), NOW), "Thu, Oct 22")
	assert.equal(
		arrivalWords({ at: ago(1), exact: true }, "Netflix", NOW),
		"New on Netflix yesterday",
	)
	const unknown = arrivalWords({ at: ago(1), exact: false }, "Netflix", NOW)
	assert.equal(unknown, "New on Netflix")
	assert.doesNotMatch(unknown, /week|days|today|yesterday/)
})

test("the line under the heading counts the titles and today's exact arrivals", () => {
	const since = ago(13)
	const t = (exact: boolean, at: number, kind: "movie" | "show" = "movie") => ({
		exact,
		at,
		media_type: kind,
	})
	assert.equal(
		tallyWords(
			[t(true, ago(0)), t(false, ago(0)), t(true, ago(3), "show")],
			since,
			NOW,
		),
		"3 movies and shows in the last 14 days, 1 of them today",
	)
	assert.equal(tallyWords([t(true, ago(3))], since, NOW), "1 movie in the last 14 days")
	assert.equal(
		tallyWords([t(true, ago(1), "show")], ago(4), NOW),
		"1 show in the last 5 days",
	)
	assert.equal(tallyWords([], since, NOW), "Nothing new in the last 14 days")
})

test("a country reads with its article where English uses one", () => {
	assert.equal(inCountry("United States"), "in the United States")
	assert.equal(inCountry("Netherlands"), "in the Netherlands")
	assert.equal(inCountry("Cayman Islands"), "in the Cayman Islands")
	assert.equal(inCountry("Germany"), "in Germany")
})

// ---------------------------------------------------------------------------------------------------------
// Addresses

test("the second part of /new is a country, a service to share, or nothing", () => {
	const known = new Set(["US", "DE"])
	assert.deepEqual(readWhere("us", known), { kind: "country", country: "US" })
	assert.deepEqual(readWhere("US", known), {
		kind: "redirect",
		to: "/new/us",
	})
	assert.deepEqual(readWhere("netflix", known), {
		kind: "share",
		brand: brandBySlug("netflix"),
	})
	assert.deepEqual(readWhere("zz", known), { kind: "notFound" })
	assert.deepEqual(readWhere("tubi", known), { kind: "notFound" })
})

test("the share link has no country and leads each visitor to the page of their own country", () => {
	const netflix = brandBySlug("netflix")
	assert.ok(netflix)
	assert.equal(countryPath("US"), "/new/us")
	assert.equal(servicePath("US", netflix), "/new/us/netflix")
	assert.equal(sharePath(netflix), "/new/netflix")
	assert.equal(shareTarget(netflix, "DE"), "/new/de/netflix")
	assert.equal(shareTarget(netflix, "de"), "/new/de/netflix")
})

test("a country page opened from another country offers the visitor's own", () => {
	const netflix = brandBySlug("netflix")
	assert.ok(netflix)
	const names = new Map([
		["US", "United States"],
		["DE", "Germany"],
	])
	assert.equal(countryOffer("US", "US", netflix, names), null)
	assert.deepEqual(countryOffer("US", "DE", netflix, names), {
		country: "DE",
		path: "/new/de/netflix",
		words: "New on Netflix in Germany",
	})
	assert.deepEqual(countryOffer("US", "DE", null, names), {
		country: "DE",
		path: "/new/de",
		words: "New on streaming in Germany",
	})
	// A country the site has no pages for offers nothing.
	assert.equal(countryOffer("US", "XK", netflix, names), null)
})

// ---------------------------------------------------------------------------------------------------------
// Search engines

test("an empty page and the member's own page are kept out of search engines", () => {
	assert.equal(robotsFor("service", 0), "noindex, follow")
	assert.equal(robotsFor("country", 0), "noindex, follow")
	assert.equal(robotsFor("service", 1), "index, follow")
	assert.equal(robotsFor("country", 12), "index, follow")
	assert.equal(robotsFor("member", 12), "noindex, follow")
})

test("a page's title and heading answer the search it is for", () => {
	assert.deepEqual(
		pageCopy({
			kind: "service",
			brand: "Netflix",
			country: "US",
			countryName: "United States",
			tally: "105 movies and shows in the last 14 days, 4 of them today",
			count: 105,
		}),
		{
			heading: "New on Netflix",
			title: "New on Netflix (US): the latest movies and shows | GoodWatch",
			description:
				"What's new on Netflix in the United States: 105 movies and shows in the last 14 days, 4 of them today. Best first, with GoodWatch scores. Updated daily.",
		},
	)
	const empty = pageCopy({
		kind: "country",
		brand: null,
		country: "DE",
		countryName: "Germany",
		tally: "Nothing new in the last 14 days",
		count: 0,
	})
	assert.equal(empty.heading, "New on streaming in Germany")
	assert.equal(
		empty.title,
		"New on streaming in Germany: the latest movies and shows | GoodWatch",
	)
	assert.equal(
		empty.description,
		"What's new on streaming in Germany. Nothing new in the last 14 days. Updated daily.",
	)
	assert.equal(
		pageCopy({
			kind: "member",
			brand: null,
			country: "DE",
			countryName: "Germany",
			tally: "",
			count: 3,
		}).title,
		"New on your services | GoodWatch",
	)
})
