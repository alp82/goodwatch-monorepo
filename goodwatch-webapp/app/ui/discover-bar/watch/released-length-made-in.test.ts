import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const {
	PANEL_PRESET_IDS,
	releasedPanelQuery,
	decadeCounts,
	decadeSpan,
	dragDecadesPatch,
	tapDecadePatch,
	togglePresetPatch,
	yearSpan,
	yearsCount,
	yearsPatch,
} = await import("./released-choices")
const { kindRange, lengthCount, lengthPatch, spanRange, toggleLengthPatch } =
	await import("./length-choices")
const {
	anyCountry,
	popularCountries,
	setOn,
	setPicked,
	toggleCountryPatch,
	toggleSetPatch,
} = await import("./made-in-choices")
const { newYearPresets } = await import("~/domain/title-scales")

const NOW = 2026
const any = { released: "any" as const, years: undefined }
const state = (patch: ReturnType<typeof yearsPatch>) => ({ ...any, ...patch })

test("a span that equals a Released preset writes the preset", () => {
	assert.deepEqual(yearsPatch([2024, NOW], NOW), {
		released: "recent",
		years: undefined,
	})
	assert.deepEqual(yearsPatch([2010, 2019], NOW), {
		released: "2010s",
		years: undefined,
	})
	assert.deepEqual(yearsPatch([1990, 1999], NOW), {
		released: "any",
		years: { min: 1990, max: 1999 },
	})
	assert.deepEqual(yearsPatch([1920, NOW], NOW), any)
	assert.deepEqual(yearSpan({ released: "recent" }, NOW), [2024, NOW])
	assert.deepEqual(yearSpan({ released: "any", years: { min: 1990 } }, NOW), [
		1990,
		NOW,
	])
})

test("a preset tile toggles", () => {
	const lastTwo = newYearPresets(NOW)[1].years
	const on = state(togglePresetPatch(any, lastTwo, NOW))
	assert.deepEqual(on, { released: "recent", years: undefined })
	assert.deepEqual(togglePresetPatch(on, lastTwo, NOW), any)
})

test("decade taps pick, widen, narrow and clear", () => {
	const nineties = state(tapDecadePatch(any, 1990, NOW))
	assert.deepEqual(nineties.years, { min: 1990, max: 1999 })
	const wide = state(tapDecadePatch(nineties, 2000, NOW))
	assert.deepEqual(wide.years, { min: 1990, max: 2009 })
	assert.deepEqual(decadeSpan(yearSpan(wide, NOW), NOW), [1990, 2000])
	const back = state(tapDecadePatch(wide, 1990, NOW))
	assert.equal(back.released, "2000s")
	assert.deepEqual(tapDecadePatch(nineties, 1990, NOW), any)
	// A far decade starts over.
	assert.deepEqual(state(tapDecadePatch(nineties, 1950, NOW)).years, {
		min: 1950,
		max: 1959,
	})
	// The current decade runs to now, with no upper end.
	assert.deepEqual(state(tapDecadePatch(any, 2020, NOW)).years, { min: 2020 })
	// A span that isn't whole decades starts over.
	assert.equal(
		state(tapDecadePatch(state(yearsPatch([1995, 2003], NOW)), 2000, NOW))
			.released,
		"2000s",
	)
})

test("a drag picks the span of decades", () => {
	assert.deepEqual(dragDecadesPatch(any, 1980, 1960, NOW).years, {
		min: 1960,
		max: 1989,
	})
	assert.deepEqual(dragDecadesPatch(any, 1980, 1980, NOW).years, {
		min: 1980,
		max: 1989,
	})
})

test("year counts sum per year, the first decade with the years before it", () => {
	const years = { "1910": 2, "1925": 3, "1999": 5, "2000": 7, "2026": 1 }
	assert.equal(yearsCount(years, { min: 1990, max: 1999 }), 5)
	assert.equal(yearsCount(years, { min: 2000 }), 8)
	assert.equal(yearsCount(years, {}), 18)
	assert.equal(yearsCount(null, {}), null)
	const decades = decadeCounts(years, NOW)
	assert.equal(decades[0].start, 1920)
	assert.equal(decades[0].count, 5)
	assert.equal(decades.at(-1)?.start, 2020)
	assert.equal(decades.at(-1)?.count, 1)
})

