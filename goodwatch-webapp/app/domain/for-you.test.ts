import assert from "node:assert/strict"
import { test } from "node:test"
import {
	BROWSE_LIFT_FULL,
	BROWSE_LIFT_START,
	SEARCH_MAX_MOVE,
	browseLift,
	browseLiftOfMatch,
	browseLiftRange,
	rankForYou,
} from "./for-you.ts"

const indexes = (n: number) => Array.from({ length: n }, (_, i) => i)
const matchAt = (percentile: number) => Math.round(50 + 0.49 * percentile)

test("the lift starts after the start match and is full from the full match", () => {
	assert.equal(matchAt(BROWSE_LIFT_START), 79)
	assert.equal(matchAt(BROWSE_LIFT_FULL), 98)
	for (const match of [50, 65, 79]) assert.equal(browseLiftOfMatch(match), 0)
	assert.equal(browseLiftOfMatch(null), 0)
	assert.ok(browseLiftOfMatch(80) > 0)
	assert.ok(Math.abs(1 - browseLiftOfMatch(90) - 0.42) < 0.01)
	assert.ok(Math.abs(1 - browseLiftOfMatch(95) - 0.16) < 0.01)
	assert.equal(browseLiftOfMatch(98), 1)
	assert.equal(browseLiftOfMatch(99), 1)
	for (let match = 51; match < 100; match++)
		assert.ok(browseLiftOfMatch(match) >= browseLiftOfMatch(match - 1))
})

test("the lift by percentile is the lift of the match shown for it", () => {
	assert.equal(browseLift(0), 0)
	assert.equal(browseLift(BROWSE_LIFT_START), 0)
	assert.equal(browseLift(BROWSE_LIFT_FULL), 1)
	assert.equal(browseLift(100), 1)
	assert.equal(browseLift(82), browseLiftOfMatch(90))
})

test("browse: matches up to the start match move nothing", () => {
	const matches = indexes(500).map((i) => [50, 62, 79, null, 71][i % 5])
	const ranking = rankForYou(indexes(500), matches, "browse")
	assert.deepEqual(ranking.order, indexes(500))
	assert.equal(ranking.movedUp, 0)
	assert.ok(ranking.moved.every((by) => by === 0))
})

test("browse: full matches go to the top from anywhere, in the plain order", () => {
	const n = 5000
	const matches: (number | null)[] = new Array(n).fill(60)
	for (const i of [4900, 37, 2500]) matches[i] = 98
	matches[1200] = 99
	const ranking = rankForYou(indexes(n), matches, "browse")
	assert.deepEqual(ranking.order.slice(0, 6), [37, 1200, 2500, 4900, 0, 1])
	assert.deepEqual(ranking.moved.slice(0, 5), [37, 1199, 2498, 4897, -4])
	assert.equal(ranking.movedUp, 4)
	// Everything else keeps the plain order.
	const rest = ranking.order.slice(4)
	assert.deepEqual(
		rest,
		indexes(n).filter((i) => matches[i] === 60),
	)
})

test("browse: the higher the match, the further a title rises, beyond the first 400", () => {
	const n = 3000
	const at = (match: number) => {
		const matches: (number | null)[] = new Array(n).fill(null)
		matches[2000] = match
		return rankForYou(indexes(n), matches, "browse").order.indexOf(2000)
	}
	assert.equal(at(79), 2000)
	assert.ok(at(80) < 2000)
	assert.ok(at(85) < at(80))
	// A 90 lands at about 0.42 of its position.
	assert.equal(at(90), Math.ceil(2000 * (1 - browseLiftOfMatch(90))))
	assert.ok(at(95) < at(90))
	assert.equal(at(98), 0)
})

test("browse: a title below the quality floor gets no lift", () => {
	const n = 100
	const matches: (number | null)[] = new Array(n).fill(null)
	matches[50] = 99
	matches[80] = 99
	const liftable = new Uint8Array(n).fill(1)
	liftable[50] = 0
	const ranking = rankForYou(indexes(n), matches, "browse", liftable)
	assert.equal(ranking.order[0], 80)
	assert.equal(ranking.order.indexOf(50), 51)
	assert.equal(ranking.movedUp, 1)
})

