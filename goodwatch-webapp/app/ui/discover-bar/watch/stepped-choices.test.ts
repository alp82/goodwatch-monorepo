import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const {
	STEPPED,
	factNote,
	presetCount,
	rangeSpan,
	spanCount,
	spanRange,
	togglePreset,
} = await import("./stepped-choices")

test("every preset reads as a span that writes the preset back", () => {
	for (const scale of Object.values(STEPPED))
		for (const preset of scale.presets) {
			const span = rangeSpan(scale.field, preset.range)
			assert.ok(span[1] > span[0], `${scale.field} ${preset.key}`)
			assert.deepEqual(
				spanRange(scale.field, span),
				preset.range,
				`${scale.field} ${preset.key}`,
			)
		}
})

test("preset spans sit on the expected stops", () => {
	assert.deepEqual(rangeSpan("votes", { max: 9999 }), [0, 3])
	assert.deepEqual(rangeSpan("popularityRank", { max: 1000 }), [0, 4])
	assert.deepEqual(
		rangeSpan("popularityRank", { min: 1001, max: 10000 }),
		[4, 7],
	)
	assert.deepEqual(rangeSpan("budget", { max: 4.999 }), [0, 2])
	assert.deepEqual(rangeSpan("seasons", { min: 1, max: 1 }), [0, 1])
	assert.deepEqual(rangeSpan("seasons", { min: 8 }), [7, 9])
	assert.deepEqual(rangeSpan("hours", { max: 599 / 60 }), [0, 2])
	assert.deepEqual(rangeSpan("hours", undefined), [0, 7])
})

test("other spans write their stops, the upper one just left out", () => {
	assert.equal(spanRange("votes", [0, 10]), undefined)
	assert.deepEqual(spanRange("votes", [1, 4]), { min: 2000, max: 19999 })
	assert.deepEqual(spanRange("budget", [3, 4]), { min: 10, max: 24.999 })
	assert.deepEqual(spanRange("seasons", [1, 2]), { min: 2, max: 2 })
	assert.deepEqual(spanRange("popularityRank", [2, 9]), { min: 250 })
	assert.deepEqual(spanRange("hours", [0, 1]), { max: 5 - 1 / 60 })
})

test("popularity counts subtract minimum counts; presets read their own key", () => {
	const counts = {
		"votes:any": 100,
		"votes:1000": 100,
		"votes:10000": 40,
		"votes:100000": 10,
		"votes:hiddenGems": 60,
	}
	assert.equal(spanCount("votes", counts, [0, 10]), 100)
	assert.equal(spanCount("votes", counts, [0, 3]), 60)
	assert.equal(spanCount("votes", counts, [3, 6]), 30)
	assert.equal(spanCount("votes", counts, [6, 10]), 10)
	assert.equal(presetCount("votes", counts, STEPPED.votes.presets[0]), 60)
	assert.equal(spanCount("votes", null, [0, 3]), null)
})

test("bucket counts sum the buckets in the span, the last one open", () => {
	const counts = Object.fromEntries(
		Array.from({ length: 10 }, (_, i) => [`seasons:${i}`, i + 1]),
	)
	assert.equal(spanCount("seasons", counts, [0, 1]), 1)
	assert.equal(spanCount("seasons", counts, [1, 3]), 2 + 3)
	assert.equal(spanCount("seasons", counts, [7, 9]), 8 + 9 + 10)
	assert.equal(spanCount("seasons", counts, [0, 9]), 55)
})

test("spans read as one label", () => {
	assert.equal(STEPPED.votes.spanLabel([0, 3]), "Under 10K")
	assert.equal(STEPPED.popularityRank.spanLabel([4, 7]), "#1K to #10K")
	assert.equal(STEPPED.popularityRank.spanLabel([7, 9]), "Past #10K")
	assert.equal(STEPPED.seasons.spanLabel([0, 1]), "1 season")
	assert.equal(STEPPED.seasons.spanLabel([1, 3]), "2 to 3 seasons")
	assert.equal(STEPPED.hours.spanLabel([6, 7]), "100 h+")
	assert.equal(STEPPED.hours.stopLabel(7), "200 h+")
	assert.equal(STEPPED.budget.spanLabel([2, 5]), "$5M to $50M")
})

test("a preset tile toggles its range", () => {
	const range = STEPPED.budget.presets[3].range
	const on = togglePreset(
		{ type: "all" } as Parameters<typeof togglePreset>[0],
		"budget",
		range,
	)
	assert.deepEqual(on.budget, range)
	assert.equal(togglePreset(on, "budget", range).budget, undefined)
})

test("Budget's heading says how many movies have the fact", () => {
	const budget = { "known:budget": 1500, "known:boxOffice": 1 }
	assert.equal(
		factNote("budget", budget, 5000, false),
		"1,500 of 5,000 movies here have a budget",
	)
	assert.equal(
		factNote("boxOffice", budget, null, false),
		"1 movie here has a box office",
	)
	assert.equal(
		factNote("budget", budget, 5000, true),
		"1,500 movies here have a budget",
	)
	assert.equal(factNote("budget", null, 5000, false), null)
})
