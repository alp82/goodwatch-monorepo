import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { browseRedirect, finalAddress, legacyGenreFallback, OLD_MOODS, RENAMED_GENRES } =
	await import("./redirects.ts")
const { parse, browsePath, canonicalPath } = await import("./address.ts")

// The slugs the new tree has, as the title snapshot gives them (16 moods, TMDB genres slugged, decades, a few
// countries and tropes).
const MOODS = [
	"coming-of-age",
	"cozy",
	"crime-mystery",
	"dark",
	"deep",
	"funny",
	"history",
	"magical",
	"other-worlds",
	"quirky",
	"romantic",
	"sad",
	"scary",
	"tense",
	"thrilling",
	"trippy",
]
const GENRES = [
	"action",
	"adventure",
	"animation",
	"comedy",
	"crime",
	"documentary",
	"drama",
	"family",
	"fantasy",
	"history",
	"horror",
	"music",
	"mystery",
	"romance",
	"science-fiction",
	"thriller",
	"tv-movie",
	"war",
	"western",
	"action-adventure",
	"kids",
	"news",
	"reality",
	"sci-fi-fantasy",
	"soap",
	"talk",
	"war-politics",
]
const DECADES = ["1930s", "1990s", "2010s", "2020s"]
const COUNTRIES = ["japan", "south-korea", "united-states", "turkiye"]
const TROPES = ["final-girl", "chekhovs-gun", "butt-monkey", "jump-scare", "body-horror"]
const SERVICES = ["netflix", "amazon-prime", "disney-plus", "hbo-max"]
const index = {
	has: (family: string, slug: string) =>
		(
			{
				mood: MOODS,
				genre: GENRES,
				decade: DECADES,
				country: COUNTRIES,
				trope: TROPES,
				service: SERVICES,
				theme: ["crime"],
				style: [],
				trait: [],
			} as Record<string, string[]>
		)[family]?.includes(slug) ?? false,
}
const resolves = (url: string) => {
	const [path, q = ""] = url.split("?")
	return parse(path, new URLSearchParams(q), index) !== null
}

test("Best moved to Top, with its page", () => {
	assert.equal(browseRedirect("/movies/best"), "/movies/top")
	assert.equal(browseRedirect("/shows/best", "?page=3"), "/shows/top?page=3")
	assert.equal(browseRedirect("/all/best", "page=2"), "/all/top?page=2")
	assert.equal(browseRedirect("/movies/top"), null)
	assert.equal(browseRedirect("/movies/best/2"), null)
})

test("every old mood moves to its new mood; the three that kept their slug stay", () => {
	for (const [old, now] of Object.entries(OLD_MOODS)) {
		const got = browseRedirect(`/movies/moods/${old}`, "?page=2")
		if (old === now) assert.equal(got, null, old)
		else assert.equal(got, `/movies/moods/${now}`, old)
		assert.ok(MOODS.includes(now), now)
	}
	assert.equal(browseRedirect("/shows/moods/feel-good"), "/shows/moods/cozy")
	assert.equal(browseRedirect("/movies/moods/cozy"), null)
	assert.equal(browseRedirect("/movies/moods"), null)
})

test("renamed genres move; the others keep their address", () => {
	for (const [old, now] of Object.entries(RENAMED_GENRES))
		assert.equal(browseRedirect(`/shows/genres/${old}`, "?page=4"), `/shows/genres/${now}`)
	assert.equal(browseRedirect("/movies/genres/drama"), null)
	assert.equal(browseRedirect("/movies/genres"), null)
})

test("streaming: the index gets a country, a service slug is a service in that country, never a country", () => {
	assert.equal(browseRedirect("/movies/streaming"), "/movies/streaming/us")
	assert.equal(browseRedirect("/shows/streaming/netflix"), "/shows/streaming/us/netflix")
	assert.equal(
		browseRedirect("/movies/streaming/amazon-prime"),
		"/movies/streaming/us/amazon-prime",
	)
	assert.equal(browseRedirect("/movies/streaming/de"), null)
	assert.equal(browseRedirect("/movies/streaming/de/netflix"), null)
	assert.equal(browseRedirect("/movies/streaming/nowhere"), null)
	// A service slug never parses as a country.
	assert.equal(parse("/movies/streaming/netflix", new URLSearchParams(), index), null)
	assert.equal(parse("/movies/streaming/de", new URLSearchParams(), index)?.country, "de")
	assert.equal(parse("/movies/streaming/de/netflix", new URLSearchParams(), index)?.view, "place")
})

test("trait addresses: the index moves to Tropes, a trait that names a trope moves to it, others are gone", () => {
	assert.equal(browseRedirect("/movies/traits"), "/movies/tropes")
	assert.equal(browseRedirect("/movies/traits/scare"), "/movies/tropes/jump-scare")
	assert.equal(browseRedirect("/movies/traits/wit-wordplay"), null)
	assert.equal(parse("/movies/traits/scare", new URLSearchParams(), index), null)
})

