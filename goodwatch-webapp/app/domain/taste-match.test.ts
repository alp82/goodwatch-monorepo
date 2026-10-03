import assert from "node:assert/strict"
import { test } from "node:test"
import {
	MATCH_ANCHORS,
	MATCH_CEILINGS,
	matchCeiling,
	matchOfShare,
	percentileOfStep,
	rankStep,
	shownMatch,
} from "./taste-match.ts"

test("the anchors map exactly", () => {
	assert.deepEqual(
		[1, 0.5, 0.1, 0.01, 0.001, 0.0001].map((share) => matchOfShare(share)),
		[50, 65, 80, 90, 95, 99],
	)
	for (const { share, match } of MATCH_ANCHORS)
		assert.equal(matchOfShare(share), match)
	// As percentiles, for a taste at the full ceiling.
	assert.equal(shownMatch(0, 100), 50)
	assert.equal(shownMatch(50, 100), 65)
	assert.equal(shownMatch(90, 100), 80)
	assert.equal(shownMatch(99, 100), 90)
	assert.equal(shownMatch(99.9, 100), 95)
	assert.equal(shownMatch(99.99, 100), 99)
})

test("the match is linear in log10 of the share between two anchors", () => {
	// Halfway in log10 between the top 10 percent (80) and the top 1 percent (90).
	assert.ok(Math.abs(matchOfShare(10 ** -1.5) - 85) < 1e-9)
	assert.ok(Math.abs(matchOfShare(10 ** -2.5) - 92.5) < 1e-9)
	assert.ok(Math.abs(matchOfShare(10 ** -3.5) - 97) < 1e-9)
})

test("the match stays within 50 and 99 beyond the ends", () => {
	assert.equal(matchOfShare(0), 99)
	assert.equal(matchOfShare(1e-9), 99)
	assert.equal(matchOfShare(2), 50)
	assert.equal(shownMatch(100, 1000), 99)
	assert.equal(shownMatch(99.999, 1000), 99)
	assert.equal(shownMatch(-5, 1000), 50)
	assert.equal(shownMatch(120, 1000), 99)
})

test("the match never falls as the percentile rises, at any liked count", () => {
	for (const liked of [5, 12, 20, 50, 100, 400]) {
		let before = 0
		for (let i = 0; i <= 100_000; i++) {
			const match = shownMatch(i / 1000, liked)
			assert.ok(match >= before, `${i / 1000} with ${liked} liked`)
			assert.ok(match >= 50 && match <= 99)
			before = match
		}
	}
})

test("the match never falls as the liked count rises", () => {
	for (const percentile of [0, 30, 60, 90, 99, 99.9, 99.99, 100]) {
		let before = 0
		for (let liked = 0; liked <= 150; liked++) {
			const match = shownMatch(percentile, liked)
			assert.ok(match >= before, `${percentile} with ${liked} liked`)
			before = match
		}
	}
})

test("the ceiling grows with the liked titles", () => {
	assert.deepEqual(
		[5, 20, 50, 100].map((liked) => matchCeiling(liked)),
		[85, 92, 96, 99],
	)
	for (const { liked, ceiling } of MATCH_CEILINGS) {
		// The best title of all shows the ceiling, and nothing shows more.
		assert.equal(shownMatch(100, liked), ceiling)
		assert.equal(shownMatch(99.995, liked), ceiling)
	}
	// Linear between two steps, and flat beyond the ends.
	assert.equal(matchCeiling(35), 94)
	assert.ok(Math.abs(matchCeiling(10) - (85 + 7 / 3)) < 1e-9)
	assert.equal(matchCeiling(0), 85)
	assert.equal(matchCeiling(5000), 99)
	assert.equal(shownMatch(100, 5000), 99)
})

test("below the full ceiling the scale is compressed, not cut off", () => {
	// 5 liked titles: the part above 50 is scaled by 35 / 49.
	assert.equal(shownMatch(0, 5), 50)
	assert.equal(shownMatch(50, 5), 61)
	assert.equal(shownMatch(90, 5), 71)
	assert.equal(shownMatch(99, 5), 79)
	assert.equal(shownMatch(99.9, 5), 82)
	assert.equal(shownMatch(99.99, 5), 85)
	// So the titles of the top 1 percent still differ, where a cut at 85 would show them all alike.
	assert.ok(shownMatch(99.9, 5) > shownMatch(99, 5))
	assert.ok(shownMatch(99.99, 5) > shownMatch(99.9, 5))
})

test("other anchors and ceilings can be passed in", () => {
	const anchors = [
		{ share: 1, match: 50 },
		{ share: 0.1, match: 70 },
		{ share: 0.001, match: 99 },
	]
	assert.equal(shownMatch(90, 100, { anchors }), 70)
	assert.equal(shownMatch(99.9, 100, { anchors }), 99)
	const ceilings = [
		{ liked: 5, ceiling: 60 },
		{ liked: 10, ceiling: 99 },
	]
	assert.equal(shownMatch(100, 5, { ceilings }), 60)
	assert.equal(shownMatch(100, 10, { ceilings }), 99)
	assert.equal(shownMatch(99, 100, {}), shownMatch(99, 100))
})

test("the rank step is the match as it was shown", () => {
	assert.equal(rankStep(0), 50)
	assert.equal(rankStep(60), 79)
	assert.equal(rankStep(82), 90)
	assert.equal(rankStep(98), 98)
	assert.equal(rankStep(99), 99)
	assert.equal(rankStep(100), 99)
	for (let p = 0; p <= 100; p += 0.25)
		assert.equal(rankStep(p), Math.round(50 + 0.49 * p))
	// A step starts at its lowest percentile.
	for (let step = 51; step < 100; step++) {
		const from = percentileOfStep(step)
		assert.equal(rankStep(from + 1e-6), step)
		assert.equal(rankStep(from - 1e-6), step - 1)
	}
})
