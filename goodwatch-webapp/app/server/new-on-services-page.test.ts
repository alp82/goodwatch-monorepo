// "New on your services" (#489 Part C): what each address under /new answers. The share link leads to the viewer's
// own country, an empty page is kept out of search engines, a page opened from another country offers the viewer's
// own, and /new is the member's own page. The links between pages and the sitemap's index count exactly what each
// page lists. Data comes from fakes of the reads (new-on-services.server.ts).

import "@remix-run/node"
import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const {
	loadMemberPage,
	loadServicePage,
	loadWherePage,
	loadPagesIndex,
	linksOf,
	linksAcross,
	arrivalTitlesOf,
	weekTitlesOf,
	newPagesHere,
	offersOf,
	DAY_LIMIT,
} = await import("./new-on-services-page.server.ts")
const { titleKey } = await import("../utils/title-key.ts")

type Deps = Parameters<typeof loadServicePage>[3]
type CountryArrivals = Awaited<ReturnType<Deps["country"]>>
type Title = CountryArrivals["all"][number]

const DAY = 86_400_000
const NOW = Date.parse("2026-10-25T15:00:00Z")
const TODAY = Date.parse("2026-10-25T00:00:00Z")
const ago = (days: number) => TODAY - days * DAY

const title = (id: number, over: Partial<Title> = {}): Title => ({
	key: titleKey("movie", id),
	tmdb_id: id,
	media_type: "movie",
	title: `Movie ${id}`,
	release_year: 2020,
	runtime: 100,
	poster_path: `/p${id}.jpg`,
	backdrop_path: `/b${id}.jpg`,
	score: 50 + id,
	path: `/movie/${id}-movie-${id}`,
	service: 8,
	at: ago(id % 10),
	exact: true,
	...over,
})

const COUNTRIES = [
	{ code: "DE", name: "Germany" },
	{ code: "US", name: "United States" },
	{ code: "FR", name: "France" },
]

/** What each country's one read gives: every brand's list and the country's list. */
const ARRIVALS: Record<string, CountryArrivals> = {
	US: {
		brands: {
			netflix: [title(3), title(2), title(1)],
			hulu: [title(4, { service: 15 })],
		},
		all: [title(4, { service: 15 }), title(3), title(2), title(1)],
	},
	DE: { brands: { netflix: [title(5)] }, all: [title(5)] },
	FR: { brands: {}, all: [] },
}

function deps(over: Partial<Deps> = {}): Deps & { asked: unknown[] } {
	const asked: unknown[] = []
	return {
		asked,
		now: () => NOW,
		launch: () => Date.parse("2026-10-01T00:00:00Z"),
		countries: async () => COUNTRIES,
		meta: async () => ({
			updatedAt: ago(0) + 3_600_000,
			logos: { netflix: "/netflix.png", hulu: "/hulu.png" },
		}),
		country: async ({ country }) => {
			asked.push(country)
			return ARRIVALS[country] ?? { brands: {}, all: [] }
		},
		memberTitles: async () => [],
		links: async () =>
			linksOf(
				COUNTRIES.map(({ code }) => ({ country: code, arrivals: ARRIVALS[code] })),
			),
		viewer: async () => ({ country: "US", member: null }),
		// Every title is on Netflix and Hulu in the country, as the availability index has it.
		offers: async (_country, keys) =>
			keys.map(() => [
				{ id: 8, name: "Netflix", logo_path: "/n.png" },
				{ id: 15, name: "Hulu", logo_path: "/h.png" },
			]),
		serviceCards: async (ids) =>
			ids.map((id) => ({ id, name: `Service ${id}`, logo_path: null })),
		...over,
	}
}

const request = (path: string) => new Request(`https://goodwatch.app${path}`)
const asData = <T>(value: T | Response): T => {
	assert.ok(!(value instanceof Response), "expected page data")
	return value as T
}

// ---------------------------------------------------------------------------------------------------------
// The share link and the second part of /new

