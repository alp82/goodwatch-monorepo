import assert from "node:assert/strict"
import { test } from "node:test"
import type { FilterState } from "../domain/filter-state.ts"
import type { FilterResult } from "./title-filter/index.server.ts"
import type { ViewerContext } from "./viewer.server.ts"
import {
	createFilterResultCache,
	discoverFilterKey,
} from "./discover-filter-cache.server.ts"
import {
	renderMetrics,
	resetMetricsForTest,
} from "./metrics/registry.server.ts"

const viewer = (): ViewerContext => ({
	viewer: { kind: "guest", progress: { interactions: [] } },
	country: "US",
	services: [8, 9],
	seen: new Set(),
	skipped: new Set(),
	notInterested: new Set(),
	hidden: new Set(),
	ratings: new Map(),
	wishlist: new Map(),
	forYou: true,
})
const state = (): FilterState => ({
	type: "all",
	anime: "any",
	onMyServices: true,
	notSeenYet: false,
	moods: [],
	genres: [],
	minScore: 0,
	minMatch: 0,
	released: "any",
})
const input = (): Parameters<typeof discoverFilterKey>[0] => ({
	viewer: viewer(),
	taste: { signal: "none" },
	state: state(),
	sort: "popular",
	snapshotVersion: "one",
	availabilityLoadedAt: 100,
	ageFilter: true,
	year: 2026,
})
const result = (keys = [3, 1, 2]): FilterResult => ({
	keys,
	sortUsed: "popular",
	hasTaste: false,
	total: keys.length,
	hidden: 0,
	recoveries: [],
	optionCounts: {} as FilterResult["optionCounts"],
	approximate: false,
	ladder: null,
})

test("repeated anonymous requests keep the filter passes and key order", async () => {
	const cache = createFilterResultCache()
	let calls = 0
	const compute = async () => {
		calls++
		return result()
	}
	const first = await cache.run(discoverFilterKey(input()), compute)
	const second = await cache.run(discoverFilterKey(input()), compute)
	assert.equal(calls, 1)
	assert.equal(first, second)
	assert.deepEqual(second.keys, [3, 1, 2])
})

test("pages and For you share one filter entry", async () => {
	const cache = createFilterResultCache()
	let calls = 0
	const compute = async () => {
		calls++
		return result()
	}
	const first = { ...input(), page: 1, forYou: false }
	const next = { ...input(), page: 2, forYou: true }
	assert.equal(discoverFilterKey(first), discoverFilterKey(next))
	await cache.run(discoverFilterKey(first), compute)
	await cache.run(discoverFilterKey(next), compute)
	assert.equal(calls, 1)
	assert.equal(cache.stats().entries, 1)
})

test("only plain guests with loaded availability get a key", () => {
	const variants: Partial<ViewerContext>[] = [
		{ viewer: { kind: "member", userId: "member" } },
		{ seen: new Set([1]) },
		{ skipped: new Set([1]) },
		{ hidden: new Set([1]) },
	]
	for (const change of variants)
		assert.equal(
			discoverFilterKey({ ...input(), viewer: { ...viewer(), ...change } }),
			null,
		)
	assert.equal(
		discoverFilterKey({ ...input(), taste: { signal: "some" } }),
		null,
	)
	assert.equal(
		discoverFilterKey({ ...input(), availabilityLoadedAt: null }),
		null,
	)
	assert.notEqual(discoverFilterKey(input()), null)
})

test("keys include every filter dependency", () => {
	const base = input()
	const key = discoverFilterKey(base)
	const variants: Partial<typeof base>[] = [
		{ viewer: { ...viewer(), country: "DE" } },
		{ viewer: { ...viewer(), services: [8] } },
		{ snapshotVersion: "two" },
		{ availabilityLoadedAt: 101 },
		{ ageFilter: false },
		{ year: 2027 },
		{ sort: "top" },
	]
	for (const change of variants)
		assert.notEqual(discoverFilterKey({ ...base, ...change }), key)
	const states: Partial<FilterState>[] = [
		{ type: "movie" },
		{ anime: "only" },
		{ onMyServices: false },
		{ services: [8] },
		{ notSeenYet: true },
		{ moods: ["funny"] },
		{ genres: ["Drama"] },
		{ minScore: 70 },
		{ minMatch: 80 },
		{ released: "recent" },
		{ similarTo: [1] },
		{ people: [2] },
		{ ageLimit: 12 },
		{ content: { violence: "hide" } },
		{ legacy: { minYear: "2000" } },
	]
	for (const change of states)
		assert.notEqual(
			discoverFilterKey({ ...base, state: { ...state(), ...change } }),
			key,
		)
})

test("keys normalize object order and viewer services but preserve option order", () => {
	const base = input()
	base.state = {
		...state(),
		legacy: { minYear: "2000", maxYear: "2020" },
		content: { violence: "hide", sex: "show" },
	}
	const reordered = {
		...base,
		viewer: { ...viewer(), services: [9, 8, 9], forYou: false },
		state: {
			...Object.fromEntries(Object.entries(base.state).reverse()),
			legacy: { maxYear: "2020", minYear: "2000", maxScore: undefined },
			content: { sex: "show", violence: "hide", drugs: undefined },
			ageLimit: undefined,
		} as FilterState,
	}
	assert.equal(discoverFilterKey(base), discoverFilterKey(reordered))
	for (const field of [
		"services",
		"similarTo",
		"people",
		"genres",
		"moods",
	] as const) {
		const options =
			field === "genres"
				? ["Drama", "Comedy"]
				: field === "moods"
					? ["funny", "scary"]
					: [1, 2]
		assert.notEqual(
			discoverFilterKey({
				...base,
				state: { ...base.state, [field]: options },
			}),
			discoverFilterKey({
				...base,
				state: { ...base.state, [field]: [...options].reverse() },
			}),
		)
	}
})

