import assert from "node:assert/strict"
import { test } from "node:test"
import {
	RANK_LEVELS,
	SHARED_FROM,
	agreement,
	blend,
	cosine,
	matchPercent,
	percentOf,
	rankTable,
	samplePairs,
	shareBelow,
} from "./member-match-formula.ts"

const shared = (n: number, gap: number) => Array.from({ length: n }, () => [8, 8 - gap] as [number, number])

test("cosine of equal, opposite and orthogonal vectors", () => {
	assert.equal(cosine([1, 0], [1, 0]), 1)
	assert.equal(cosine([1, 0], [-1, 0]), -1)
	assert.equal(cosine([1, 0], [0, 1]), 0)
	assert.equal(cosine([0, 0], [1, 0]), 0)
})

test("agreement is 1 for equal scores, 0 for 9 apart, null without shared titles", () => {
	assert.equal(agreement(shared(3, 0)), 1)
	assert.equal(agreement([[1, 10]]), 0)
	assert.equal(agreement([]), null)
	assert.ok(Math.abs((agreement(shared(4, 3)) ?? 0) - (1 - 3 / 9)) < 1e-9)
})

test("blend uses the vectors alone below SHARED_FROM shared titles, then 70/30", () => {
	const few = blend([1, 0], [1, 0], shared(SHARED_FROM - 1, 9))
	assert.deepEqual(few, { value: 1, kind: "vector" })
	const many = blend([1, 0], [1, 0], shared(SHARED_FROM, 9))
	assert.equal(many.kind, "blended")
	assert.ok(Math.abs(many.value - 0.7) < 1e-9)
})

test("rankTable needs enough values and is ascending with RANK_LEVELS entries", () => {
	assert.equal(rankTable([1, 2, 3]), null)
	const table = rankTable(Array.from({ length: 200 }, (_, i) => i / 199)) as number[]
	assert.equal(table.length, RANK_LEVELS)
	assert.equal(table[0], 0)
	assert.equal(table[RANK_LEVELS - 1], 1)
	for (let i = 1; i < table.length; i++) assert.ok(table[i] >= table[i - 1])
})

test("shareBelow places a value in the sample and percentOf maps it to 1..99", () => {
	const table = rankTable(Array.from({ length: 1000 }, (_, i) => i / 999)) as number[]
	assert.equal(shareBelow(-1, table), 0)
	assert.equal(shareBelow(2, table), 1)
	assert.ok(Math.abs(shareBelow(0.5, table) - 0.5) < 0.01)
	assert.equal(percentOf(0), 1)
	assert.equal(percentOf(1), 99)
	assert.equal(percentOf(0.5), 50)
})

test("matchPercent ranks a blended pair among blended pairs, else among vector pairs, else by the blend", () => {
	const low = rankTable(Array.from({ length: 100 }, (_, i) => i / 1000)) as number[] // 0..0.099
	const high = rankTable(Array.from({ length: 100 }, (_, i) => 0.9 + i / 1000)) as number[] // 0.9..0.999
	const pair = { value: 0.5, kind: "blended" as const }
	assert.equal(matchPercent(pair, { vector: low, blended: high }), 1)
	assert.equal(matchPercent(pair, { vector: low, blended: null }), 99)
	assert.equal(matchPercent(pair, null), 50)
})

test("samplePairs returns every pair when few, distinct pairs when many", () => {
	assert.equal(samplePairs(4, 100).length, 6)
	let seed = 1
	const random = () => {
		seed = (seed * 16807) % 2147483647
		return seed / 2147483647
	}
	const pairs = samplePairs(300, 500, random)
	assert.equal(pairs.length, 500)
	assert.equal(new Set(pairs.map(([a, b]) => `${a}:${b}`)).size, 500)
	assert.ok(pairs.every(([a, b]) => a < b))
})
