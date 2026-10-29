import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"
const { requireCategoryPage } = await import("./category-page.server.ts")
import {
	markFailedMediaResult,
	noteMediaReadFailure,
	withMediaReadHealth,
} from "./media-read-health.server.ts"

test("an empty later category page answers 404 instead of an indexable empty list", () => {
	for (const page of [2, 999999])
		assert.throws(() => requireCategoryPage(page, []), (error) =>
			error instanceof Response && error.status === 404,
		)
})

test("the first category page and populated later pages stay available", () => {
	assert.doesNotThrow(() => requireCategoryPage(1, []))
	assert.doesNotThrow(() => requireCategoryPage(2, [{ tmdb_id: 603 }]))
})

test("failed reads never turn an empty category page into a missing page", async () => {
	const failed: unknown[] = []
	markFailedMediaResult(failed)
	assert.doesNotThrow(() => requireCategoryPage(2, failed))
	await withMediaReadHealth(async () => {
		noteMediaReadFailure()
		assert.doesNotThrow(() => requireCategoryPage(2, []))
	})
})

test("member exclusions can empty an existing later page without a 404", () => {
	assert.doesNotThrow(() => requireCategoryPage(2, [], "member-id"))
	assert.doesNotThrow(() => requireCategoryPage(999999, [], "member-id"))
})
