import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { contentLevels, contentSummary, ratings, severity, viewingGuide } =
	await import("./content.ts")
const { boxOffice, factsLine, numbersTeaser, runtimeVsGenre, spread } =
	await import("./facts.ts")
const { glanceRowIds, glanceRowLabels } = await import("./rows.ts")

const fingerprint = (scores: Record<string, number>, guide: string[] = []) => ({
	scores,
	highlightKeys: [],
	essenceTags: [],
	socialSuitability: guide.map((name) => ({ name })),
	viewingContext: [],
	pillars: [],
})

const movie = (
	details: Record<string, unknown>,
	extra: Record<string, unknown> = {},
) =>
	({
		mediaType: "movie",
		details: { title: "Dune: Part Two", genres: [], ...details },
		cast: [],
		crew: { directors: [], writers: [] },
		fingerprint: null,
		...extra,
	}) as never

test("a content score in a word", () => {
	assert.deepEqual([0, 2.9, 3, 5, 7, 9, 10].map(severity), [
		"Little or none",
		"Little or none",
		"Mild",
		"Moderate",
		"Strong",
		"Intense",
		"Intense",
	])
})

test("the age ratings, the visitor's country first", () => {
	const media = movie({ age_certifications: ["US_PG-13", "DE_12", "FR_"] })
	assert.deepEqual(ratings(media, "DE"), [
		{ cc: "DE", cert: "12" },
		{ cc: "US", cert: "PG-13" },
	])
})

test("the closed Content line: the rating, the first advisories and a short verdict", () => {
	const media = movie({
		age_certifications: ["US_PG-13"],
		content_advisories: ["VIOLENCE", "STRONG LANGUAGE", "SMOKING"],
	})
	const kids = {
		id: "kids",
		q: "Is it okay for kids?",
		a: "Not for young kids: it's rated PG-13",
	}
	assert.deepEqual(contentSummary(media, "US", [kids as never]), {
		value: "PG-13 · Violence, strong language +1",
		verdict: "Not for young kids",
	})
	assert.equal(contentSummary(movie({}), "US", []), null)
	// A number rating reads "12+"; without a kids answer and a title analysis there is no verdict.
	assert.deepEqual(
		contentSummary(movie({ age_certifications: ["DE_12"] }), "DE", []),
		{
			value: "12+",
			verdict: null,
		},
	)
})

test("content levels from the title analysis, advisories that name them, and the rest", () => {
	const media = movie(
		{ content_advisories: ["Violence", "STRONG LANGUAGE"] },
		{
			fingerprint: fingerprint({ violence: 7, eroticism: 1 }, [
				"Teens",
				"Date Night",
			]),
		},
	)
	const { levels, unscaled } = contentLevels(media)
	assert.deepEqual(
		levels.map((l) => [l.key, l.value, l.named]),
		[
			["violence", 7, true],
			["eroticism", 1, false],
		],
	)
	assert.deepEqual(unscaled, ["Strong language"])
	assert.deepEqual(viewingGuide(media), {
		listed: ["Teens", "Date Night"],
		notFor: ["Kids", "Family Movie Night"],
	})
})

test("the Facts line, and the striking numbers in its teaser", () => {
	const dune = movie({
		release_date: "2024-02-27",
		genres: ["Science Fiction", "Adventure", "Drama"],
		original_language_code: "en",
		runtime: 167,
		budget: 190_000_000,
		revenue: 715_000_000,
		rotten_tomatoes_tomato_score_original: 92,
		rotten_tomatoes_audience_score_original: 95,
	})
	assert.equal(factsLine(dune), "2024 · Science Fiction, Adventure · English")
	assert.equal(boxOffice(dune)?.headline, "3.8×")
	assert.equal(
		runtimeVsGenre(dune)?.verdict,
		"Longer than 9 in 10 sci-fi movies",
	)
	assert.equal(spread(dune)?.short, "Critics and audiences agree")
	assert.equal(
		numbersTeaser(dune),
		"3.8× its budget · Critics and audiences agree · Long for sci-fi movies",
	)
	// Placeholder budgets say nothing.
	assert.equal(boxOffice(movie({ budget: 100, revenue: 5_000_000 })), null)
})

test("a show's Facts line spans its years", () => {
	const show = {
		mediaType: "show",
		details: {
			title: "Severance",
			genres: ["Drama"],
			first_air_date: "2022-02-17",
			in_production: true,
			original_language_code: "en",
		},
	} as never
	assert.equal(factsLine(show), "2022–now · Drama · English")
})

test("the rows a title has, in order", () => {
	const bare = movie({})
	assert.deepEqual(glanceRowIds(bare, "US", []), ["glance-facts"])
	const full = movie(
		{ age_certifications: ["US_PG-13"] },
		{
			cast: [{ id: 1, name: "Timothée Chalamet" }],
			crew: { directors: [{ id: 2, name: "Denis Villeneuve" }], writers: [] },
		},
	)
	assert.deepEqual(glanceRowLabels(full, "US", []), [
		"Facts",
		"Content",
		"Starring",
		"Made by",
	])
})

test("a title with a reported award result, a win or a nomination, has the Awards row after Facts", () => {
	const nominated = movie(
		{},
		{
			award_results: [
				{ award: "BAFTA Awards", category: "Editing", year: "2024", won: false },
			],
		},
	)
	assert.deepEqual(glanceRowIds(nominated, "US", []), [
		"glance-facts",
		"glance-awards",
	])
	assert.deepEqual(glanceRowIds(movie({}, { award_results: [] }), "US", []), [
		"glance-facts",
	])
})
