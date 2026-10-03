import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	BROWSE_LIFT_FULL,
	BROWSE_LIFT_START,
	SEARCH_MAX_MOVE,
	browseLift,
	browseLiftRange,
	rankForYou,
} = await import("./for-you.ts")
const { rankStep, shownMatch } = await import("./taste-match.ts")

const indexes = (n: number) => Array.from({ length: n }, (_, i) => i)
/** A percentile in the middle of a rank step (50 to 99): the step is the match as it was shown before the scale. */
const at = (step: number) => Math.min(100, (step - 50) / 0.49)

// The rules as they were before the scale of the match changed, on the match shown then
// (round(50 + 0.49 * percentile)), written out plainly. The For you order must stay what these give.
const oldMatch = (percentile: number) => Math.round(50 + 0.49 * percentile)
const oldLift = (match: number | null) =>
	match === null ? 0 : Math.max(0, Math.min(1, (match - 79) / (98 - 79)))
const oldBrowse = (
	percentiles: (number | null)[],
	liftable?: ArrayLike<boolean | number>,
) => {
	const lift = (i: number) => {
		const percentile = percentiles[i]
		if (percentile === null || (liftable && !liftable[i])) return 0
		return oldLift(oldMatch(percentile))
	}
	return indexes(percentiles.length).sort(
		(a, b) =>
			a * (1 - lift(a)) - b * (1 - lift(b)) ||
			Number(lift(b) > 0) - Number(lift(a) > 0) ||
			a - b,
	)
}
const oldSearch = (percentiles: (number | null)[]) => {
	const score = (i: number) => {
		const percentile = percentiles[i]
		const read =
			percentile === null
				? 50
				: Math.max(0, Math.min(100, (oldMatch(percentile) - 50) / 0.49))
		return -(i - 3 * ((read - 50) / 50))
	}
	return indexes(percentiles.length).sort(
		(a, b) => score(b) - score(a) || a - b,
	)
}

/** Percentiles over the whole range with a dense tail, some without a match. */
function fixture(n: number, seed: number) {
	let state = seed
	const random = () => {
		state = (state * 1664525 + 1013904223) >>> 0
		return state / 4294967296
	}
	const percentiles = indexes(n).map(() => {
		const r = random()
		if (r < 0.1) return null
		if (r < 0.2) return 99 + random()
		return Math.fround(random() * 100)
	})
	const liftable = indexes(n).map(() => random() < 0.7)
	return { percentiles, liftable }
}

test("the lift starts after the start step and is full from the full step", () => {
	assert.equal(rankStep(BROWSE_LIFT_START), 79)
	assert.equal(rankStep(BROWSE_LIFT_FULL), 98)
	for (const step of [50, 65, 79]) assert.equal(browseLift(at(step)), 0)
	assert.equal(browseLift(null), 0)
	assert.equal(browseLift(undefined), 0)
	assert.equal(browseLift(-1), 0)
	assert.equal(browseLift(Number.NaN), 0)
	assert.ok(browseLift(at(80)) > 0)
	assert.ok(Math.abs(1 - browseLift(at(90)) - 0.42) < 0.01)
	assert.ok(Math.abs(1 - browseLift(at(95)) - 0.16) < 0.01)
	assert.equal(browseLift(at(98)), 1)
	assert.equal(browseLift(at(99)), 1)
	for (let p = 1; p <= 1000; p++)
		assert.ok(browseLift(p / 10) >= browseLift((p - 1) / 10))
})

test("the lift goes by the percentile, whatever match the person sees", () => {
	assert.equal(browseLift(0), 0)
	assert.equal(browseLift(BROWSE_LIFT_START), 0)
	assert.equal(browseLift(BROWSE_LIFT_FULL), 1)
	assert.equal(browseLift(100), 1)
	// The 82nd percentile shows 75 to a person with many liked titles and 68 to one with 5; its lift is the same.
	assert.equal(shownMatch(82, 100), 75)
	assert.equal(shownMatch(82, 5), 68)
	assert.ok(Math.abs(1 - browseLift(82) - 0.42) < 0.01)
	// The lift is as it was for the match shown before, all along the range.
	for (let p = 0; p <= 10_000; p++)
		assert.equal(browseLift(p / 100), oldLift(oldMatch(p / 100)))
})