test("movie and episode lengths are independent", () => {
	const movie = lengthPatch({}, "movie", { max: 90 })
	assert.deepEqual(movie, { runtime: { max: 90 }, episodeRuntime: null })
	assert.equal(kindRange(movie, "episode"), undefined)
	const both = lengthPatch(movie, "episode", { max: 35 })
	assert.deepEqual(both, { runtime: { max: 90 }, episodeRuntime: { max: 35 } })
	const episodesOnly = lengthPatch(both, "movie", undefined)
	assert.deepEqual(episodesOnly, {
		runtime: undefined,
		episodeRuntime: { max: 35 },
	})
	assert.deepEqual(lengthPatch(episodesOnly, "episode", undefined), {
		runtime: undefined,
		episodeRuntime: undefined,
	})
	// An old link's runtime holds for both until one kind changes.
	const old = { runtime: { max: 90 } }
	assert.deepEqual(kindRange(old, "episode"), { max: 90 })
	assert.deepEqual(lengthPatch(old, "movie", { min: 120 }), {
		runtime: { min: 120 },
		episodeRuntime: { max: 90 },
	})
	assert.deepEqual(toggleLengthPatch(both, "episode", { max: 35 }), {
		runtime: { max: 90 },
		episodeRuntime: null,
	})
	assert.equal(spanRange([0, 240]), undefined)
	assert.deepEqual(spanRange([30, 240]), { min: 30 })
})

test("length counts sum five-minute buckets", () => {
	const runtime = {
		"movie:85": 1,
		"movie:90": 2,
		"movie:120": 4,
		"movie:240": 8,
		"movie:unknown": 16,
		"episode:20": 32,
	}
	assert.equal(lengthCount(runtime, "movie", { max: 90 }), 3)
	assert.equal(lengthCount(runtime, "movie", { min: 120 }), 12)
	assert.equal(lengthCount(runtime, "movie", undefined), 31)
	assert.equal(lengthCount(runtime, "episode", { max: 25 }), 32)
	assert.equal(lengthCount(undefined, "movie", undefined), null)
})

test("countries and sets", () => {
	assert.equal(anyCountry({}), true)
	assert.equal(anyCountry({ restOfWorld: true }), false)
	const nordic = ["SE", "DK", "NO", "FI", "IS"]
	const some = { productionCountries: ["SE", "US"] }
	assert.equal(setOn(some, nordic), false)
	assert.equal(setPicked(some, nordic), 1)
	const all = { ...toggleSetPatch(some, nordic) }
	assert.deepEqual(all.productionCountries, [
		"SE",
		"US",
		"DK",
		"NO",
		"FI",
		"IS",
	])
	assert.equal(setOn(all, nordic), true)
	assert.deepEqual(toggleSetPatch(all, nordic).productionCountries, ["US"])
	assert.deepEqual(toggleCountryPatch({ productionCountries: ["US"] }, "US"), {
		productionCountries: undefined,
	})
	assert.deepEqual(
		popularCountries({ productionCountries: ["NG"] }).codes[0],
		"NG",
	)
	const many = { productionCountries: "AR BE CL CO CU EG FI GR HU".split(" ") }
	assert.equal(popularCountries(many).more, 9)
})

test("New tiles start at now minus N and recent links select Last 2 years", async () => {
	const presets = newYearPresets(NOW)
	assert.deepEqual(
		presets.map(({ label, years }) => [label, years]),
		[
			["This year", { min: 2026 }],
			["Last 2 years", { min: 2024 }],
			["Last 3 years", { min: 2023 }],
			["Last 5 years", { min: 2021 }],
		],
	)
	const { filterStateFromParams } = await import("~/domain/filter-state")
	const linked = filterStateFromParams(new URLSearchParams("released=recent"), {
		onMyServices: false,
		notSeenYet: false,
	})
	assert.equal(linked.released, "recent")
	assert.deepEqual(yearSpan(linked, NOW), [2024, NOW])
	assert.deepEqual(togglePresetPatch(linked, presets[1].years, NOW), any)
	assert.equal(PANEL_PRESET_IDS[presets[1].key], "recent")
	assert.equal(PANEL_PRESET_IDS[presets[2].key], "last3Years")
})

test("released pictures retain ranked search context and strip only years and pagination", () => {
	const params = new URLSearchParams(
		releasedPanelQuery(
			"q=space&ranked=42,7&sort=relevance&genres=Drama&years=1990-1999&released=recent&minYear=1990&maxYear=1999&page=3",
		),
	)
	assert.deepEqual(Object.fromEntries(params), {
		q: "space",
		ranked: "42,7",
		sort: "relevance",
		genres: "Drama",
		part: "released",
	})
	assert.equal(
		new URLSearchParams(releasedPanelQuery("q=none&ranked=")).get("ranked"),
		"",
	)
})
