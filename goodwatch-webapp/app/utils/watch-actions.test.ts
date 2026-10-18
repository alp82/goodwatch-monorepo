import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { watchActions } = await import("./watch-actions.ts")
const { buildJsonLdDetail } = await import("./meta.ts")

const NETFLIX = "https://click.justwatch.com/a?r=https%3A%2F%2Fwww.netflix.com%2Ftitle%2F1&uct_country=us"
const APPLE = "https://click.justwatch.com/a?r=https%3A%2F%2Ftv.apple.com%2Fus%2Fmovie%2Fx&uct_country=us"
const TUBI = "https://click.justwatch.com/a?r=https%3A%2F%2Ftubitv.com%2Fmovies%2F1&uct_country=us"

const services = [
	{ tmdb_id: 8, name: "Netflix", order_default: 1 },
	{ tmdb_id: 2, name: "Apple TV", order_default: 3 },
	{ tmdb_id: 73, name: "Tubi TV", order_default: 5 },
	{ tmdb_id: 3, name: "Google Play Movies", order_default: 4 },
	{ tmdb_id: 1796, name: "Netflix basic with Ads", order_default: 2 },
]

type Offer = {
	streaming_service_id: number
	streaming_type: "flatrate" | "free" | "ads" | "rent" | "buy" | "flatrate_and_buy"
	stream_url: string | null
}
const movie = (offers: Offer[]) =>
	({
		mediaType: "movie",
		details: { tmdb_id: 603, title: "The Matrix", genres: [] },
		credits: { actors: [], directors: [], composers: [], executive_producers: [] },
		streaming_availabilities: offers,
		streaming_services: services,
	}) as never

const page = {
	title: "The Matrix",
	description: "A movie",
	url: "https://goodwatch.app/movie/603-the-matrix",
	image: "",
	alt: "",
}

type Action = {
	"@type": string
	provider: { name: string }
	target: { "@type": string; urlTemplate: string; actionPlatform: string[] }
	actionAccessibilityRequirement: {
		"@type": string
		category: string
		eligibleRegion: { "@type": string; name: string }
	}
	expectsAcceptanceOf?: { "@type": string; category: string }
}

test("each offer with a link becomes one WatchAction for the page's country, stream before rent and buy", () => {
	const actions = watchActions(
		movie([
			{ streaming_service_id: 2, streaming_type: "buy", stream_url: APPLE },
			{ streaming_service_id: 2, streaming_type: "rent", stream_url: APPLE },
			{ streaming_service_id: 73, streaming_type: "ads", stream_url: TUBI },
			{ streaming_service_id: 8, streaming_type: "flatrate", stream_url: NETFLIX },
		]),
		"US",
	) as Action[]
	assert.deepEqual(
		actions.map((a) => [a.provider.name, a.actionAccessibilityRequirement.category]),
		[
			["Netflix", "subscription"],
			["Tubi TV", "free"],
			["Apple TV", "rental"],
			["Apple TV", "purchase"],
		],
	)
	const [netflix, tubi] = actions
	assert.equal(netflix["@type"], "WatchAction")
	assert.equal(netflix.target["@type"], "EntryPoint")
	assert.equal(netflix.target.urlTemplate, NETFLIX)
	assert.deepEqual(netflix.target.actionPlatform, [
		"http://schema.org/DesktopWebPlatform",
		"http://schema.org/MobileWebPlatform",
	])
	assert.deepEqual(netflix.actionAccessibilityRequirement.eligibleRegion, {
		"@type": "Country",
		name: "US",
	})
	assert.deepEqual(netflix.expectsAcceptanceOf, {
		"@type": "Offer",
		category: "subscription",
		eligibleRegion: { "@type": "Country", name: "US" },
	})
	// A free offer has nothing to accept.
	assert.equal(tubi.expectsAcceptanceOf, undefined)
})

test("an offer without its own working https link has no WatchAction", () => {
	const actions = watchActions(
		movie([
			{ streaming_service_id: 8, streaming_type: "flatrate", stream_url: null },
			{ streaming_service_id: 2, streaming_type: "rent", stream_url: "" },
			{ streaming_service_id: 73, streaming_type: "free", stream_url: "http://tubitv.com/movies/1" },
			{ streaming_service_id: 3, streaming_type: "buy", stream_url: "javascript:alert(1)" },
			{ streaming_service_id: 3, streaming_type: "rent", stream_url: "null" },
		]),
		"US",
	)
	assert.deepEqual(actions, [])
})

test("a provider the block hides, and a second tier of the same brand, add no WatchAction", () => {
	const actions = watchActions(
		movie([
			{ streaming_service_id: 1796, streaming_type: "ads", stream_url: NETFLIX },
			{ streaming_service_id: 8, streaming_type: "flatrate", stream_url: NETFLIX },
		]),
		"US",
	) as Action[]
	assert.deepEqual(actions.map((a) => a.provider.name), ["Netflix"])
})

test("the region is the page's country", () => {
	const [action] = watchActions(
		movie([{ streaming_service_id: 8, streaming_type: "flatrate", stream_url: NETFLIX }]),
		"de",
	) as Action[]
	assert.equal(action.actionAccessibilityRequirement.eligibleRegion.name, "DE")
})

test("a title page's structured data carries its WatchActions as potentialAction", () => {
	const jsonLd = buildJsonLdDetail(
		page,
		movie([{ streaming_service_id: 8, streaming_type: "flatrate", stream_url: NETFLIX }]),
		"US",
	) as { potentialAction?: Action[] }
	assert.equal(jsonLd.potentialAction?.length, 1)
	assert.equal(jsonLd.potentialAction?.[0].target.urlTemplate, NETFLIX)
})

test("a title without a working watch link has no potentialAction, not an empty or null one", () => {
	for (const offers of [[], [{ streaming_service_id: 8, streaming_type: "flatrate", stream_url: null }]] as Offer[][]) {
		const json = JSON.stringify(buildJsonLdDetail(page, movie(offers), "US"))
		assert.doesNotMatch(json, /potentialAction|null|\[\]/)
	}
	// Without a country there is no offer to describe.
	const json = JSON.stringify(
		buildJsonLdDetail(page, movie([{ streaming_service_id: 8, streaming_type: "flatrate", stream_url: NETFLIX }])),
	)
	assert.doesNotMatch(json, /potentialAction/)
})
