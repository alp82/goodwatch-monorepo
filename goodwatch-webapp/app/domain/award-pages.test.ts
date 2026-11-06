import assert from "node:assert/strict"
import { test } from "node:test"
import {
	AWARD_BODIES,
	type AwardRow,
	type TitleRef,
	bodyBySlug,
	bodyPage,
	buildAwardIndex,
	categoryPage,
	categoryPasses,
	ceremonyPage,
	ceremonyTier,
	hubPage,
	publishedTitleRefs,
	refKey,
	slugify,
} from "./award-pages.ts"

const OSCARS = 1
const BEST_PICTURE = 64

let nextId = 1000
/** One category of one ceremony: a winner (or more) and nominees, each a new movie unless given. */
function category(
	award: number,
	year: number,
	id: number,
	name: string,
	{ winners = 1, nominees = 4 }: { winners?: number; nominees?: number } = {},
): AwardRow[] {
	const row = (win: boolean): AwardRow => ({
		media_type: "movie",
		media_tmdb_id: nextId++,
		award_id: award,
		category_id: id,
		category_name: name,
		ceremony_year: String(year),
		has_win: win,
		has_nomination: true,
	})
	return [
		...Array.from({ length: winners }, () => row(true)),
		...Array.from({ length: nominees }, () => row(false)),
	]
}

/** A ceremony of `count` categories (the first is Best Picture), `failing` of them with no winner. */
function ceremony(year: number, count: number, failing = 0): AwardRow[] {
	return Array.from({ length: count }, (_, i) =>
		category(
			OSCARS,
			year,
			i === 0 ? BEST_PICTURE : 100 + i,
			i === 0 ? "Best Picture" : `Craft ${i}`,
			i >= count - failing ? { winners: 0 } : {},
		),
	).flat()
}

const allTitles = (ref: TitleRef) => ({ ...ref, title: `t${ref.tmdb_id}` })

test("body slugs are unique and map back to their body", () => {
	const slugs = AWARD_BODIES.map((b) => b.slug)
	assert.equal(new Set(slugs).size, slugs.length)
	for (const body of AWARD_BODIES) assert.equal(bodyBySlug(body.slug), body)
	assert.equal(bodyBySlug("oscars")?.id, OSCARS)
	assert.equal(bodyBySlug("academy-awards"), undefined)
	assert.equal(bodyBySlug(undefined), undefined)
})

test("category slugs drop accents and punctuation and spell out ampersands", () => {
	assert.equal(slugify("Actor in a Leading Role"), "actor-in-a-leading-role")
	assert.equal(slugify("Meilleur Film Étranger"), "meilleur-film-etranger")
	assert.equal(slugify("Sound Editing & Mixing"), "sound-editing-and-mixing")
	assert.equal(slugify("  Best Film (Drama)  "), "best-film-drama")
})

test("two categories of a body with the same slug are told apart by id, and each slug maps both ways", () => {
	const index = buildAwardIndex([
		...category(OSCARS, 2024, 300, "Sound Mixing"),
		...category(OSCARS, 2024, 301, "Sound  Mixing"),
	])
	const slugs = index.categorySlugs.get(OSCARS)
	assert.equal(slugs?.get("sound-mixing"), 300)
	assert.equal(slugs?.get("sound-mixing-301"), 301)
	assert.equal(index.slugOfCategory.get(OSCARS)?.get(301), "sound-mixing-301")
})

test("a category passes with one or two winners and at least three titles", () => {
	assert.equal(categoryPasses(1, 2), true)
	assert.equal(categoryPasses(2, 1), true)
	assert.equal(categoryPasses(1, 1), false, "two titles")
	assert.equal(categoryPasses(0, 5), false, "no winner")
	assert.equal(categoryPasses(3, 2), false, "three winners")
})

test("a ceremony's tier follows its passing share and the body's reference count", () => {
	assert.equal(ceremonyTier(10, 8, 10), "full")
	assert.equal(ceremonyTier(10, 7, 10), "held", "below 80%, under 8 passing")
	assert.equal(ceremonyTier(4, 4, 4), "held", "under 5 categories")
	assert.equal(ceremonyTier(5, 5, 20), "held", "a fraction of the reference")
	assert.equal(ceremonyTier(20, 12, 20), "partial", "12 passing of 20")
	assert.equal(ceremonyTier(20, 9, 20), "held", "under half of the reference")
})

test("the reference is the biggest ceremony within three years", () => {
	const index = buildAwardIndex([
		...ceremony(2020, 20),
		...ceremony(2024, 6),
		...ceremony(2010, 6),
	])
	const of = (year: number) => index.ceremonies.get(`${OSCARS}:${year}`)
	assert.equal(of(2024)?.reference, 6, "2020 is four years away")
	assert.equal(of(2024)?.tier, "full")
	assert.equal(of(2020)?.tier, "full")
	assert.equal(of(2010)?.tier, "full")
	const near = buildAwardIndex([...ceremony(2022, 20), ...ceremony(2024, 6)])
	assert.equal(near.ceremonies.get(`${OSCARS}:2024`)?.tier, "held")
})

