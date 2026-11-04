import assert from "node:assert/strict"
import { test } from "node:test"
import { allocateHidden, apportion } from "./hidden-allocation.ts"

const sum = (m: Map<string, number>) => [...m.values()].reduce((s, n) => s + n, 0)

test("apportion: integers in proportion, adding up exactly", () => {
	assert.deepEqual(apportion(10, [1, 1, 1]), [4, 3, 3])
	assert.deepEqual(apportion(0, [1, 2]), [0, 0])
	assert.deepEqual(apportion(5, [0, 0]), [0, 0])
})

test("a read filter and the person's own filter share the hidden titles once (review repro)", () => {
	// 100 hidden: the person's score filter alone hides 40, the runtime read from the words alone hides 60.
	const out = allocateHidden(100, [
		{ group: "minScore", sole: 40, members: ["score"] },
		{ group: "runtime", sole: 60, members: ["read:short"] },
	])
	assert.deepEqual(Object.fromEntries(out), { score: 40, "read:short": 60 })
	assert.equal(sum(out), 100)
})

test("titles two filters hide are shared by weight, and the total is conserved", () => {
	const out = allocateHidden(100, [
		{ group: "minScore", sole: 20, members: ["score"] },
		{ group: "runtime", sole: 30, members: ["read:short"] },
	])
	// 50 shared, weighted 21:31.
	assert.equal(sum(out), 100)
	assert.ok((out.get("score") ?? 0) > 20 && (out.get("read:short") ?? 0) > 30)
})

test("read filters only, no rows of the person's own: nothing is lost", () => {
	const out = allocateHidden(57, [{ group: "runtime", sole: 0, members: ["read:short"] }])
	assert.equal(out.get("read:short"), 57)
})

test("every recovery 0 (all overlap): shared evenly, still the whole total", () => {
	const out = allocateHidden(9, [
		{ group: "a", sole: 0, members: ["a"] },
		{ group: "b", sole: 0, members: ["b"] },
	])
	assert.deepEqual(Object.fromEntries(out), { a: 5, b: 4 })
})

test("two read parts in one filter group split the group's count instead of both claiming it", () => {
	const out = allocateHidden(60, [{ group: "runtime", sole: 60, members: ["read:short", "read:under 2 hours"] }])
	assert.deepEqual(Object.fromEntries(out), { "read:short": 30, "read:under 2 hours": 30 })
})

test("a group the search applies itself takes no share", () => {
	const out = allocateHidden(50, [
		{ group: "years", sole: 0, inSearch: true, members: ["years"] },
		{ group: "minScore", sole: 10, members: ["score"] },
	])
	assert.deepEqual(Object.fromEntries(out), { years: 0, score: 50 })
})

test("recoveries above the total never allocate more than the total", () => {
	const out = allocateHidden(30, [
		{ group: "a", sole: 40, members: ["a"] },
		{ group: "b", sole: 20, members: ["b"] },
	])
	assert.equal(sum(out), 30)
})