test("browse: percentiles up to the start step move nothing", () => {
	const percentiles = indexes(500).map(
		(i) => [at(50), at(62), at(79), null, at(71), -1][i % 6],
	)
	const ranking = rankForYou(indexes(500), percentiles, "browse")
	assert.deepEqual(ranking.order, indexes(500))
	assert.equal(ranking.movedUp, 0)
	assert.ok(ranking.moved.every((by) => by === 0))
})

test("browse: the best matches go to the top from anywhere, in the plain order", () => {
	const n = 5000
	const percentiles: (number | null)[] = new Array(n).fill(at(60))
	for (const i of [4900, 37, 2500]) percentiles[i] = at(98)
	percentiles[1200] = 99.97
	const ranking = rankForYou(indexes(n), percentiles, "browse")
	assert.deepEqual(ranking.order.slice(0, 6), [37, 1200, 2500, 4900, 0, 1])
	assert.deepEqual(ranking.moved.slice(0, 5), [37, 1199, 2498, 4897, -4])
	assert.equal(ranking.movedUp, 4)
	// Everything else keeps the plain order.
	const rest = ranking.order.slice(4)
	assert.deepEqual(
		rest,
		indexes(n).filter((i) => percentiles[i] === at(60)),
	)
})

test("browse: the higher the percentile, the further a title rises, beyond the first 400", () => {
	const n = 3000
	const placeOf = (percentile: number) => {
		const percentiles: (number | null)[] = new Array(n).fill(null)
		percentiles[2000] = percentile
		return rankForYou(indexes(n), percentiles, "browse").order.indexOf(2000)
	}
	assert.equal(placeOf(at(79)), 2000)
	assert.ok(placeOf(at(80)) < 2000)
	assert.ok(placeOf(at(85)) < placeOf(at(80)))
	// The 82nd percentile lands at about 0.42 of its position.
	assert.equal(placeOf(at(90)), Math.ceil(2000 * (1 - browseLift(at(90)))))
	assert.ok(placeOf(at(95)) < placeOf(at(90)))
	assert.equal(placeOf(at(98)), 0)
})

test("browse: a title below the quality floor gets no lift", () => {
	const n = 100
	const percentiles: (number | null)[] = new Array(n).fill(null)
	percentiles[50] = 100
	percentiles[80] = 100
	const liftable = new Uint8Array(n).fill(1)
	liftable[50] = 0
	const ranking = rankForYou(indexes(n), percentiles, "browse", liftable)
	assert.equal(ranking.order[0], 80)
	assert.equal(ranking.order.indexOf(50), 51)
	assert.equal(ranking.movedUp, 1)
})

test("browse: every item appears once", () => {
	const n = 2000
	const { percentiles, liftable } = fixture(n, 7)
	const ranking = rankForYou(indexes(n), percentiles, "browse", liftable)
	assert.deepEqual(
		[...ranking.order].sort((a, b) => a - b),
		indexes(n),
	)
	ranking.order.forEach((plain, j) => assert.equal(ranking.moved[j], plain - j))
	assert.equal(ranking.movedUp, ranking.moved.filter((by) => by > 0).length)
	// A title that got no lift never passes another one that got none.
	const stayed = ranking.order.filter(
		(i) => !liftable[i] || browseLift(percentiles[i]) === 0,
	)
	assert.deepEqual(
		stayed,
		[...stayed].sort((a, b) => a - b),
	)
})

test("browse: the order is what it was before the scale of the match changed", () => {
	for (const seed of [7, 11, 2024]) {
		const n = 3000
		const { percentiles, liftable } = fixture(n, seed)
		assert.deepEqual(
			rankForYou(indexes(n), percentiles, "browse", liftable).order,
			oldBrowse(percentiles, liftable),
		)
		assert.deepEqual(
			rankForYou(indexes(n), percentiles, "browse").order,
			oldBrowse(percentiles),
		)
		// The filter passes a Float32Array with -1 for a title without a match.
		const packed = Float32Array.from(percentiles, (p) => p ?? -1)
		assert.deepEqual(
			rankForYou(indexes(n), packed, "browse", liftable).order,
			oldBrowse(percentiles, liftable),
		)
	}
	// A small one by hand, plain indexes 0 to 9: the full lifts first in the plain order, then by effective position.
	const percentiles = [10, 55, null, 99.5, 61, 97, 30, 75, 99.99, 59]
	assert.deepEqual(
		rankForYou(indexes(10), percentiles, "browse").order,
		[3, 5, 8, 0, 1, 2, 4, 7, 6, 9],
	)
	assert.deepEqual(
		rankForYou(indexes(10), percentiles, "browse").order,
		oldBrowse(percentiles),
	)
})