test("a ceremony page groups each category's winner first, then its nominees, leading with the headline", () => {
	const rows = [
		...category(OSCARS, 2024, 120, "Actress in a Leading Role"),
		...category(OSCARS, 2024, 110, "Directing"),
		...ceremony(2024, 5),
	]
	// The view's rows come in any order.
	rows.reverse()
	const index = buildAwardIndex(rows)
	const page = ceremonyPage(index, allTitles, "oscars", "2024")
	assert.ok(page)
	assert.equal(page.categories[0].name, "Best Picture")
	const directing = page.categories.find((c) => c.name === "Directing")
	assert.ok(directing)
	assert.equal(directing.slug, "directing")
	assert.equal(directing.winners.length, 1)
	assert.equal(directing.nominees.length, 4)
	const rowsOf = rows.filter((r) => r.category_id === 110)
	assert.deepEqual(
		directing.winners.map((t) => t.tmdb_id),
		rowsOf.filter((r) => r.has_win).map((r) => r.media_tmdb_id),
	)
	assert.ok(
		page.categories.findIndex((c) => c.name === "Directing") <
			page.categories.findIndex((c) => c.name.startsWith("Actress")),
		"directing before acting",
	)
})

test("a ceremony page leaves out failing categories and categories whose winner the catalog lacks", () => {
	const rows = ceremony(2024, 10, 1)
	const index = buildAwardIndex(rows)
	const missing = rows.find((r) => r.category_id === 101 && r.has_win)
	const titles = (ref: TitleRef) =>
		ref.tmdb_id === missing?.media_tmdb_id ? undefined : allTitles(ref)
	const page = ceremonyPage(index, titles, "oscars", "2024")
	assert.ok(page)
	assert.equal(page.categories.length, 8)
	assert.ok(!page.categories.some((c) => c.id === 101))
	assert.ok(!page.categories.some((c) => c.id === 109), "no winner")
})

test("unknown bodies, years, held ceremonies and categories without a published year are not found", () => {
	const index = buildAwardIndex([
		...ceremony(2024, 10),
		...ceremony(2023, 3),
		...category(OSCARS, 2023, 500, "Only Held"),
	])
	assert.ok(ceremonyPage(index, allTitles, "oscars", "2024"))
	assert.equal(ceremonyPage(index, allTitles, "oscars", "2023"), null, "held")
	assert.equal(ceremonyPage(index, allTitles, "oscars", "1999"), null)
	assert.equal(ceremonyPage(index, allTitles, "oscars", "24"), null)
	assert.equal(ceremonyPage(index, allTitles, "nope", "2024"), null)
	assert.equal(bodyPage(index, allTitles, "emmys"), null, "nothing published")
	assert.equal(categoryPage(index, allTitles, "oscars", "only-held"), null)
	assert.equal(categoryPage(index, allTitles, "oscars", "nope"), null)
	assert.ok(categoryPage(index, allTitles, "oscars", "best-picture"))
})

test("a category page lists its published years newest first; prev and next skip held years", () => {
	const index = buildAwardIndex([
		...ceremony(2024, 10),
		...ceremony(2023, 3),
		...ceremony(2022, 10),
	])
	const page = categoryPage(index, allTitles, "oscars", "best-picture")
	assert.deepEqual(
		page?.years.map((y) => y.year),
		[2024, 2022],
	)
	const ceremony2022 = ceremonyPage(index, allTitles, "oscars", "2022")
	assert.equal(ceremony2022?.next, 2024)
	assert.equal(ceremony2022?.prev, null)
})

test("the body page links categories with three published years; the hub shows recent ceremonies only", () => {
	const index = buildAwardIndex([
		...ceremony(2025, 10),
		...ceremony(2024, 10),
		...ceremony(2023, 10),
		...category(OSCARS, 2025, 700, "New Category"),
	])
	const body = bodyPage(index, allTitles, "oscars")
	assert.ok(body)
	assert.deepEqual(body.years, [2025, 2024, 2023])
	assert.equal(body.latest.year, 2025)
	assert.equal(body.latest.results.length, 8)
	assert.ok(body.categories.some((c) => c.slug === "best-picture"))
	assert.ok(!body.categories.some((c) => c.slug === "new-category"))

	const hub = hubPage(index, allTitles, 2026)
	assert.deepEqual(
		hub.bodies.map((b) => b.body.slug),
		["oscars"],
	)
	assert.equal(hub.recent[0].year, 2025)
	assert.equal(hub.recent[0].winners.length, 4)
	assert.equal(hubPage(index, allTitles, 2027).recent.length, 0, "stale")
})

test("only titles of published pages are read", () => {
	const shown = ceremony(2024, 10)
	const held = ceremony(2023, 3)
	const refs = new Set(
		publishedTitleRefs(buildAwardIndex([...shown, ...held])).map(refKey),
	)
	assert.equal(refs.size, shown.length)
	for (const r of held) assert.ok(!refs.has(`movie:${r.media_tmdb_id}`))
})