test("the share link sends each visitor to the page of their own country, and no cache keeps that answer", async () => {
	const answer = await loadWherePage(
		request("/new/netflix"),
		"netflix",
		deps({ viewer: async () => ({ country: "DE", member: null }) }),
	)
	assert.ok(answer instanceof Response)
	assert.equal(answer.status, 302)
	assert.equal(answer.headers.get("Location"), "/new/de/netflix")
	assert.equal(answer.headers.get("Cache-Control"), "private, no-store")
})

test("a member's share link follows their saved country", async () => {
	const answer = await loadWherePage(
		request("/new/amazon-prime"),
		"amazon-prime",
		deps({
			viewer: async () => ({
				country: "FR",
				member: { services: [8], savedCountry: "FR", waits: new Map() },
			}),
		}),
	)
	assert.ok(answer instanceof Response)
	assert.equal(answer.headers.get("Location"), "/new/fr/amazon-prime")
})

test("a country in capitals moves to its lower-case address; an unknown part is not found", async () => {
	const moved = await loadWherePage(request("/new/US"), "US", deps())
	assert.ok(moved instanceof Response)
	assert.equal(moved.status, 301)
	assert.equal(moved.headers.get("Location"), "/new/us")
	for (const part of ["zz", "tubi", "prime-video"])
		await assert.rejects(
			loadWherePage(request(`/new/${part}`), part, deps()),
			(thrown: unknown) => thrown instanceof Response && thrown.status === 404,
		)
})

test("a country's page lists every brand of the country from the country's one read", async () => {
	const fake = deps()
	const page = asData(await loadWherePage(request("/new/us"), "us", fake))
	assert.equal(page.kind, "country")
	assert.equal(page.path, "/new/us")
	assert.equal(page.robots, "index, follow")
	assert.equal(page.copy.heading, "New on streaming in the United States")
	assert.equal(page.share, null)
	assert.equal(page.total, 4)
	assert.deepEqual(fake.asked, ["US"])
	assert.deepEqual(
		page.keys.map(({ slug, path }) => [slug, path]),
		[
			["netflix", "/new/us/netflix"],
			["hulu", "/new/us/hulu"],
		],
	)
	assert.deepEqual(
		page.otherCountries.map(({ code }) => code),
		["DE"],
	)
	assert.equal(page.incomplete, false)
})

// ---------------------------------------------------------------------------------------------------------
// A service's page

test("a service's page ranks by score, lists day by day, and may be listed by search engines", async () => {
	const page = asData(
		await loadServicePage(request("/new/us/netflix"), "us", "netflix", deps()),
	)
	assert.equal(page.kind, "service")
	assert.equal(page.path, "/new/us/netflix")
	assert.equal(page.robots, "index, follow")
	assert.equal(page.share, "/new/netflix")
	assert.equal(page.brand?.name, "Netflix")
	assert.equal(page.brand?.logo_path, "/netflix.png")
	assert.deepEqual(
		page.ranked.map(({ tmdb_id }) => tmdb_id),
		[3, 2, 1],
	)
	assert.deepEqual(
		page.days.map(({ day }) => day),
		[ago(1), ago(2), ago(3)],
	)
	assert.equal(page.total, 3)
	assert.equal(page.copy.tally, "3 movies in the last 14 days")
	assert.equal(page.updatedAt, ago(0) + 3_600_000)
	assert.equal(page.hero, "/b3.jpg")
	// Other countries with Netflix titles; France has none.
	assert.deepEqual(page.otherCountries, [
		{ code: "DE", name: "Germany", path: "/new/de/netflix" },
	])
	assert.equal(page.offer, null)
	// The data a page sends has no backdrops but the hero's.
	assert.ok(!("backdrop_path" in page.ranked[0]))
})

test("an empty page still opens but is kept out of search engines", async () => {
	const page = asData(
		await loadServicePage(request("/new/de/hulu"), "de", "hulu", deps()),
	)
	assert.equal(page.total, 0)
	assert.equal(page.robots, "noindex, follow")
	assert.equal(page.copy.tally, "Nothing new in the last 14 days")
	assert.equal(page.hero, null)
})

