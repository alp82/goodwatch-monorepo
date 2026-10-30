import assert from "node:assert/strict"
import test from "node:test"
import { discoverFetch } from "./discover-fetch.ts"

test("expanded ranked lists travel in a bounded POST body, preserving locale, filters, page and guest", async () => {
	const original = globalThis.fetch
	const ranked = Array.from({ length: 640 }, (_, i) => 1e12 + i + 1)
	let seen: { url: string; init?: RequestInit } | undefined
	globalThis.fetch = async (url, init) => {
		seen = { url: String(url), init }
		return new Response("{}")
	}
	try {
		const guest = { interactions: [], country: "DE" }
		await discoverFetch(
			`/api/discover/results?displayLanguage=de&moods=warm&page=4&ranked=${ranked}`,
			guest,
		)
		assert.equal(
			seen?.url,
			"/api/discover/results?displayLanguage=de&moods=warm&page=4",
		)
		assert.equal(seen?.init?.method, "POST")
		assert.deepEqual(JSON.parse(String(seen?.init?.body)), { guest, ranked })
		await discoverFetch("/api/discover/results?searchSet=abc&page=4", null)
		assert.equal(seen?.init?.method, undefined)
	} finally {
		globalThis.fetch = original
	}
})
