import assert from "node:assert/strict"
import { test } from "node:test"
import { createVersionMemo } from "./version-memo.ts"

test("a value is computed once per version and key", () => {
	const memo = createVersionMemo<number>(10)
	let runs = 0
	const compute = () => ++runs
	assert.equal(memo.get("v1", "a", compute), 1)
	assert.equal(memo.get("v1", "a", compute), 1)
	assert.equal(memo.get("v1", "b", compute), 2)
	assert.equal(memo.get("v2", "a", compute), 3, "a new version computes again")
	assert.equal(memo.size, 1, "and drops the old version's entries")
})

test("the least recently used entry goes first", () => {
	const memo = createVersionMemo<string>(2)
	memo.get("v", "a", () => "A")
	memo.get("v", "b", () => "B")
	memo.get("v", "a", () => "A2")
	memo.get("v", "c", () => "C")
	assert.equal(memo.size, 2)
	assert.equal(
		memo.get("v", "a", () => "again"),
		"A",
		"a was used recently, so it stayed",
	)
	assert.equal(
		memo.get("v", "b", () => "B2"),
		"B2",
		"b was dropped",
	)
})