test("a page opened from another country offers the viewer's own", async () => {
	const page = asData(
		await loadServicePage(
			request("/new/us/netflix"),
			"us",
			"netflix",
			deps({ viewer: async () => ({ country: "DE", member: null }) }),
		),
	)
	assert.deepEqual(page.offer, {
		country: "DE",
		path: "/new/de/netflix",
		words: "New on Netflix in Germany",
	})
})

test("a service's page in capitals moves, and an unknown country or service is not found", async () => {
	const moved = await loadServicePage(
		request("/new/US/netflix"),
		"US",
		"netflix",
		deps(),
	)
	assert.ok(moved instanceof Response)
	assert.equal(moved.status, 301)
	assert.equal(moved.headers.get("Location"), "/new/us/netflix")
	for (const [country, slug] of [
		["zz", "netflix"],
		["us", "tubi"],
	]) {
		await assert.rejects(
			loadServicePage(request(`/new/${country}/${slug}`), country, slug, deps()),
			(thrown: unknown) => thrown instanceof Response && thrown.status === 404,
		)
	}
})

test("day by day shows the newest titles up to its limit and counts the rest", async () => {
	const many = Array.from({ length: DAY_LIMIT + 5 }, (_, i) =>
		title(i + 1, { at: ago(i % 14), score: i % 90 }),
	)
	const page = asData(
		await loadServicePage(
			request("/new/us/netflix"),
			"us",
			"netflix",
			deps({ country: async () => ({ brands: { netflix: many }, all: many }) }),
		),
	)
	const shown = page.days.flatMap(({ titles }) => titles).length
	assert.equal(shown, DAY_LIMIT)
	assert.equal(page.more, 5)
	assert.equal(page.total, DAY_LIMIT + 5)
	assert.equal(page.ranked.length, 10)
})

// ---------------------------------------------------------------------------------------------------------
// Links and the sitemap count exactly what a page lists

test("the counts behind the links are the lengths of the lists the pages show", () => {
	const { pages } = linksOf(
		COUNTRIES.map(({ code }) => ({ country: code, arrivals: ARRIVALS[code] })),
	)
	assert.deepEqual(pages, [
		{ country: "DE", brand: "netflix", titles: 1, latest: ago(5) },
		{ country: "DE", brand: null, titles: 1, latest: ago(5) },
		{ country: "US", brand: "netflix", titles: 3, latest: ago(1) },
		{ country: "US", brand: "hulu", titles: 1, latest: ago(4) },
		{ country: "US", brand: null, titles: 4, latest: ago(1) },
	])
})

test("a link never leads to an empty page: every linked page renders indexable", async () => {
	const fake = deps()
	const { pages } = (await fake.links(NOW, true)) ?? { pages: [] }
	for (const { country, brand } of pages) {
		const page = asData(
			brand
				? await loadServicePage(request("/"), country.toLowerCase(), brand, fake)
				: await loadWherePage(request("/"), country.toLowerCase(), fake),
		)
		assert.equal(page.robots, "index, follow", `${country} ${brand}`)
		assert.ok(page.total > 0)
	}
})

test("without the counts in time, a page renders without its links and is marked incomplete", async () => {
	const page = asData(
		await loadServicePage(
			request("/new/us/netflix"),
			"us",
			"netflix",
			deps({ links: async () => null }),
		),
	)
	assert.equal(page.incomplete, true)
	assert.deepEqual(page.otherCountries, [])
	assert.deepEqual(
		page.keys.map(({ slug }) => slug),
		["netflix"],
	)
	// The page's own titles and robots don't depend on the links.
	assert.equal(page.total, 3)
	assert.equal(page.robots, "index, follow")
})

test("the pages index lists every page with titles, with its address, count and latest arrival", async () => {
	const index = await loadPagesIndex(deps())
	assert.deepEqual(index.pages, [
		{ path: "/new/de/netflix", titles: 1, latest: ago(5) },
		{ path: "/new/de", titles: 1, latest: ago(5) },
		{ path: "/new/us/netflix", titles: 3, latest: ago(1) },
		{ path: "/new/us/hulu", titles: 1, latest: ago(4) },
		{ path: "/new/us", titles: 4, latest: ago(1) },
	])
})

// ---------------------------------------------------------------------------------------------------------
// One bad title or country breaks nothing else

