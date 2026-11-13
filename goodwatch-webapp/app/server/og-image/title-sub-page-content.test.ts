// The link-preview cards of a title's sub-pages: what each shows from the title's details and tropes, and that a
// sub-page without its data (no fingerprint, no tropes, no title) has no card.
import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const {
	fingerprintCardContent,
	glanceCardContent,
	titleSubPageContent,
	tropesCardContent,
} = await import("./title-sub-page-content.server.ts")

type Media = Parameters<typeof glanceCardContent>[0]
type Tropes = Parameters<typeof tropesCardContent>[1]

const movie = (details: Record<string, unknown> = {}, fingerprint?: unknown) =>
	({
		mediaType: "movie",
		details: {
			title: "Dune",
			release_year: 2021,
			release_date: "2021-09-15",
			runtime: 155,
			poster_path: "/p.jpg",
			genres: ["Science Fiction", "Adventure"],
			original_language_code: "en",
			spoken_language_codes: ["en"],
			production_country_codes: ["US"],
			age_certifications: ["DE_12", "US_PG-13"],
			revenue: 410_668_500,
			...details,
		},
		fingerprint,
	}) as unknown as Media

const show = (details: Record<string, unknown> = {}) =>
	({
		mediaType: "show",
		details: {
			title: "Severance",
			release_year: 2022,
			first_air_date: "2022-02-17",
			number_of_seasons: 3,
			number_of_episodes: 19,
			poster_path: "/s.jpg",
			genres: ["Drama"],
			original_language_code: "en",
			production_country_codes: ["US"],
			age_certifications: ["US_TV-MA"],
			...details,
		},
	}) as unknown as Media

const FINGERPRINT = {
	scores: {
		wonder: 9,
		world_immersion: 10,
		spectacle: 9,
		cinematography: 10,
		futuristic: 9,
		tension: 8,
		adrenaline: 6,
		warfare: 8,
	},
	pillars: {},
	socialSuitability: [],
	viewingContext: [],
	essenceTags: [],
	highlightKeys: [],
}

test("the fingerprint card names the strongest feelings, at most four, under the tag and title", () => {
	const card = fingerprintCardContent(movie({}, FINGERPRINT))
	assert.ok(card)
	assert.equal(card.tag, "Fingerprint · Movie · 2021")
	assert.equal(card.title, "Dune")
	assert.match(card.poster ?? "", /\/w500\/p\.jpg$/)
	assert.ok(card.lines.length > 0 && card.lines.length <= 4)
	for (const line of card.lines) {
		assert.ok(line.text)
		assert.ok(line.size >= 0 && line.size <= 1)
	}
})

test("a title without a fingerprint has no fingerprint card", () => {
	assert.equal(fingerprintCardContent(movie()), null)
})

const trope = (id: string, titles: number | null, name = id) => ({
	id,
	name,
	url: "",
	meaning: null,
	length: 100,
	titles,
	lead: false,
})

test("the tropes card leads with the signature tropes, then the rarest short names, up to ten", () => {
	const all: Tropes = {
		total: 245,
		signature: ["sig-b", "sig-a", "gone"],
		tropes: [
			trope("common", 900),
			trope("sig-a", 50),
			trope("rare", 3),
			trope("unknown", null),
			trope("sig-b", 400),
			trope("long", 1, "A Trope Name Far Too Long For The Cloud"),
			...Array.from({ length: 10 }, (_, i) => trope(`t${i}`, 100 + i)),
		],
	}
	const card = tropesCardContent(movie(), all)
	assert.ok(card)
	assert.equal(card.total, 245)
	assert.deepEqual(card.tropes, [
		"sig-b",
		"sig-a",
		"rare",
		"t0",
		"t1",
		"t2",
		"t3",
		"t4",
		"t5",
		"t6",
	])
})

test("a title without tropes has no tropes card", () => {
	assert.equal(
		tropesCardContent(movie(), { total: 0, signature: [], tropes: [] }),
		null,
	)
})

test("a movie's facts: released, runtime, the US rating, made in, language, box office", () => {
	assert.deepEqual(glanceCardContent(movie()).tiles, [
		{ label: "Released", value: "2021" },
		{ label: "Runtime", value: "2 h 35 min" },
		{ label: "Rated", value: "PG-13" },
		{ label: "Made in", value: "United States" },
		{ label: "Language", value: "English" },
		{ label: "Box office", value: "$411 M" },
	])
})

test("a show's facts: first aired, seasons, episodes; a missing fact gives its place to the next", () => {
	assert.deepEqual(
		glanceCardContent(show({ age_certifications: [] })).tiles.map(
			(t) => t.label,
		),
		["First aired", "Seasons", "Episodes", "Made in", "Language", "Genres"],
	)
})

test("an unknown title has no sub-page card; the tropes are read only for the tropes card", async () => {
	let tropeReads = 0
	const deps = (media: Media | null) => ({
		details: async () => media,
		tropes: async () => {
			tropeReads++
			return { total: 1, signature: [], tropes: [trope("x", 1)] }
		},
	})
	assert.equal(
		await titleSubPageContent("movie", 1, "at-a-glance", deps(null)),
		null,
	)
	const glance = await titleSubPageContent(
		"movie",
		1,
		"at-a-glance",
		deps(movie()),
	)
	assert.equal(glance?.kind, "title-glance")
	assert.equal(tropeReads, 0)
	const tropes = await titleSubPageContent("movie", 1, "tropes", deps(movie()))
	assert.equal(tropes?.kind, "title-tropes")
	assert.equal(tropeReads, 1)
})
