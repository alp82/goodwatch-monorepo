// The title page's "What's new on Netflix" (#489): both title loaders read which /new pages exist with newPagesNow,
// the lookup of newPagesSnapshot. A lookup only reads: cold it answers null at once, never a promise, and starts no
// load, so a title request never waits for the links and never starts their build. The server loads them at start
// and on a timer (refreshIfDue). Incomplete links never replace complete ones. The title route modules are TSX and
// can't load under node --test; their loaders call newPagesNow without awaiting it.
import "@remix-run/node"
import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const { newPagesSnapshot } = await import("./new-on-services-page.server.ts")

const OPTIONS = { maxAgeMs: 600_000, retryMs: 60_000 }
const LINKS = {
	pages: [
		{ country: "US", brand: "netflix", titles: 40, latest: null },
		{ country: "US", brand: null, titles: 60, latest: null },
		{ country: "DE", brand: "hulu", titles: 3, latest: null },
	],
	failed: [],
}

test("cold, a title request's lookup answers null at once, never a promise, and starts no load", () => {
	let loads = 0
	const snapshot = newPagesSnapshot(() => {
		loads++
		return new Promise(() => {})
	}, OPTIONS)
	const started = performance.now()
	const answers = [snapshot.lookup("US"), snapshot.lookup("US"), snapshot.lookup("DE")]
	assert.deepEqual(answers, [null, null, null])
	assert.ok(answers.every((answer) => !((answer as unknown) instanceof Promise)))
	assert.ok(performance.now() - started < 50)
	assert.equal(loads, 0)
})

test("after the server's refresh, the lookup names the brands with a page in the country", async () => {
	const snapshot = newPagesSnapshot(async () => LINKS, OPTIONS)
	await snapshot.refreshIfDue()
	assert.deepEqual(snapshot.lookup("US"), { country: "US", brands: ["netflix"] })
	assert.deepEqual(snapshot.lookup("FR"), { country: "FR", brands: [] })
})

test("incomplete links never replace complete ones; cold, they leave the lookup empty", async () => {
	const results = [LINKS, { pages: [], failed: ["US"] }]
	let loads = 0
	let time = 0
	const realNow = Date.now
	Date.now = () => time
	try {
		const snapshot = newPagesSnapshot(async () => results[Math.min(loads++, 1)], OPTIONS)
		await snapshot.refreshIfDue()
		time += OPTIONS.maxAgeMs + 1
		await snapshot.refreshIfDue()
		assert.equal(loads, 2)
		assert.deepEqual(snapshot.lookup("US"), { country: "US", brands: ["netflix"] })
		const cold = newPagesSnapshot(async () => ({ pages: [], failed: ["US"] }), OPTIONS)
		await cold.refreshIfDue()
		assert.equal(cold.lookup("US"), null)
	} finally {
		Date.now = realNow
	}
})
