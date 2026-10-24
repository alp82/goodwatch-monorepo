// "New on your services" (#489 Part C): what each address under /new answers. The share link leads to the viewer's
// own country, an empty page is kept out of search engines, a page opened from another country offers the viewer's
// own, and /new is the member's own page. Data comes from fakes of the reads (new-on-services.server.ts).

import "@remix-run/node"
import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const { loadMemberPage, loadServicePage, loadWherePage, DAY_LIMIT } =
	await import("./new-on-services-page.server.ts")
const { titleKey } = await import("../utils/title-key.ts")

type Deps = Parameters<typeof loadServicePage>[3]
type Title = Awaited<ReturnType<Deps["titles"]>>[number]

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

function deps(over: Partial<Deps> = {}): Deps & { asked: unknown[] } {
	const asked: unknown[] = []
	return {
		asked,
		now: () => NOW,
		launch: () => Date.parse("2026-10-01T00:00:00Z"),
		summary: async () => ({
			countries: [
				{ code: "DE", name: "Germany" },
				{ code: "US", name: "United States" },
				{ code: "FR", name: "France" },
			],
			counts: {
				US: { netflix: 3, hulu: 2 },
				DE: { netflix: 1 },
				FR: {},
			},
			updatedAt: ago(0) + 3_600_000,
			logos: { netflix: "/netflix.png", hulu: "/hulu.png" },
		}),
		titles: async (input) => {
			asked.push(input)
			return input.country === "US" ? [title(1), title(2), title(3)] : []
		},
		viewer: async () => ({ country: "US", member: null }),
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
		request("/new/netflix"),
		"netflix",
		deps({
			viewer: async () => ({
				country: "FR",
				member: { services: [8], savedCountry: "FR", waits: new Map() },
			}),
		}),
	)
	assert.ok(answer instanceof Response)
	assert.equal(answer.headers.get("Location"), "/new/fr/netflix")
})

test("a country in capitals moves to its lower-case address; an unknown part is not found", async () => {
	const moved = await loadWherePage(request("/new/US"), "US", deps())
	assert.ok(moved instanceof Response)
	assert.equal(moved.status, 301)
	assert.equal(moved.headers.get("Location"), "/new/us")
	for (const part of ["zz", "tubi"])
		await assert.rejects(
			loadWherePage(request(`/new/${part}`), part, deps()),
			(thrown: unknown) => thrown instanceof Response && thrown.status === 404,
		)
})

test("a country's page lists every service of the country and links each service with titles", async () => {
	const fake = deps()
	const page = asData(await loadWherePage(request("/new/us"), "us", fake))
	assert.equal(page.kind, "country")
	assert.equal(page.path, "/new/us")
	assert.equal(page.robots, "index, follow")
	assert.equal(page.copy.heading, "New on streaming in the United States")
	assert.equal(page.share, null)
	assert.deepEqual(
		page.keys.map(({ slug, path }) => [slug, path]),
		[
			["netflix", "/new/us/netflix"],
			["hulu", "/new/us/hulu"],
		],
	)
	const [input] = fake.asked as { services: number[] }[]
	assert.equal(input.services.length, 10)
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
			deps({ titles: async () => many }),
		),
	)
	const shown = page.days.flatMap(({ titles }) => titles).length
	assert.equal(shown, DAY_LIMIT)
	assert.equal(page.more, 5)
	assert.equal(page.total, DAY_LIMIT + 5)
	assert.equal(page.ranked.length, 10)
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
		titles: async (input) => {
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