test("search: a title moves at most SEARCH_MAX_MOVE places, whatever the percentile and the quality floor", () => {
	const n = 40
	const percentiles: (number | null)[] = indexes(n).map((i) =>
		i % 7 === 0 ? 100 : i % 5 === 0 ? null : 0,
	)
	const ranking = rankForYou(
		indexes(n),
		percentiles,
		"search",
		new Uint8Array(n),
	)
	for (const by of ranking.moved) assert.ok(Math.abs(by) <= SEARCH_MAX_MOVE)
	assert.deepEqual(ranking.order, oldSearch(percentiles))
	assert.notDeepEqual(ranking.order, indexes(n))
})

test("search: the order is what it was before the scale of the match changed", () => {
	for (const seed of [3, 19]) {
		const { percentiles } = fixture(60, seed)
		const ranking = rankForYou(indexes(60), percentiles, "search")
		assert.deepEqual(ranking.order, oldSearch(percentiles))
		for (const by of ranking.moved) assert.ok(Math.abs(by) <= SEARCH_MAX_MOVE)
	}
})

test("the lift's range is where the lift begins and where it is full, as percentiles", () => {
	const { start, full } = browseLiftRange()
	// Within a percentile of the constants: the edges of their steps.
	assert.ok(Math.abs(start - 60.2) < 0.01)
	assert.ok(Math.abs(full - 96.94) < 0.01)
	assert.equal(browseLift(start - 0.01), 0)
	assert.ok(browseLift(start + 0.01) > 0)
	assert.ok(browseLift(full - 0.01) < 1)
	assert.equal(browseLift(full + 0.01), 1)
	// So the explanation says: the best 40% start to climb, the top 3% go to the top.
	assert.equal(Math.round(100 - start), 40)
	assert.equal(Math.round(100 - full), 3)
	assert.deepEqual(browseLiftRange({ start: 0, full: 100 }), {
		start: (51 - 0.5 - 50) / 0.49,
		full: (99 - 0.5 - 50) / 0.49,
	})
})

test("options tune the curve; without them the constants apply", () => {
	assert.equal(browseLift(82, {}), browseLift(82))
	// A later start and an earlier full end: the steps of the percentiles 80 and 90 are 89 and 94.
	const options = { start: 80, full: 90 }
	assert.equal(browseLift(at(89), options), 0)
	assert.ok(browseLift(at(90), options) > 0)
	assert.equal(browseLift(at(94), options), 1)
	// An exponent above 1 keeps the middle lower; the ends stay.
	const straight = browseLift(at(90))
	assert.ok(browseLift(at(90), { exponent: 2 }) < straight)
	assert.equal(browseLift(at(79), { exponent: 2 }), 0)
	assert.equal(browseLift(at(98), { exponent: 2 }), 1)
	// Ends that meet or cross are a step.
	assert.equal(browseLift(at(80), { start: 70, full: 60 }), 0)
	assert.equal(browseLift(at(85), { start: 70, full: 60 }), 1)
})

test("browse: rankForYou ranks by the options it is given", () => {
	const n = 1000
	const percentiles = indexes(n).map((i) => (i === 900 ? at(85) : at(60)))
	const plain = rankForYou(indexes(n), percentiles, "browse")
	const tuned = rankForYou(indexes(n), percentiles, "browse", undefined, {
		full: 71,
	})
	// The step 85 is a partial lift under the constants and a full one once the full end is the 71st percentile.
	assert.ok(plain.order.indexOf(900) > 0)
	assert.equal(tuned.order[0], 900)
	assert.deepEqual(
		rankForYou(indexes(n), percentiles, "browse", undefined, {}).order,
		plain.order,
	)
})
