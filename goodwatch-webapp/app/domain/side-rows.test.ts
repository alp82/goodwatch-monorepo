import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { groupInListOrder } = await import("./side-rows.ts")

// A list of 200 titles in a made-up personal order, each on one of three sides or on none.
const list = Array.from(
	{ length: 200 },
	(_, i) => 1e12 + ((i * 7919) % 100_003),
)
const sideOf = (key: number) => {
	const k = key % 4
	return k === 3 ? null : k
}

test("inside each row, the titles keep the list's order", () => {
	const groups = groupInListOrder(list, sideOf, 12)
	const place = new Map(list.map((key, i) => [key, i]))
	for (const group of groups) {
		const inList = list.filter((key) => sideOf(key) === group.side)
		assert.deepEqual(group.keys, inList.slice(0, 12))
		const places = group.keys.map((key) => place.get(key) ?? -1)
		assert.deepEqual(
			places,
			[...places].sort((a, b) => a - b),
		)
		assert.equal(group.total, inList.length)
	}
})

test("rows come in the order of their first title, the titles that fit no side among them", () => {
	// Fits no side first, then side 2, side 0, side 1.
	const keys = [3, 2, 6, 0, 7, 1, 4, 5].map((n) => 1e12 + n)
	const groups = groupInListOrder(keys, sideOf, 12)
	assert.deepEqual(
		groups.map((g) => g.side),
		[null, 2, 0, 1],
	)
	assert.deepEqual(
		groups.map((g) => g.keys.map((key) => key - 1e12)),
		[
			[3, 7],
			[2, 6],
			[0, 4],
			[1, 5],
		],
	)
})

test("a side without a title in the list has no row", () => {
	const keys = [0, 4, 8].map((n) => 1e12 + n)
	assert.deepEqual(groupInListOrder(keys, sideOf, 2), [
		{ side: 0, total: 3, keys: [1e12, 1e12 + 4] },
	])
	assert.deepEqual(groupInListOrder([], sideOf, 12), [])
})

test("the taste grouping shows while For you is on, with any sort, and never while it's off", async () => {
	const { groupsByTaste } = await import("./side-rows.ts")
	for (const sort of ["popular", "top", "newest", "match"])
		assert.equal(groupsByTaste({ searching: false, forYou: true, sort }), true)
	for (const sort of ["popular", "top", "newest"])
		assert.equal(
			groupsByTaste({ searching: false, forYou: false, sort }),
			false,
		)
	// Under Best match For you shows on, whatever the URL says.
	assert.equal(
		groupsByTaste({ searching: false, forYou: false, sort: "match" }),
		true,
	)
	// A search keeps its grid.
	assert.equal(
		groupsByTaste({ searching: true, forYou: true, sort: "match" }),
		false,
	)
})