/** Display fields as the catalog gives them; a title the import hasn't finished has no name (October 25: TMDB 1805719). */
const display = (id: number, name: string | null) => ({
	tmdb_id: id,
	media_type: "movie" as const,
	title: name,
	release_year: null,
	runtime: null,
	poster_path: null,
	backdrop_path: null,
	goodwatch_overall_score_normalized_percent: null,
})

test("a title without a name is left out, and its page, the links and the pages index still work", async () => {
	const arrival = (id: number) => ({ key: titleKey("movie", id), service: 8, at: ago(1), exact: true })
	const arrivals = [arrival(21), arrival(22), arrival(23)]
	const displays = new Map([
		[titleKey("movie", 21), display(21, " Niewidzialne ")],
		[titleKey("movie", 22), display(22, null)],
		[titleKey("movie", 23), display(23, "  ")],
	])
	const [netflix, all] = arrivalTitlesOf([arrivals, arrivals], displays, new Set())
	assert.deepEqual(
		all.map(({ title, path }) => [title, path]),
		[["Niewidzialne", "/movie/21-niewidzialne"]],
	)

	const IE: CountryArrivals = { brands: { netflix }, all }
	const fake = deps({
		countries: async () => [...COUNTRIES, { code: "IE", name: "Ireland" }],
		country: async ({ country }) => (country === "IE" ? IE : ARRIVALS[country]),
	})
	const links = await linksAcross(["US", "IE"], (code) => fake.country({ country: code, now: NOW }), 2)
	fake.links = async () => links
	assert.deepEqual(
		links.pages.filter(({ country }) => country === "IE"),
		[
			{ country: "IE", brand: "netflix", titles: 1, latest: ago(1) },
			{ country: "IE", brand: null, titles: 1, latest: ago(1) },
		],
	)

	const page = asData(await loadServicePage(request("/new/ie/netflix"), "ie", "netflix", fake))
	assert.equal(page.total, 1)
	assert.equal(page.incomplete, false)
	assert.equal(page.robots, "index, follow")
	const index = await loadPagesIndex(fake)
	assert.ok(index.pages.some(({ path, titles }) => path === "/new/ie/netflix" && titles === 1))
	assert.ok(index.pages.some(({ path }) => path === "/new/us/netflix"))
})

test("a country whose read fails is left out of the links; the others keep theirs, and the links count as incomplete", async () => {
	const failing = async (code: string) => {
		if (code === "SE") throw new TypeError("Cannot read properties of null (reading 'toLowerCase')")
		return ARRIVALS[code]
	}
	const logged = console.error
	console.error = () => {}
	let links: Awaited<ReturnType<typeof linksAcross>>
	try {
		links = await linksAcross(["US", "SE", "DE"], failing, 4)
	} finally {
		console.error = logged
	}
	assert.deepEqual(links.failed, ["SE"])
	assert.deepEqual(
		[...new Set(links.pages.map(({ country }) => country))],
		["DE", "US"],
	)
	// The page keeps its links to the countries that were read, and is not stored while one is missing.
	const page = asData(
		await loadServicePage(request("/new/us/netflix"), "us", "netflix", deps({ links: async () => links })),
	)
	assert.equal(page.incomplete, true)
	assert.deepEqual(
		page.otherCountries.map(({ code }) => code),
		["DE"],
	)
	assert.deepEqual(
		page.keys.map(({ slug }) => slug),
		["netflix", "hulu"],
	)
	// The pages index names what failed, so its route answers an error and the sitemap keeps its last file.
	const index = await loadPagesIndex(deps({ links: async () => links }))
	assert.deepEqual(index.failed, ["SE"])
})

test("links read in full are complete, and the pages index names no failure", async () => {
	const links = await linksAcross(["US", "DE"], async (code) => ARRIVALS[code], 2)
	assert.deepEqual(links.failed, [])
	assert.deepEqual((await loadPagesIndex(deps({ links: async () => links }))).failed, [])
})

