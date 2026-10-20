import assert from "node:assert/strict"
import { test } from "node:test"
import { popularHomeKeys } from "./popular-keys.server.ts"

const candidates = {
	version: "test",
	today: 1,
	byMood: new Map(),
	all: [1, 2, 3, 4, 5, 6].map((key) => ({
		key,
		popularity: 100 - key,
		moods: [],
	})),
}
const viewer = {
	seen: new Set<number>(),
	skipped: new Set<number>(),
	hidden: new Set<number>(),
	wishlist: new Map<number, Date>(),
	services: [8],
}
test("popular uses catalog popularity, saved services first, with an honest mixed fallback", () => {
	assert.deepEqual(
		popularHomeKeys(candidates, viewer, (key) => key === 4, 3),
		{ keys: [4, 1, 2], scope: "mixed" },
	)
	assert.deepEqual(
		popularHomeKeys(candidates, viewer, (key) => key > 2, 3),
		{ keys: [3, 4, 5], scope: "services" },
	)
})
test("popular preserves the pool exclusions, including Not interested and Dropped", () => {
	const marked = {
		...viewer,
		hidden: new Set([1, 2]),
		seen: new Set([3]),
		skipped: new Set([4]),
		wishlist: new Map([[5, new Date()]]),
	}
	assert.deepEqual(
		popularHomeKeys(candidates, marked, () => true),
		{ keys: [6], scope: "services" },
	)
	assert.deepEqual(
		popularHomeKeys(
			candidates,
			{ ...marked, hidden: new Set([1, 2, 6]) },
			() => true,
		),
		{ keys: [], scope: "all" },
	)
})
test("unknown availability and no saved services never pretend to be on my services", () => {
	assert.deepEqual(
		popularHomeKeys(candidates, viewer, () => null, 3),
		{ keys: [1, 2, 3], scope: "unknown" },
	)
	assert.deepEqual(
		popularHomeKeys(
			candidates,
			{ ...viewer, services: [] },
			() => {
				throw new Error("must not read availability without services")
			},
			3,
		),
		{ keys: [1, 2, 3], scope: "all" },
	)
	assert.deepEqual(
		popularHomeKeys(candidates, viewer, () => false, 3),
		{ keys: [1, 2, 3], scope: "all" },
	)
})
