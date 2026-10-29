import assert from "node:assert/strict"
import { test } from "node:test"
import { titleSocialQuery } from "./query.ts"

test("pending title data retries at 1500 ms and stops after three updates", () => {
	const { refetchInterval } = titleSocialQuery({ mediaType: "movie", tmdbId: 603 })
	for (const count of [1, 2]) assert.equal(refetchInterval({ state: { data: { items: [], buzz: null, pending: true }, dataUpdateCount: count } }), 1500)
	for (const count of [3, 4]) assert.equal(refetchInterval({ state: { data: { items: [], buzz: null, pending: true }, dataUpdateCount: count } }), false)
	assert.equal(refetchInterval({ state: { data: { items: [], buzz: null }, dataUpdateCount: 1 } }), false)
})