test("browse: every item appears once", () => {
	let state = 7
	const random = () => {
		state = (state * 1664525 + 1013904223) >>> 0
		return state / 4294967296
	}
	const n = 2000
	const matches = indexes(n).map(() =>
		random() < 0.1 ? null : 50 + Math.floor(random() * 50),
	)
	const liftable = indexes(n).map(() => random() < 0.7)
	const ranking = rankForYou(indexes(n), matches, "browse", liftable)
	assert.deepEqual(
		[...ranking.order].sort((a, b) => a - b),
		indexes(n),
	)
	ranking.order.forEach((plain, j) => assert.equal(ranking.moved[j], plain - j))
	assert.equal(ranking.movedUp, ranking.moved.filter((by) => by > 0).length)
	// The same order as sorting everything by effective position, a lifted title first on a tie.
	const lift = (i: number) => (liftable[i] ? browseLiftOfMatch(matches[i]) : 0)
	assert.deepEqual(
		ranking.order,
		indexes(n).sort(
			(a, b) =>
				a * (1 - lift(a)) - b * (1 - lift(b)) ||
				Number(lift(b) > 0) - Number(lift(a) > 0) ||
				a - b,
		),
	)
	// A title that got no lift never passes another one that got none.
	const stayed = ranking.order.filter(
		(i) => !liftable[i] || browseLiftOfMatch(matches[i]) === 0,
	)
	assert.deepEqual(
		stayed,
		[...stayed].sort((a, b) => a - b),
	)
})

test("search: a title moves at most SEARCH_MAX_MOVE places, whatever the match and the quality floor", () => {
	const n = 40
	const matches: (number | null)[] = indexes(n).map((i) =>
		i % 7 === 0 ? 99 : i % 5 === 0 ? null : 50,
	)
	const ranking = rankForYou(indexes(n), matches, "search", new Uint8Array(n))
	for (const by of ranking.moved) assert.ok(Math.abs(by) <= SEARCH_MAX_MOVE)
	// The rule as it was: -(i - 3 * lean), lean = (percentile - 50) / 50, ties in the plain order.
	const score = (i: number) => {
		const match = matches[i]
		const percentile =
			match == null ? 50 : Math.max(0, Math.min(100, (match - 50) / 0.49))
		return -(i - 3 * ((percentile - 50) / 50))
	}
	assert.deepEqual(
		ranking.order,
		indexes(n).sort((a, b) => score(b) - score(a) || a - b),
	)
	assert.notDeepEqual(ranking.order, indexes(n))
})

test("the lift's range is the two constants as matches", () => {
	assert.deepEqual(browseLiftRange(), { start: 79, full: 98 })
	assert.deepEqual(browseLiftRange({ start: 0, full: 100 }), {
		start: 50,
		full: 99,
	})
})

test("options tune the curve; without them the constants apply", () => {
	assert.equal(browseLiftOfMatch(90, {}), browseLiftOfMatch(90))
	assert.equal(browseLift(82, {}), browseLift(82))
	// A later start and an earlier full end.
	const options = { start: 80, full: 90 }
	assert.equal(browseLiftOfMatch(89, options), 0)
	assert.ok(browseLiftOfMatch(90, options) > 0)
	assert.equal(browseLiftOfMatch(94, options), 1)
	// An exponent above 1 keeps the middle lower; the ends stay.
	const straight = browseLiftOfMatch(90)
	assert.ok(browseLiftOfMatch(90, { exponent: 2 }) < straight)
	assert.equal(browseLiftOfMatch(79, { exponent: 2 }), 0)
	assert.equal(browseLiftOfMatch(98, { exponent: 2 }), 1)
	// Ends that meet or cross are a step.
	assert.equal(browseLiftOfMatch(80, { start: 70, full: 60 }), 0)
	assert.equal(browseLiftOfMatch(85, { start: 70, full: 60 }), 1)
})

test("browse: rankForYou ranks by the options it is given", () => {
	const n = 1000
	const matches = indexes(n).map((i) => (i === 900 ? 85 : 60))
	const plain = rankForYou(indexes(n), matches, "browse")
	const tuned = rankForYou(indexes(n), matches, "browse", undefined, {
		full: 71,
	})
	// 85 is a partial lift under the constants and a full one once the full end is the match 85.
	assert.ok(plain.order.indexOf(900) > 0)
	assert.equal(tuned.order[0], 900)
	assert.deepEqual(
		rankForYou(indexes(n), matches, "browse", undefined, {}).order,
		plain.order,
	)
})