test("concurrent runs share the same promise and compute once", async () => {
	const cache = createFilterResultCache()
	let resolve!: (value: FilterResult) => void
	let calls = 0
	const compute = () => {
		calls++
		return new Promise<FilterResult>((done) => {
			resolve = done
		})
	}
	const first = cache.run("key", compute)
	const second = cache.run("key", compute)
	assert.equal(first, second)
	await Promise.resolve()
	assert.equal(calls, 1)
	resolve(result())
	assert.equal(await first, await second)
	assert.equal(cache.stats().hits, 1)
})

test("rejections reach every caller and the next run retries", async () => {
	const cache = createFilterResultCache()
	const error = new Error("failed")
	let calls = 0
	const compute = async () => {
		calls++
		throw error
	}
	const first = cache.run("key", compute)
	const second = cache.run("key", compute)
	await Promise.all([
		assert.rejects(first, error),
		assert.rejects(second, error),
	])
	assert.equal(cache.stats().entries, 0)
	await cache.run("key", async () => {
		calls++
		return result()
	})
	assert.equal(calls, 2)
})

test("approximate and moved results are not stored", async () => {
	for (const change of [{ approximate: true }, { moved: [] }]) {
		const cache = createFilterResultCache()
		let calls = 0
		const compute = async () => {
			calls++
			return { ...result(), ...change }
		}
		await cache.run("key", compute)
		await cache.run("key", compute)
		assert.equal(calls, 2)
		assert.equal(cache.stats().entries, 0)
	}
})

test("entries expire at ttlMs without extending on a hit", async () => {
	let now = 0
	const cache = createFilterResultCache({ ttlMs: 10, now: () => now })
	const first = await cache.run("key", async () => result())
	now = 9
	assert.equal(await cache.run("key", async () => result()), first)
	now = 10
	assert.notEqual(await cache.run("key", async () => result()), first)
	assert.equal(cache.stats().keys, 3)
})

for (const options of [{ maxEntries: 2 }, { maxKeys: 6 }]) {
	test(`least recently used eviction with ${JSON.stringify(options)}`, async () => {
		const cache = createFilterResultCache(options)
		const compute = async () => result()
		const a = await cache.run("a", compute)
		const b = await cache.run("b", compute)
		assert.equal(await cache.run("a", compute), a)
		await cache.run("c", compute)
		assert.equal(cache.stats().entries, 2)
		assert.equal(cache.stats().keys, 6)
		assert.equal(await cache.run("a", compute), a)
		assert.notEqual(await cache.run("b", compute), b)
	})
}

test("oversized results are not stored or allowed to evict entries", async () => {
	const cache = createFilterResultCache({ maxKeys: 2 })
	await cache.run("small", async () => result([1]))
	await cache.run("large", async () => result())
	await cache.run("large", async () => result())
	assert.deepEqual(cache.stats(), {
		entries: 1,
		keys: 1,
		hits: 0,
		misses: 3,
		uncacheable: 0,
	})
})

test("disabled and null keys always compute and stats count outcomes", async () => {
	resetMetricsForTest()
	let enabled = true
	const cache = createFilterResultCache({ enabled: () => enabled })
	let calls = 0
	const compute = async () => {
		calls++
		return result()
	}
	await cache.run("key", compute)
	await cache.run("key", compute)
	await cache.run(null, compute)
	enabled = false
	await cache.run("key", compute)
	await cache.run("key", compute)
	assert.equal(calls, 4)
	assert.deepEqual(cache.stats(), {
		entries: 1,
		keys: 3,
		hits: 1,
		misses: 1,
		uncacheable: 3,
	})
	for (const [outcome, count] of [
		["hit", 1],
		["miss", 1],
		["uncacheable", 3],
	])
		assert.ok(
			renderMetrics().includes(
				`goodwatch_discover_filter_cache_total{result="${outcome}"} ${count}`,
			),
		)
	cache.clear()
	assert.deepEqual(cache.stats(), {
		entries: 0,
		keys: 0,
		hits: 0,
		misses: 0,
		uncacheable: 0,
	})
})

test("the default enabled check reads the environment on every call", async () => {
	const previous = process.env.DISCOVER_FILTER_CACHE
	try {
		delete process.env.DISCOVER_FILTER_CACHE
		const cache = createFilterResultCache()
		const first = await cache.run("key", async () => result())
		process.env.DISCOVER_FILTER_CACHE = "off"
		assert.notEqual(await cache.run("key", async () => result()), first)
		delete process.env.DISCOVER_FILTER_CACHE
		assert.equal(await cache.run("key", async () => result()), first)
	} finally {
		if (previous === undefined) delete process.env.DISCOVER_FILTER_CACHE
		else process.env.DISCOVER_FILTER_CACHE = previous
	}
})

test("clear prevents an old flight from storing over a new run", async () => {
	const cache = createFilterResultCache()
	let resolve!: (value: FilterResult) => void
	const pending = cache.run(
		"key",
		() =>
			new Promise((done) => {
				resolve = done
			}),
	)
	await Promise.resolve()
	cache.clear()
	const fresh = await cache.run("key", async () => result([4]))
	resolve(result())
	await pending
	assert.equal(await cache.run("key", async () => result()), fresh)
	assert.equal(cache.stats().keys, 1)
})
