import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { feelMoods, feelsLink, genreLink, personLink, seriesLink, similarLink } =
	await import("./discover-links.ts")
const { MOOD_BY_KEY, moodsOf } = await import("../../../domain/moods.ts")
const { VALID_FINGERPRINT_KEYS } = await import(
	"../../../server/utils/fingerprint.ts"
)
const { seriesName } = await import("./shelf-data.ts")
const { titleKey } = await import("../../../utils/title-key.ts")

const params = (href: string | null) => {
	assert.ok(href)
	const url = new URL(href, "https://goodwatch.app")
	assert.equal(url.pathname, "/discover")
	return Object.fromEntries(url.searchParams)
}

const src = (over: Record<string, unknown> = {}) =>
	({
		type: "movie",
		id: 693134,
		genres: ["Science Fiction", "Adventure"],
		series: null,
		media: { details: { genres: ["Science Fiction", "Adventure"] } },
		...over,
	}) as never

test("the watch order searches for the series' own name", () => {
	const series = (name: string) =>
		src({
			series: {
				name,
				named: name !== "In this series",
				titles: [{ title: "Dune" }, { title: "Dune: Part Two" }],
			},
		})
	assert.deepEqual(params(seriesLink(series("The Dune series"))), {
		q: "Dune",
		services: "all",
	})
	// A name the films don't share: the first film's title.
	assert.deepEqual(params(seriesLink(series("In this series"))), {
		q: "Dune",
		services: "all",
	})
	assert.equal(seriesLink(src()), null)
})

test("similar, person and genre go to Discover's own filters, on every service", () => {
	assert.deepEqual(params(similarLink(src())), {
		similar: String(titleKey("movie", 693134)),
		type: "movie",
		services: "all",
	})
	assert.deepEqual(params(personLink({ id: 137427 } as never)), {
		people: "137427",
		services: "all",
	})
	assert.deepEqual(params(genreLink(src(), null)), {
		genres: "Science Fiction",
		type: "movie",
		services: "all",
	})
	assert.deepEqual(params(genreLink(src({ type: "show" }), "Adventure")), {
		genres: "Adventure",
		type: "show",
		services: "all",
	})
	assert.equal(genreLink(src({ genres: [] }), null), null)
})

test("feels the same goes to the title's moods, the Feel ones first, up to three, all at once", () => {
	assert.equal(feelsLink(src()), null)
	const scores = Object.fromEntries(VALID_FINGERPRINT_KEYS.map((k) => [k, 9]))
	const media = { details: { genres: ["Horror"] }, fingerprint: { scores } }
	const all = moodsOf(scores as never, ["Horror"])
	assert.ok(all.length > 1)
	const moods = feelMoods(src({ media }))
	assert.ok(moods.length <= 3)
	assert.deepEqual(new Set(moods).size, moods.length)
	const feel = moods.map((m) => MOOD_BY_KEY[m].feel)
	assert.deepEqual(
		feel,
		[...feel].sort((a, b) => Number(b) - Number(a)),
	)
	assert.deepEqual(params(feelsLink(src({ media }))), {
		moods: moods.join(","),
		all: "moods",
		type: "movie",
		services: "all",
	})
})

test("a series is named by what its films' names share", () => {
	assert.equal(
		seriesName(["Dune", "Dune: Part Two", "Dune: Part Three"]),
		"The Dune series",
	)
	assert.equal(
		seriesName(["Mission: Impossible", "Mission: Impossible 2"]),
		"The Mission: Impossible series",
	)
	assert.equal(
		seriesName([
			"The Lord of the Rings: The Fellowship of the Ring",
			"The Lord of the Rings: The Two Towers",
		]),
		"The Lord of the Rings series",
	)
	assert.equal(seriesName(["Alien", "Aliens"]), null)
	assert.equal(seriesName(["Up"]), null)
})
