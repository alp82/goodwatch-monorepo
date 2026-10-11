import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { countriesWithOffers, topCountries } = await import("./countryOffers.ts")
const { servicesByCountry } = await import("../../../utils/streaming-links.ts")

const media = {
	mediaType: "movie",
	details: { tmdb_id: 1 },
	streaming_availabilities: [],
	streaming_services: [
		{ tmdb_id: 8, name: "Netflix", logo: "/n", order_default: 1 },
		{ tmdb_id: 9, name: "Amazon Prime Video", logo: "/p", order_default: 2 },
	],
	streaming_countries: {
		counts: {
			DE: [1, 0, 0],
			US: [2, 1, 0],
			GB: [2, 0, 0],
			FR: [1, 0, 3],
			IT: [0, 0, 1],
		},
		top: {
			flatrate: [
				{ country_code: "GB", ids: [8, 9] },
				{ country_code: "US", ids: [8, 9] },
				{ country_code: "DE", ids: [8] },
				{ country_code: "FR", ids: [9, 77] },
			],
			rent: [{ country_code: "US", ids: [2] }],
			buy: [],
		},
	},
} as unknown as Parameters<typeof countriesWithOffers>[0]

test("the countries with offers for a tab come most services first, then by name", () => {
	assert.deepEqual(
		countriesWithOffers(media, "flatrate").map((c) => [c.code, c.count]),
		[
			["GB", 2],
			["US", 2],
			["FR", 1],
			["DE", 1],
		],
	)
	assert.deepEqual(
		countriesWithOffers(media, "buy").map((c) => c.code),
		["FR", "IT"],
	)
})

test("the top countries leave out the current one, keep three, and name only the services the catalog has", () => {
	const top = topCountries(media, "flatrate", "DE")
	assert.deepEqual(
		top.map((c) => [c.code, c.name, c.services.map((s) => s.name)]),
		[
			["GB", "United Kingdom", ["Netflix", "Prime"]],
			["US", "United States", ["Netflix", "Prime"]],
			["FR", "France", ["Prime"]],
		],
	)
	assert.deepEqual(topCountries(media, "buy", "DE"), [])
})

test("details cached without the other countries have none", () => {
	const old = { ...media, streaming_countries: undefined } as typeof media
	assert.deepEqual(countriesWithOffers(old, "flatrate"), [])
	assert.deepEqual(topCountries(old, "flatrate", "DE"), [])
})

test("services per country put the free offers under stream and keep one service per brand", () => {
	const catalog = new Map(
		[
			{ tmdb_id: 8, name: "Netflix", order_default: 2 },
			{ tmdb_id: 1796, name: "Netflix basic with Ads", order_default: 3 }, // ignored
			{ tmdb_id: 4, name: "MGM Amazon Channel", order_default: 1 },
			{ tmdb_id: 5, name: "MGM", order_default: 9 },
			{ tmdb_id: 2, name: "Apple TV", order_default: 1 },
		].map((s) => [s.tmdb_id, s]),
	)
	const offers = [
		["US", "flatrate", 8],
		["US", "ads", 1796],
		["US", "free", 5],
		["US", "flatrate_and_buy", 4],
		["US", "rent", 2],
		["US", "cinema", 2], // not a tab
		["FR", "flatrate", 1796],
		["IT", "rent", 99], // not in the catalog
	].map(([country_code, streaming_type, streaming_service_id]) => ({
		country_code: country_code as string,
		streaming_type: streaming_type as string,
		streaming_service_id: streaming_service_id as number,
	}))
	assert.deepEqual(
		[...servicesByCountry(offers, catalog)],
		[["US", [[4, 8], [2], []]]],
	)
})
