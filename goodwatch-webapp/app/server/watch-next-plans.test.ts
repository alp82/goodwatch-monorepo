import assert from "node:assert/strict"
import { test } from "node:test"
import { createWatchNextPlanStore } from "./watch-next-plans.server.ts"

test("plans are scoped to the member and choice, expire, and respect both memory bounds", () => {
	let now = 0
	const store = createWatchNextPlanStore<{ build: string }>({
		now: () => now,
		ttl: 10,
		maxTitles: 4,
		maxEntries: 2,
	})
	const value = { build: "original" }
	const id = store.put("owner", "match", value, 3)!
	assert.equal(store.get(id, "owner", "match"), value)
	assert.equal(store.get(id, "other", "match"), null)
	assert.equal(store.get(id, "owner", "top"), null)
	store.put("owner", "top", value, 2)
	assert.equal(store.get(id, "owner", "match"), null)
	const later = store.put("owner", "match", value, 1)!
	store.put("owner", "waiting", value, 1)
	assert.equal(store.get(later, "owner", "match"), value)
	now = 10
	assert.equal(store.get(later, "owner", "match"), null)
	assert.equal(store.put("owner", "match", value, 5), null)
})
