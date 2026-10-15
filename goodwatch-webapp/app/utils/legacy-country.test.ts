import assert from "node:assert/strict"
import { test } from "node:test"
import { mayAdoptLegacyCountry } from "./legacy-country.ts"

for (const provenance of [
	"cookie",
	"account",
	"legacy",
	"browser",
	"default",
	"identity-header",
]) {
	test(`legacy device country checks private provenance: ${provenance}`, async (t) => {
		const calls: string[] = []
		t.mock.method(
			globalThis,
			"fetch",
			async (url: string, options: RequestInit) => {
				calls.push(url)
				assert.equal(options.cache, "no-store")
				return new Response(
					JSON.stringify({
						effectiveContext: { countryProvenance: provenance },
					}),
				)
			},
		)
		const allowed = await mayAdoptLegacyCountry(
			"DE",
			"US",
			new AbortController().signal,
		)
		assert.equal(
			allowed,
			["browser", "default", "identity-header"].includes(provenance),
		)
		assert.deepEqual(calls, ["/api/media-preferences"])
	})
}

test("legacy country does not fetch for invalid/unchanged choices and does not override after a failed read", async (t) => {
	let calls = 0
	t.mock.method(globalThis, "fetch", async () => {
		calls++
		return new Response(null, { status: 503 })
	})
	const signal = new AbortController().signal
	assert.equal(await mayAdoptLegacyCountry("Germany", "US", signal), false)
	assert.equal(await mayAdoptLegacyCountry("US", "US", signal), false)
	assert.equal(calls, 0)
	assert.equal(await mayAdoptLegacyCountry("DE", "US", signal), false)
	assert.equal(calls, 1)
})
