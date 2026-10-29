import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const {
	pickServicePatch,
	quickCountries,
	ratingCountryPatch,
	searchCountries,
	servicesMode,
	servicesModePatch,
	servicesOn,
	servicesOrder,
	sourceScorePatch,
	spacedAges,
	stepLit,
	wallTiles,
} = await import("./watch-choices")

const everywhere = { onMyServices: false }

test("services mode follows the state", () => {
	assert.equal(servicesMode(everywhere), "any")
	assert.equal(servicesMode({ onMyServices: true }), "mine")
	assert.equal(servicesMode({ onMyServices: false, anyService: true }), "pick")
	assert.equal(servicesMode({ onMyServices: false, services: [8] }), "pick")
	assert.equal(servicesMode({ onMyServices: false, services: [] }), "any")
	for (const mode of ["mine", "any", "pick"] as const)
		assert.equal(servicesMode(servicesModePatch(mode)), mode)
	assert.equal(servicesModePatch("pick").anyService, true)
})

test("the first tap means just this one, later taps add and remove", () => {
	const fromAny = pickServicePatch(everywhere, 8)
	assert.deepEqual(fromAny, {
		onMyServices: false,
		anyService: undefined,
		services: [8],
	})
	assert.deepEqual(pickServicePatch({ onMyServices: true }, 9).services, [9])
	assert.deepEqual(
		pickServicePatch({ onMyServices: false, anyService: true }, 9).services,
		[9],
	)
	assert.deepEqual(
		pickServicePatch({ onMyServices: false, services: [8] }, 9).services,
		[8, 9],
	)
	assert.deepEqual(
		pickServicePatch({ onMyServices: false, services: [8, 9] }, 8).services,
		[9],
	)
})

test("taking the last service off goes back to Any service", () => {
	assert.deepEqual(
		pickServicePatch({ onMyServices: false, services: [8] }, 8),
		{
			onMyServices: false,
			anyService: true,
			services: undefined,
		},
	)
})

test("the services that are on", () => {
	assert.deepEqual(servicesOn({ onMyServices: true }, [8, 9]), [8, 9])
	assert.deepEqual(
		servicesOn({ onMyServices: false, services: [337] }, [8]),
		[337],
	)
	assert.deepEqual(
		servicesOn({ onMyServices: false, anyService: true }, [8]),
		[],
	)
	assert.deepEqual(servicesOn(everywhere, [8]), [])
})

test("services keep the country's order, the ones on first, then the viewer's", () => {
	const providers = [1, 2, 3, 4, 5].map((id) => ({ id }))
	assert.deepEqual(
		servicesOrder(providers, [4], [2, 5]).map((p) => p.id),
		[4, 2, 5, 1, 3],
	)
})

test("the wall shows its limit, more while more are on, up to the cap when open", () => {
	const all = Array.from({ length: 200 }, (_, i) => i)
	const closed = wallTiles(all, {
		limit: 18,
		on: 2,
		open: false,
		searching: false,
	})
	assert.equal(closed.shown.length, 18)
	assert.equal(closed.rest, 182)
	assert.equal(
		wallTiles(all, { limit: 18, on: 25, open: false, searching: false }).shown
			.length,
		25,
	)
	const open = wallTiles(all, {
		limit: 18,
		on: 0,
		open: true,
		searching: false,
	})
	assert.equal(open.shown.length, 120)
	assert.equal(open.rest, 80)
	assert.equal(
		wallTiles(all.slice(0, 30), {
			limit: 9,
			on: 0,
			open: false,
			searching: true,
		}).shown.length,
		30,
	)
})

test("a source minimum keeps the others, 0 takes it off", () => {
	assert.deepEqual(sourceScorePatch({}, "imdb", 70), {
		sourceScores: { imdb: 70 },
	})
	assert.deepEqual(
		sourceScorePatch({ sourceScores: { imdb: 70 } }, "metacriticUsers", 80),
		{ sourceScores: { imdb: 70, metacriticUsers: 80 } },
	)
	assert.deepEqual(
		sourceScorePatch({ sourceScores: { imdb: 70 } }, "imdb", 0),
		{
			sourceScores: undefined,
		},
	)
})

test("the pick and every step above it are lit", () => {
	assert.equal(stepLit(80, 70), true)
	assert.equal(stepLit(70, 70), true)
	assert.equal(stepLit(60, 70), false)
	assert.equal(stepLit(90, 0), false)
})

test("quick rating countries keep their length", () => {
	assert.deepEqual(quickCountries("DE", 6), [
		"US",
		"GB",
		"DE",
		"FR",
		"IN",
		"JP",
	])
	assert.deepEqual(quickCountries("KR", 4), ["KR", "US", "GB", "DE"])
	assert.deepEqual(quickCountries("JP", 4), ["JP", "US", "GB", "DE"])
	assert.deepEqual(quickCountries("FR", 4), ["US", "GB", "DE", "FR"])
	assert.deepEqual(quickCountries("IN", 6), [
		"US",
		"GB",
		"DE",
		"FR",
		"IN",
		"JP",
	])
})

test("the default rating country writes no ratingCountry", () => {
	assert.deepEqual(ratingCountryPatch({}, "DE", "DE"), {
		ratingCountry: undefined,
	})
	assert.deepEqual(ratingCountryPatch({ streamingCountry: "GB" }, "DE", "DE"), {
		ratingCountry: "DE",
	})
	assert.deepEqual(ratingCountryPatch({ streamingCountry: "GB" }, "GB", "DE"), {
		ratingCountry: undefined,
	})
	assert.deepEqual(ratingCountryPatch({}, "FR", undefined), {
		ratingCountry: "FR",
	})
})

test("countries match by name or by code", () => {
	const list = [
		{ code: "DE", name: "Germany" },
		{ code: "GB", name: "United Kingdom" },
		{ code: "US", name: "United States" },
	]
	assert.deepEqual(
		searchCountries(list, "united").map((c) => c.code),
		["GB", "US"],
	)
	assert.deepEqual(
		searchCountries(list, " de ").map((c) => c.code),
		["DE"],
	)
	assert.equal(searchCountries(list, "").length, 3)
})

test("slider labels leave out steps that would touch", () => {
	assert.deepEqual([...spacedAges([0, 7, 12, 13, 16, 18], 4)], [0, 7, 12, 16])
	assert.deepEqual([...spacedAges([0, 12, 15, 18], 4)], [0, 12, 18])
	assert.deepEqual([...spacedAges([0, 6, 12, 16, 18], 2)], [0, 6, 12, 16, 18])
})
