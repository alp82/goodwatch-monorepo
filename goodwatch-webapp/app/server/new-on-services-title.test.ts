// The title page's "More new on Netflix" (#489): both title loaders read which /new pages exist with newPagesNow,
// built by newPagesLookup, and never wait for it. Cold, while the links build takes as long as it takes, the lookup
// answers null at once (not a promise) and starts one load; once loaded it names the country's brands. The title
// route modules are TSX and can't load under node --test; their loaders call newPagesNow without awaiting it.
import "@remix-run/node"
import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const { newPagesLookup } = await import("./new-on-services-page.server.ts")

const flush = () => new Promise((resolve) => setImmediate(resolve))
const LINKS = {
	pages: [
		{ country: "US", brand: "netflix", titles: 40, latest: null },
		{ country: "US", brand: null, titles: 60, latest: null },
		{ country: "DE", brand: "hulu", titles: 3, latest: null },
	],
	failed: [],
}

test("cold, the title page's lookup answers null at once, never a promise, and starts one load", async () => {
	let loads = 0
	const lookup = newPagesLookup(
		() => {
			loads++
			return new Promise(() => {})
		},
		{ maxAgeMs: 600_000, retryMs: 60_000 },
	)
	const started = performance.now()
	const answers = [lookup("US"), lookup("US"), lookup("DE")]
	const took = performance.now() - started
	assert.deepEqual(answers, [null, null, null])
	assert.ok(answers.every((answer) => !((answer as unknown) instanceof Promise)))
	assert.ok(took < 50, `took ${took} ms`)
	await flush()
	assert.equal(loads, 1)
})

test("once the links are in, the lookup names the brands with a page in the country", async () => {
	let finish: (links: typeof LINKS) => void = () => {}
	const lookup = newPagesLookup(
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
		{ maxAgeMs: 600_000, retryMs: 60_000 },
	)
	assert.equal(lookup("US"), null)
	finish(LINKS)
	await flush()
	assert.deepEqual(lookup("US"), { country: "US", brands: ["netflix"] })
	assert.deepEqual(lookup("FR"), { country: "FR", brands: [] })
})

test("a failed load leaves the lookup answering null, not throwing", async () => {
	const lookup = newPagesLookup(() => Promise.reject(new Error("Crate is down")), {
		maxAgeMs: 600_000,
		retryMs: 60_000,
	})
	assert.equal(lookup("US"), null)
	await flush()
	assert.equal(lookup("US"), null)
})
