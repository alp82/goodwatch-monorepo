import assert from "node:assert/strict"
import { test } from "node:test"
import {
	TvdbLookupBudgetExceeded,
	createTvdbLookup,
} from "./tvdb-lookup.server.ts"

test("TVDB lookups respect Retry-After before retrying and reuse only successful evidence", async (t) => {
	let clock = Date.parse("2026-10-19T00:00:00Z")
	const waits: number[] = []
	let requests = 0
	t.mock.method(globalThis, "fetch", async () => {
		if (++requests === 1)
			return new Response("", { status: 429, headers: { "Retry-After": "2" } })
		return new Response(
			JSON.stringify({ tv_results: [{ id: 1668 }], tv_episode_results: [] }),
		)
	})
	const lookup = createTvdbLookup({
		now: () => clock,
		wait: async (ms) => {
			waits.push(ms)
			clock += ms
		},
	})
	assert.equal((await lookup(100)).tv_results[0].id, 1668)
	assert.deepEqual(waits, [2000])
	await lookup(100)
	assert.equal(requests, 2)
})

test("TVDB requests have bounded concurrency and fail open when the overall lookup budget expires", async (t) => {
	let active = 0
	let peak = 0
	let requests = 0
	let clock = 0
	const finish: Array<() => void> = []
	t.mock.method(globalThis, "fetch", async () => {
		requests++
		active++
		peak = Math.max(peak, active)
		return new Promise<Response>((resolve) =>
			finish.push(() => {
				active--
				resolve(
					new Response(
						JSON.stringify({ tv_results: [], tv_episode_results: [] }),
					),
				)
			}),
		)
	})
	const lookup = createTvdbLookup({
		concurrency: 2,
		budgetMs: 100,
		now: () => clock,
	})
	const all = Promise.all([1, 2, 3, 4].map((id) => lookup(id)))
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(peak, 2)
	finish.splice(0).forEach((resolve) => resolve())
	await new Promise((resolve) => setImmediate(resolve))
	finish.splice(0).forEach((resolve) => resolve())
	await all
	assert.equal(peak, 2)
	clock = 100
	await assert.rejects(lookup(5), TvdbLookupBudgetExceeded)
	assert.equal(requests, 4)
})

test("failed and malformed TVDB responses are not retained as negative identity evidence", async (t) => {
	for (const status of [503, 200]) {
		let requests = 0
		t.mock.method(globalThis, "fetch", async () =>
			++requests === 1
				? new Response("{}", { status })
				: new Response(
						JSON.stringify({
							tv_results: [{ id: 1668 }],
							tv_episode_results: [],
						}),
					),
		)
		const lookup = createTvdbLookup()
		await assert.rejects(lookup(100), /unavailable.*retry/)
		assert.equal((await lookup(100)).tv_results[0].id, 1668)
		assert.equal(requests, 2)
	}
})

test("TVDB Retry-After dates, exponential fallback, request caps and exhausted budgets bound retries", async (t) => {
	for (const header of [
		new Date(Date.parse("2026-10-19T00:00:00Z") + 2000).toUTCString(),
		null,
	]) {
		let clock = Date.parse("2026-10-19T00:00:00Z")
		let requests = 0
		const waits: number[] = []
		t.mock.method(globalThis, "fetch", async () =>
			++requests === 1
				? new Response("", {
						status: 429,
						headers: header ? { "Retry-After": header } : {},
					})
				: new Response(JSON.stringify({ tv_results: [] })),
		)
		const lookup = createTvdbLookup({
			now: () => clock,
			wait: async (ms) => {
				waits.push(ms)
				clock += ms
			},
		})
		await lookup(100)
		assert.deepEqual(waits, header ? [2000] : [500])
	}
	let requests = 0
	t.mock.method(globalThis, "fetch", async () => {
		requests++
		return new Response(JSON.stringify({ tv_results: [] }))
	})
	const capped = createTvdbLookup({ maxRequests: 1 })
	await capped(100)
	await assert.rejects(capped(101), TvdbLookupBudgetExceeded)
	assert.equal(requests, 1)
	requests = 0
	t.mock.method(globalThis, "fetch", async () => {
		requests++
		return new Response("", { status: 429, headers: { "Retry-After": "60" } })
	})
	const expired = createTvdbLookup({
		budgetMs: 100,
		wait: async () => assert.fail("Must not wait beyond the budget"),
	})
	await assert.rejects(expired(100), TvdbLookupBudgetExceeded)
	assert.equal(requests, 1)
	let clock = 0
	requests = 0
	t.mock.method(globalThis, "fetch", async () => {
		requests++
		return new Response("", { status: 429 })
	})
	const repeated = createTvdbLookup({
		now: () => clock,
		wait: async (ms) => {
			clock += ms
		},
	})
	await assert.rejects(repeated(100), /unavailable.*retry/)
	assert.equal(requests, 3)
})

test("an in-flight TVDB request cannot outlive the remaining preview budget", async (t) => {
	let signal: AbortSignal | undefined
	t.mock.method(
		globalThis,
		"fetch",
		async (_url: unknown, init: RequestInit) => {
			signal = init.signal ?? undefined
			return new Promise<Response>(() => {})
		},
	)
	const lookup = createTvdbLookup({ now: () => 0, budgetMs: 20 })
	await assert.rejects(lookup(100), TvdbLookupBudgetExceeded)
	assert.equal(signal?.aborted, true)
})
