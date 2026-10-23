import assert from "node:assert/strict"
import { test } from "node:test"
import { type EdgeOf, bothLove, comparePulls, sharedScores, yourEdgesOnTheirScale } from "./compare-model.ts"

const e = (key: string, edge: number, tier = 0): EdgeOf => ({ key, label: key.toUpperCase(), edge, tier })

test("pulls name worded attributes only: shared, only theirs, only yours", () => {
	const theirs = [e("satire_parody", 1.2), e("philosophical", 0.9), e("tension", -0.4), e("direction", 2)]
	const yours = [e("satire_parody", -0.2), e("philosophical", 1.1), e("tension", 1.5), e("direction", 2)]
	assert.deepEqual(comparePulls(theirs, yours), {
		both: ["PHILOSOPHICAL"],
		onlyThem: ["SATIRE_PARODY"],
		onlyYou: ["TENSION"],
	})
})

test("your edges are brought to their scale", () => {
	const out = yourEdgesOnTheirScale([e("a", 2), e("b", -2)], [e("a", 0.5, 2), e("b", -0.5, -1)])
	assert.deepEqual(out, { a: { edge: 2, tier: 2 }, b: { edge: -2, tier: -1 } })
})

test("shared scores: widest gap first; both love: 8 and up, highest pair first", () => {
	const yours = new Map([
		["movie-1", 9],
		["movie-2", 3],
		["movie-3", 10],
		["movie-4", 7],
	])
	const theirs = new Map([
		["movie-1", 10],
		["movie-2", 8],
		["movie-3", 10],
		["movie-5", 9],
	])
	const shared = sharedScores(yours, theirs)
	assert.deepEqual(
		shared.map((s) => s.key),
		["movie-2", "movie-1", "movie-3"],
	)
	assert.deepEqual(
		bothLove(shared).map((s) => s.key),
		["movie-3", "movie-1"],
	)
})
