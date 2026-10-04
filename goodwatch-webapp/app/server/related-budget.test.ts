import "@tanstack/react-query"
import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"
const { relatedPrefetchBudgetMs } = await import("./related-budget.ts")
const { prefetchRelatedState } = await import("./related-prefetch.ts")
const { renderMetrics, resetMetricsForTest } = await import(
	"./metrics/registry.server.ts"
)
const params = { tmdbId: 42, sourceMediaType: "movie" as const }
const panel = { movies: [], shows: [] }

test("crawler budgets and fast, slow, failing lookups", async (t) => {
	resetMetricsForTest()
	t.mock.method(console, "error", () => {})
	assert.equal(relatedPrefetchBudgetMs(false), 150)
	assert.equal(relatedPrefetchBudgetMs(true), 1000)
	const fast = await prefetchRelatedState(
		{ ...params, budgetMs: 1000 },
		async () => panel,
	)
	assert.equal(fast.queries.length, 1)
	let finish: (value: typeof panel) => void = () => {}
	let completed = false
	const pending = new Promise<typeof panel>((resolve) => {
		finish = resolve
	}).then((value) => {
		completed = true
		return value
	})
	const slow = await prefetchRelatedState(
		{ ...params, budgetMs: 1 },
		() => pending,
	)
	assert.deepEqual(slow, { mutations: [], queries: [] })
	assert.equal(completed, false)
	finish(panel)
	await pending
	assert.equal(completed, true)
	assert.deepEqual(slow, { mutations: [], queries: [] })
	const failed = await prefetchRelatedState(params, async () => {
		throw new Error("failed")
	})
	assert.deepEqual(failed, { mutations: [], queries: [] })
	let reject: (reason: Error) => void = () => {}
	const late = new Promise<typeof panel>((_, r) => {
		reject = r
	})
	await prefetchRelatedState({ ...params, budgetMs: 1 }, () => late)
	reject(new Error("late failure"))
	await new Promise((resolve) => setImmediate(resolve))
	const metrics = renderMetrics()
	for (const [result, count] of [
		["embedded", 1],
		["budget", 2],
		["error", 1],
	])
		assert.ok(
			metrics.includes(
				`goodwatch_related_prefetch_total{source="movie",result="${result}"} ${count}`,
			),
		)
})