test("?when= and ?from= become real parts of the blend", () => {
	assert.equal(
		browseRedirect("/movies/moods/cozy", "?when=1990s"),
		"/movies/moods/cozy?with=decade%3A1990s",
	)
	assert.equal(
		browseRedirect("/movies/genres/comedy", "?when=1990s"),
		"/movies/genres/comedy/1990s",
	)
	assert.equal(
		browseRedirect("/all/moods/cozy/comedy", "?with=trope:butt-monkey&from=south-korea"),
		"/all/moods/cozy/comedy?with=country%3Asouth-korea%2Ctrope%3Abutt-monkey",
	)
	assert.equal(
		browseRedirect("/movies/countries/japan", "?when=1990s&sort=top"),
		// The canonical order leads with the decade: a decade has no pair, so the country travels as `with`.
		"/movies/decades/1990s?with=country%3Ajapan&sort=top",
	)
	assert.equal(browseRedirect("/movies", "?when=1990s"), null)
})

test("every address in the old category sitemap answers: a redirect to a page, or its own page", () => {
	const xml = readFileSync(
		new URL("../../../public/sitemaps/sitemap_categories.xml", import.meta.url),
		"utf8",
	)
	const urls = [...xml.matchAll(/<loc>https:\/\/goodwatch\.app([^<]*)<\/loc>/g)].map((m) => m[1])
	assert.equal(urls.length, 87)
	for (const url of urls) {
		const final = finalAddress(url)
		assert.ok(resolves(final), `${url} -> ${final}`)
		if (final !== url)
			assert.equal(browseRedirect(final.split("?")[0], final.split("?")[1]), null, url)
	}
})

test("the static sitemap's Best addresses move to Top", () => {
	assert.equal(finalAddress("/movies/best"), "/movies/top")
	assert.equal(finalAddress("/shows/best"), "/shows/top")
})

test("unknown addresses answer nothing: no redirect, no page", () => {
	for (const url of [
		"/movies/nope",
		"/movies/moods/nope",
		"/movies/genres/nope",
		"/movies/moods/cozy/nope",
		"/movies/moods/cozy/comedy/extra",
		"/films",
		"/movies/top/2",
	]) {
		assert.equal(browseRedirect(url), null, url)
		assert.equal(resolves(url), false, url)
	}
})

test("an old genre page without a page of its own moves to its kind's genre index", () => {
	assert.equal(legacyGenreFallback("show", "talk"), "/shows/genres")
	assert.equal(legacyGenreFallback("show", "sci-fi-fantasy"), "/shows/genres")
	assert.equal(legacyGenreFallback("movie", "talk"), null)
	assert.equal(legacyGenreFallback("all", "drama"), null)
})

test("addresses round-trip, and the canonical drops list state but keeps Top's page", () => {
	for (const url of [
		"/movies",
		"/all",
		"/movies/moods",
		"/movies/streaming/de",
		"/movies/moods/cozy",
		"/movies/moods/cozy/comedy",
		"/movies/genres/comedy/1990s",
		"/movies/tropes/final-girl/1990s",
		"/movies/streaming/us/netflix",
		"/all/moods/cozy/comedy?with=country%3Asouth-korea%2Ctrope%3Abutt-monkey",
		"/movies/top?page=2",
	]) {
		const [path, q = ""] = url.split("?")
		const a = parse(path, new URLSearchParams(q), index)
		assert.ok(a, url)
		assert.equal(browsePath(a), url)
	}
	const a = parse("/movies/moods/cozy", new URLSearchParams("sort=top&at=40&mine=1"), index)
	assert.ok(a)
	assert.equal(canonicalPath(a), "/movies/moods/cozy")
	const t = parse("/movies/top", new URLSearchParams("page=3"), index)
	assert.ok(t)
	assert.equal(canonicalPath(t), "/movies/top?page=3")
})

test("the older /explore and /tv-shows addresses land on the final address in one step", async () => {
	const { formerExplorePath, formerTvShowsPath } = await import("../../ui/explore/address.ts")
	const explore = formerExplorePath("movies", "moods", "feel-good")
	assert.ok(explore)
	assert.equal(finalAddress(explore), "/movies/moods/cozy")
	assert.equal(
		finalAddress(formerExplorePath("tv", "moods", "suspense") ?? ""),
		"/shows/moods/crime-mystery",
	)
	const [path, q = ""] = formerTvShowsPath("/tv-shows/genres/scifi-and-fantasy", "?page=2").split(
		"?",
	)
	assert.equal(finalAddress(path, q), "/shows/genres/sci-fi-fantasy")
	const [best, bq = ""] = formerTvShowsPath("/tv-shows/best", "?page=2").split("?")
	assert.equal(finalAddress(best, bq), "/shows/top?page=2")
	assert.equal(finalAddress("/shows/streaming/netflix"), "/shows/streaming/us/netflix")
})
