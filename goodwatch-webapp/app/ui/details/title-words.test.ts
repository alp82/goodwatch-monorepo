import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { ageRating, fitMeta, metaItems, titleFacts, tropeNames, yearsWords } =
	await import("./title-words.ts")
const { videosOf, nameOf, spokenName, countsLine } = await import(
	"./opener/videos.ts"
)

const movie = (
	details: Record<string, unknown>,
	extra: Record<string, unknown> = {},
) =>
	({
		mediaType: "movie",
		details: { title: "Dune", genres: [], ...details },
		...extra,
	}) as never
const show = (details: Record<string, unknown>) =>
	({
		mediaType: "show",
		details: { title: "Severance", genres: [], ...details },
	}) as never

test("a running show's years end in now, an ended one's in its last year, a movie has its year", () => {
	assert.equal(
		yearsWords(show({ first_air_date: "2022-02-18", in_production: true })),
		"2022 – now",
	)
	assert.equal(
		yearsWords(
			show({
				first_air_date: "2008-01-20",
				last_air_date: "2013-09-29",
				in_production: false,
			}),
		),
		"2008 – 2013",
	)
	assert.equal(yearsWords(movie({ release_year: 2024 })), "2024")
})

test("the age rating is the country's, else the US one", () => {
	const m = movie({ age_certifications: ["DE_12", "US_PG-13"] })
	assert.equal(ageRating(m, "DE"), "12")
	assert.equal(ageRating(m, "FR"), "PG-13")
	assert.equal(ageRating(movie({}), "DE"), null)
})

test("the opener's meta line names the type and length, without the age rating", () => {
	assert.deepEqual(metaItems(movie({ release_year: 2024, runtime: 166 })), [
		"2024",
		"Movie",
		"2 h 46 min",
	])
	assert.deepEqual(
		metaItems(
			show({
				first_air_date: "2022-02-18",
				in_production: true,
				number_of_seasons: 1,
				number_of_episodes: 19,
			}),
		),
		["2022 – now", "Show", "1 season", "19 episodes"],
	)
})

test("the title bar's meta line gets shorter one step at a time, the type first out, the first year last", () => {
	const options = fitMeta(
		show({
			first_air_date: "2022-02-18",
			in_production: true,
			number_of_seasons: 2,
			number_of_episodes: 19,
			age_certifications: ["DE_16"],
		}),
		"DE",
	)
	assert.equal(options[0], "2022 – now · Show · 2 seasons · 19 episodes · 16+")
	assert.equal(options[1], "2022 – now · 2 seasons · 19 episodes · 16+")
	assert.equal(options.at(-1), "2022")
	assert.equal(new Set(options).size, options.length)
	assert.ok(options.includes("2022 · 2 seasons · 19 eps · 16+"))
	assert.deepEqual(fitMeta(movie({ release_year: 2024, runtime: 45 }), "DE"), [
		"2024 · Movie · 45 min",
		"2024 · 45 min",
		"2024 · 45m",
		"2024",
	])
})

test("facts leave out what the title doesn't have", () => {
	const facts = titleFacts(
		movie({
			release_date: "2024-02-27",
			runtime: 166,
			budget: 190000000,
			genres: ["Drama"],
			original_language_code: "en",
		}),
		"DE",
	)
	assert.deepEqual(
		facts.map((f) => f.label),
		["Released", "Runtime", "Genres", "Original language", "Budget"],
	)
	assert.equal(facts[0].value, "February 27, 2024")
	assert.equal(
		facts.find((f) => f.label === "Original language")?.value,
		"English",
	)
})

test("tropes count every trope the title has, not only the ones the page has", () => {
	assert.deepEqual(
		tropeNames(movie({ tropes: ["A", { name: "B" }], tropes_count: 30 })),
		{ names: ["A", "B"], total: 30 },
	)
	assert.deepEqual(tropeNames(movie({})), { names: [], total: 0 })
})

test("videos come trailers first, with TMDB's name when there is one", () => {
	const videos = videosOf(
		movie(
			{},
			{
				videos: {
					clips: [{ key: "c1", name: "Sandworm" }],
					trailers: [{ key: "t1" }, { key: "t2", name: "Official Trailer 2" }],
					featurettes: null,
				},
			},
		),
	)
	assert.deepEqual(
		videos.map((v) => [v.key, nameOf(v)]),
		[
			["t1", "Trailer 1"],
			["t2", "Official Trailer 2"],
			["c1", "Sandworm"],
		],
	)
	assert.equal(spokenName(videos[0]), "trailer 1")
	assert.equal(spokenName(videos[2]), "“Sandworm”")
	assert.equal(countsLine(videos), "2 trailers · 1 clip")
})
