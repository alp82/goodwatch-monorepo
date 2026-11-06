// The link-preview cards of the awards pages: what each shows, from the pages' own reads (domain/award-pages.ts) over
// a small set of award rows, so a page that answers 404 has no card here either.
import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const { awardsContent } = await import("./awards-content.server.ts")
const { AWARD_BODIES, bodyPage, buildAwardIndex, categoryPage, ceremonyPage } =
	await import("../../domain/award-pages.ts")
const { AWARDS_CARD_COPY } = await import("../../ui/og-image/copy.ts")

type Row = Parameters<typeof buildAwardIndex>[0][number]

let nextId = 1
// One category of a ceremony: its winner and two nominees, each a new movie.
function category(award: number, year: number, id: number, name: string) {
	return [true, false, false].map(
		(win): Row => ({
			media_type: "movie",
			media_tmdb_id: nextId++,
			award_id: award,
			category_id: id,
			category_name: name,
			ceremony_year: String(year),
			has_win: win,
			has_nomination: !win,
		}),
	)
}
// A ceremony that passes the density check: five complete categories, the first of them given.
const ceremony = (
	award: number,
	year: number,
	lead: [number, string] | null,
) => [
	...(lead ? category(award, year, lead[0], lead[1]) : []),
	...[1, 2, 3, 4, 5]
		.slice(lead ? 1 : 0)
		.flatMap((n) => category(award, year, 900 + n, `Craft ${n}`)),
]

const OSCARS = 1
const BAFTA = 11
const CESARS = 19
const rows = [
	...ceremony(OSCARS, 2026, [64, "Best Picture"]),
	...ceremony(OSCARS, 2025, [64, "Best Picture"]),
	...ceremony(OSCARS, 2024, [64, "Best Picture"]),
	// Two categories only: held, so its page answers 404.
	...category(OSCARS, 2019, 64, "Best Picture"),
	...category(OSCARS, 2019, 901, "Craft 1"),
	...ceremony(BAFTA, 2026, [256, "Best Film"]),
	...ceremony(BAFTA, 2023, null),
	...ceremony(CESARS, 2026, [586, "Meilleur Film"]),
]
// The 2025 Best Picture winner has no poster.
const POSTERLESS = rows.find(
	(r) => r.ceremony_year === "2025" && r.category_id === 64 && r.has_win,
)?.media_tmdb_id
const index = buildAwardIndex(rows)
const lookup = (ref: { media_type: "movie" | "show"; tmdb_id: number }) => ({
	tmdb_id: ref.tmdb_id,
	media_type: ref.media_type,
	title: `Title ${ref.tmdb_id}`,
	release_year: null,
	poster_path: ref.tmdb_id === POSTERLESS ? null : `/p${ref.tmdb_id}.jpg`,
	goodwatch_overall_score_normalized_percent: null,
	path: `/movie/${ref.tmdb_id}`,
})
const deps = {
	body: async (slug: string) => bodyPage(index, lookup, slug),
	ceremony: async (slug: string, year: string) =>
		ceremonyPage(index, lookup, slug, year),
	category: async (slug: string, categorySlug: string) =>
		categoryPage(index, lookup, slug, categorySlug),
} as unknown as Parameters<typeof awardsContent>[1]

const posterOf = (id: number | undefined, size = "w342") =>
	`https://image.tmdb.org/t/p/${size}/p${id}.jpg`
const winner = (award: number, year: number, id: number) =>
	rows.find(
		(r) =>
			r.award_id === award &&
			r.ceremony_year === String(year) &&
			r.category_id === id &&
			r.has_win,
	)?.media_tmdb_id

test("the hub's bodies are award bodies", () => {
	for (const slug of AWARDS_CARD_COPY.hubBodies)
		assert.ok(
			AWARD_BODIES.some((b) => b.slug === slug),
			slug,
		)
})

test("the hub: each body's latest top winner, named, and only the bodies with a page", async () => {
	const card = await awardsContent("/awards", deps)
	assert.deepEqual(card, {
		kind: "awards",
		layout: "row",
		labels: "name",
		tag: "Film and TV awards",
		headline: "Award winners",
		posters: [
			{ src: posterOf(winner(OSCARS, 2026, 64)), label: "Oscars" },
			{ src: posterOf(winner(BAFTA, 2026, 256)), label: "BAFTA" },
			{ src: posterOf(winner(CESARS, 2026, 586)), label: "César Awards" },
		],
	})
})

test("a body: the official name, the body's headline and its latest top winner's poster", async () => {
	assert.deepEqual(await awardsContent("/awards/oscars", deps), {
		kind: "title",
		tag: "Academy Awards",
		title: "Oscars winners",
		score: null,
		poster: posterOf(winner(OSCARS, 2026, 64), "w500"),
	})
	// The César Awards' official name is the page name, so the tag says what they are for.
	const cesars = await awardsContent("/awards/cesars", deps)
	assert.equal(cesars?.tag, "Film awards")
	assert.equal(await awardsContent("/awards/emmys", deps), null)
})

test("a ceremony: the body, the year and its top winner; a held or unknown year has no card", async () => {
	assert.deepEqual(await awardsContent("/awards/oscars/2024", deps), {
		kind: "awards",
		layout: "year",
		tag: "Oscars",
		year: 2024,
		poster: posterOf(winner(OSCARS, 2024, 64), "w500"),
	})
	assert.equal(await awardsContent("/awards/oscars/2019", deps), null)
	assert.equal(await awardsContent("/awards/oscars/1999", deps), null)
})

test("a category: its winners by year, newest first, leaving out a winner without a poster", async () => {
	assert.deepEqual(
		await awardsContent("/awards/oscars/category/best-picture", deps),
		{
			kind: "awards",
			layout: "row",
			labels: "year",
			tag: "Oscars",
			headline: "Best Picture",
			posters: [
				{ src: posterOf(winner(OSCARS, 2026, 64)), label: "2026" },
				{ src: posterOf(winner(OSCARS, 2024, 64)), label: "2024" },
			],
		},
	)
})

test("a category with one winner gets the poster split; one without a page has no card", async () => {
	assert.deepEqual(
		await awardsContent("/awards/bafta/category/best-film", deps),
		{
			kind: "title",
			tag: "BAFTA",
			title: "Best Film",
			score: null,
			poster: posterOf(winner(BAFTA, 2026, 256), "w500"),
		},
	)
	assert.equal(await awardsContent("/awards/bafta/category/nope", deps), null)
})
