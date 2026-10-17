import assert from "node:assert/strict"
import { test } from "node:test"
import { writeSelected } from "./schemas.ts"

test("title writes accept redundant selectors and require an ID or a name", () => {
	assert.ok(
		writeSelected.safeParse({
			title_id: "movie:329865",
			title_name: "Arrival",
			year: 2016,
		}).success,
	)
	assert.ok(writeSelected.safeParse({ title_id: "movie:329865" }).success)
	assert.ok(
		writeSelected.safeParse({ title_name: "Arrival", year: 2016 }).success,
	)
	assert.equal(writeSelected.safeParse({ year: 2016 }).success, false)
})