test("the cards get every service a title is on in the country, the one it arrived on among them", async () => {
	const page = asData(await loadServicePage(request("/new/us/netflix"), "us", "netflix", deps()))
	const cards = [...page.ranked, ...page.days.flatMap(({ titles }) => titles)]
	assert.ok(cards.length > 0)
	for (const card of cards) assert.deepEqual(card.offers, [8, 15])
	assert.deepEqual(page.offerServices, {
		8: { name: "Netflix", logo_path: "/n.png" },
		15: { name: "Hulu", logo_path: "/h.png" },
	})
	assert.equal(page.incomplete, false)
})

test("the arrival service leads a title's offers when the index doesn't list it; unknown offers are just the arrival", async () => {
	const titles = [
		{ key: titleKey("movie", 1), service: 337 },
		{ key: titleKey("movie", 2), service: 8 },
	]
	const read = await offersOf("US", titles, {
		offers: async () => [[{ id: 8, name: "Netflix", logo_path: null }], null],
	})
	assert.deepEqual(read.offersOf(titles[0]), [337, 8])
	assert.deepEqual(read.offersOf(titles[1]), [8])
	assert.equal(read.loading, false)
})

test("before the country's availability is read, a page is incomplete and its cards show the arrival service", async () => {
	const page = asData(
		await loadServicePage(
			request("/new/us/netflix"),
			"us",
			"netflix",
			deps({ offers: async (_country, keys) => keys.map(() => null) }),
		),
	)
	assert.equal(page.incomplete, true)
	assert.ok(page.ranked.every(({ offers, service }) => offers?.length === 1 && offers[0] === service))
})

// ---------------------------------------------------------------------------------------------------------
// The start page's row

test("the start page's row takes this week: today and the six days before, best first as given", () => {
	const titles = [title(9, { at: ago(0) }), title(8, { at: ago(7) }), title(7, { at: ago(6) }), title(6, { at: ago(3) })]
	assert.deepEqual(
		weekTitlesOf(titles, NOW).map(({ tmdb_id }) => tmdb_id),
		[9, 7, 6],
	)
})

// ---------------------------------------------------------------------------------------------------------
// The member's own page

test("/new sends a visitor to the page of their country", async () => {
	const answer = await loadMemberPage(
		request("/new"),
		deps({ viewer: async () => ({ country: "DE", member: null }) }),
	)
	assert.ok(answer instanceof Response)
	assert.equal(answer.status, 302)
	assert.equal(answer.headers.get("Location"), "/new/de")
	assert.equal(answer.headers.get("Cache-Control"), "private, no-store")
})

test("/new is the member's own page: their services, their titles first, never listed", async () => {
	const fake = deps({
		viewer: async () => ({
			country: "US",
			member: {
				services: [8, 1796, 73],
				savedCountry: "US",
				waits: new Map([[titleKey("movie", 2), "want" as const]]),
			},
		}),
		memberTitles: async (input) => {
			fake.asked.push(input)
			return [title(1), title(2), title(3, { service: 73 })]
		},
	})
	const page = asData(await loadMemberPage(request("/new"), fake))
	assert.equal(page.kind, "member")
	assert.equal(page.robots, "noindex, follow")
	assert.equal(page.copy.heading, "New on your services")
	assert.deepEqual(
		page.waited.map(({ tmdb_id, wait }) => [tmdb_id, wait]),
		[[2, "want"]],
	)
	// Only brands have pages to link to; every service names its titles.
	assert.deepEqual(
		page.keys.map(({ slug }) => slug),
		["netflix"],
	)
	assert.equal(page.services[73]?.name, "Service 73")
	assert.equal(page.services[8]?.name, "Netflix")
	const [input] = fake.asked as { country: string; services: number[] }[]
	assert.equal(input.country, "US")
	assert.deepEqual(input.services, [8, 1796, 73])
})

test("a member without saved services gets their page with the way to save them", async () => {
	const page = asData(
		await loadMemberPage(
			request("/new"),
			deps({
				viewer: async () => ({
					country: "US",
					member: { services: [], savedCountry: null, waits: new Map() },
				}),
			}),
		),
	)
	assert.equal(page.kind, "member")
	assert.equal(page.member?.hasServices, false)
	assert.equal(page.total, 0)
})
