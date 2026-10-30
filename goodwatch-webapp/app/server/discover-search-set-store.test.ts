import assert from "node:assert/strict"
import test from "node:test"
import {
	createSearchSetStore,
	SEARCH_SET_TTL,
} from "./discover-search-set-store.ts"

test("a ranked set survives another server instance, without storing search text", async () => {
	const saved = new Map<string, string>()
	const redis = {
		get: async (key: string) => saved.get(key) ?? null,
		setex: async (key: string, ttl: number, value: string) => {
			assert.equal(ttl, SEARCH_SET_TTL)
			saved.set(key, value)
		},
	}
	const keys = Array.from({ length: 640 }, (_, i) => 1e12 + i + 1)
	const token = "ab".repeat(16)
	assert.equal(await createSearchSetStore(() => redis).save(token, keys), true)
	assert.deepEqual(await createSearchSetStore(() => redis).load(token), keys)
	assert.equal(saved.size, 1)
	assert.equal(await createSearchSetStore(() => redis).load("invalid"), null)
	saved.clear()
	assert.equal(await createSearchSetStore(() => redis).load(token), null)
})

test("cache failure allows the caller to retain its list; invalid cached data never becomes title keys", async () => {
	const token = "cd".repeat(16)
	const absent = createSearchSetStore(() => null)
	assert.equal(await absent.save(token, [1e12 + 1]), false)
	assert.equal(await absent.load(token), null)
	const corrupt = createSearchSetStore(() => ({
		get: async () => '["query text",0]',
		setex: async () => {
			throw Error("offline")
		},
	}))
	assert.equal(await corrupt.save(token, [1e12 + 1]), false)
	assert.equal(await corrupt.load(token), null)
})
