import assert from "node:assert/strict"
import { test } from "node:test"
import { sampleContext, guestMarksKey } from "./sample-context.server.ts"
import { titleKey } from "../../utils/title-key.ts"
import type { ViewerContext } from "../viewer.server.ts"

const keys = Array.from({length:6}, (_,i) => titleKey("movie",900000+i))
const guest = (): ViewerContext => ({
	viewer:{kind:"guest",progress:{interactions:[]}}, country:"US", services:[], forYou:true,
	ratings:new Map([[keys[0],9]]), seen:new Set([keys[1]]), wishlist:new Map([[keys[2],new Date(0)]]),
	skipped:new Set([keys[3]]), notInterested:new Set([keys[4]]), hidden:new Set([keys[5]]),
})
test("sample signals stay fixed, while every guest mark is excluded from suggestions", () => {
	const ctx = guest(), sample = sampleContext(ctx)
	assert.ok(sample.ratings.size > 4)
	assert.ok(!sample.ratings.has(keys[0]))
	for (const key of keys) assert.ok(sample.hidden.has(key), `excluded ${key}`)
	assert.equal(sample.skipped.size, 0)
	for (const key of sample.ratings.keys()) assert.ok(sample.seen.has(key))
	assert.ok(sample.wishlist.size > 0)
	assert.deepEqual(sample.ratings, sampleContext({...ctx, ratings:new Map()}).ratings)
})
test("sample cache identity changes for each guest set and is stable across insertion order", () => {
	const original = guestMarksKey(guest())
	for (const field of ["ratings","seen","wishlist","skipped","notInterested","hidden"] as const) {
		const ctx = guest()
		assert.notEqual(guestMarksKey({...ctx,[field]:field === "ratings" || field === "wishlist" ? new Map() : new Set()}),original)
	}
	const ctx = guest()
	assert.equal(guestMarksKey({...ctx,seen:new Set([...ctx.seen].reverse())}),original)
})
