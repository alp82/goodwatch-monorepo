import { test } from "node:test"
import assert from "node:assert/strict"
import { profileTaste } from "./proposal-taste.ts"
import {
	tasteVector,
	tasteVectorFrom,
	MIN_LIKED,
} from "../taste/formula.server.ts"
import { tasteFixture, key } from "./proposal-taste-test-support.ts"
const snapshot = tasteFixture()
const answer = (i: number, value: "loved" | "not_for_me" | "unseen") => ({
	key: key(i),
	answer: value,
	source: "taste" as const,
	at: 1,
})
test("YepWatch vector reuses GoodWatch formula with one like; GoodWatch still requires five", () => {
	const ratings = [{ key: key(1), score: 9, at: 1 }]
	assert.equal(MIN_LIKED, 5)
	assert.equal(tasteVector(snapshot, { ratings, wantToSee: [] }).vector, null)
	assert.deepEqual(
		profileTaste(snapshot, [answer(1, "loved")]).vector,
		tasteVectorFrom(snapshot, { ratings, wantToSee: [] }, { minLiked: 1 })
			.vector
	)
	const signal = profileTaste(snapshot, [
		answer(1, "loved"),
		answer(5, "not_for_me"),
		answer(9, "unseen"),
	])
	assert.ok(signal.vector![0] > 0)
	assert.ok(signal.vector![1] < 0)
	assert.equal(signal.confidence, 1.5 / 8)
	assert.deepEqual([...signal.seen], [key(1), key(5)])
	assert.deepEqual([...signal.unseen], [key(9)])
	assert.equal(signal.hidden.size, 0)
	assert.equal(signal.quantiles?.length, 119)
})
test("Unseen-only is neutral; negative-only is -N; confidence is capped", () => {
	assert.equal(profileTaste(snapshot, []).vector, null)
	assert.equal(profileTaste(snapshot, [answer(1, "unseen")]).vector, null)
	assert.equal(profileTaste(snapshot, [answer(1, "not_for_me")]).vector![0], -1)
	assert.equal(
		profileTaste(
			snapshot,
			Array.from({ length: 9 }, () => answer(1, "loved"))
		).confidence,
		1
	)
})
test("Member taste keeps its GoodWatch direction with a bounded normalized YepWatch blend", () => {
	const member = new Float32Array(74)
	member[1] = 1
	const result = profileTaste(snapshot, [answer(1, "loved")], member)
	assert.ok(result.vector![1] > 0.99)
	assert.ok(result.vector![0] > 0)
	assert.ok(Math.abs(Math.hypot(...result.vector!) - 1) < 1e-6)
	assert.deepEqual(profileTaste(snapshot, [], member).vector, member)
	assert.equal(profileTaste(snapshot, [], null).vector, null)
})
