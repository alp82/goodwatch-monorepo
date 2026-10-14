import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"
const { relatedPrefetchBudgetMs } = await import("./related-budget.ts")

test("crawler budgets", () => {
	assert.equal(relatedPrefetchBudgetMs(false), 150)
	assert.equal(relatedPrefetchBudgetMs(true), 1000)
})
