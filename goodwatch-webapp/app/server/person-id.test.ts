import assert from "node:assert/strict"
import { test as it } from "node:test"
import { validPersonId } from "./person-id.ts"

it("accepts catalog integer IDs and rejects malformed or overflowing IDs before a query", () => {
	for (const id of [1, 287, 2_147_483_647])
		assert.equal(validPersonId(id), true)
	for (const id of [0, -1, 1.5, NaN, Infinity, 2_147_483_648, 999_999_999_999])
		assert.equal(validPersonId(id), false)
})
