import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { describe, test } from "node:test"

// Replace only the database boundary; the population loader and its refresh timer stay real.
const stubUrl = `data:text/javascript,${encodeURIComponent(`
 export const state = {};
 export const query = (...args) => state.query(...args);
`)}`
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}

registerHooks({
	load(url, context, next) {
		if (url.endsWith("/utils/crate.ts"))
			return {
				format: "module",
				source: `export * from ${JSON.stringify(stubUrl)}`,
				shortCircuit: true,
			}
		return next(url, context)
	},
})
const { state } = await import(stubUrl)
const DAY = 86_400_000
let instance = 0
async function freshPopulation() {
	return (await import(
		new URL(
			`./fingerprint-population.server.ts?test=${instance++}`,
			import.meta.url,
		).href
	)) as typeof import("./fingerprint-population.server.ts")
}
// Drain the query/import/refresh promise chain after advancing a fake timeout.
async function settle() {
	for (let i = 0; i < 30; i++) await Promise.resolve()
}

const rows = (count = 3000) =>
	Array.from({ length: count }, (_, i) => ({
		tmdb_id: i + 1,
		title: `Title ${i}`,
		release_year: 2024,
		poster_path: null,
		goodwatch_overall_score_normalized_percent: 80,
		fingerprint_scores: { realism: 8 },
	}))

describe("population lifetime", () => {
	test("shares first loads and serves old data throughout a daily refresh", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		const query = t.mock.fn(async (): Promise<unknown[]> => rows())
		state.query = query
		const { getFingerprintPopulation } = await freshPopulation()
		const first = getFingerprintPopulation("movie")
		assert.equal(getFingerprintPopulation("movie"), first)
		const old = await first
		assert.equal(query.mock.callCount(), 1)
		let complete: (rows: unknown[]) => void = () => {}
		query.mock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					complete = resolve
				}),
		)
		t.mock.timers.tick(DAY)
		await settle()
		assert.equal(query.mock.callCount(), 2)
		assert.equal(await getFingerprintPopulation("movie"), old)
		assert.equal(await getFingerprintPopulation("movie"), old)
		complete(rows())
		await settle()
		assert.notEqual(await getFingerprintPopulation("movie"), old)
		await getFingerprintPopulation("show")
		assert.equal(query.mock.callCount(), 3)
	})
	test("keeps old data after refresh failure and retries the next day", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		const query = t.mock.fn(async (): Promise<unknown[]> => rows())
		query.mock.mockImplementationOnce(async () => {
			throw new Error("offline")
		}, 1)
		state.query = query
		const log = t.mock.method(console, "error", () => {})
		const { getFingerprintPopulation } = await freshPopulation()
		const old = await getFingerprintPopulation("movie")
		t.mock.timers.tick(DAY)
		await settle()
		assert.equal(await getFingerprintPopulation("movie"), old)
		assert.equal(log.mock.callCount(), 1)
		t.mock.timers.tick(DAY)
		await settle()
		assert.notEqual(await getFingerprintPopulation("movie"), old)
		assert.equal(query.mock.callCount(), 3)
	})
	test("allows retrying an unsuccessful first load", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		const query = t.mock.fn(async (): Promise<unknown[]> => rows())
		query.mock.mockImplementationOnce(async () => {
			throw new Error("offline")
		})
		state.query = query
		const { getFingerprintPopulation } = await freshPopulation()
		await assert.rejects(getFingerprintPopulation("movie"), /offline/)
		await getFingerprintPopulation("movie")
		t.mock.timers.tick(DAY - 1)
		await settle()
		assert.equal(query.mock.callCount(), 2)
	})
})

for (const count of [0, 2699]) {
	test(`rejects a short first load of ${count} and retries on the next request`, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		const query = t.mock.fn(async () => rows())
		query.mock.mockImplementationOnce(async () => rows(count))
		state.query = query
		const { getFingerprintPopulation } = await freshPopulation()
		await assert.rejects(getFingerprintPopulation("movie"), /too short/)
		assert.equal((await getFingerprintPopulation("movie")).titles.length, 3000)
		assert.equal(query.mock.callCount(), 2)
	})
	test(`retains a good population after a short refresh of ${count}`, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		const query = t.mock.fn(async () => rows())
		query.mock.mockImplementationOnce(async () => rows(count), 1)
		state.query = query
		const log = t.mock.method(console, "error", () => {})
		const { getFingerprintPopulation } = await freshPopulation()
		const old = await getFingerprintPopulation("movie")
		t.mock.timers.tick(DAY)
		await settle()
		assert.equal(await getFingerprintPopulation("movie"), old)
		assert.equal(log.mock.callCount(), 1)
		t.mock.timers.tick(DAY)
		await settle()
		assert.notEqual(await getFingerprintPopulation("movie"), old)
	})
}

test("accepts exactly 90 percent of each target and uses the population-only timeout", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const query = t.mock.fn(
		async (_sql: string, _params?: unknown[], _options?: unknown) =>
			rows(_sql.includes("FROM movie") ? 2700 : 1800),
	)
	state.query = query
	const { getFingerprintPopulation, loadFingerprintTitle } =
		await freshPopulation()
	assert.equal((await getFingerprintPopulation("movie")).titles.length, 2700)
	assert.equal((await getFingerprintPopulation("show")).titles.length, 1800)
	for (const call of query.mock.calls)
		assert.deepEqual(call.arguments[2], { timeoutMs: 60_000 })
	await loadFingerprintTitle("movie", 9999)
	assert.equal(query.mock.calls[2].arguments.length, 2)
})

test("startup warms both types without waiting and logs failures", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const query = t.mock.fn(async () => {
		throw new Error("offline")
	})
	state.query = query
	const log = t.mock.method(console, "error", () => {})
	const { startFingerprintPopulation, getFingerprintPopulation } =
		await freshPopulation()
	assert.equal(startFingerprintPopulation(), undefined)
	await settle()
	assert.equal(query.mock.callCount(), 2)
	assert.equal(log.mock.callCount(), 2)
	state.query = async () => rows()
	assert.equal((await getFingerprintPopulation("movie")).titles.length, 3000)
})

test("title cache shares in-flight reads, separates types, and caches missing fingerprints and titles", async (t) => {
	const query = t.mock.fn(async (_sql: string, ids: number[]) =>
		ids[0] === 404 ? [] : [{ ...rows(1)[0], fingerprint_scores: null }],
	)
	state.query = query
	const { loadFingerprintTitle } = await freshPopulation()
	const pending = loadFingerprintTitle("movie", 1)
	assert.equal(loadFingerprintTitle("movie", 1), pending)
	const title = await pending
	assert.equal(title?.scores, null)
	assert.equal(title?.title, "Title 0")
	assert.equal(await loadFingerprintTitle("movie", 1), title)
	await loadFingerprintTitle("show", 1)
	assert.equal(await loadFingerprintTitle("movie", 404), null)
	assert.equal(await loadFingerprintTitle("movie", 404), null)
	assert.equal(query.mock.callCount(), 3)
})

test("title cache expires after one hour and retries rejected loads", async (t) => {
	t.mock.timers.enable({ apis: ["Date"] })
	const query = t.mock.fn(async () => rows(1))
	state.query = query
	const { loadFingerprintTitle } = await freshPopulation()
	await loadFingerprintTitle("movie", 1)
	t.mock.timers.tick(3_600_000 - 1)
	await loadFingerprintTitle("movie", 1)
	assert.equal(query.mock.callCount(), 1)
	t.mock.timers.tick(1)
	query.mock.mockImplementationOnce(async () => {
		throw new Error("offline")
	})
	await assert.rejects(loadFingerprintTitle("movie", 1), /offline/)
	await loadFingerprintTitle("movie", 1)
	assert.equal(query.mock.callCount(), 3)
})

test("title cache evicts the least recently used entry at 2000 titles", async (t) => {
	const query = t.mock.fn(async () => rows(1))
	state.query = query
	const { loadFingerprintTitle } = await freshPopulation()
	for (let id = 1; id <= 2000; id++) await loadFingerprintTitle("movie", id)
	await loadFingerprintTitle("movie", 1)
	await loadFingerprintTitle("movie", 2001)
	await loadFingerprintTitle("movie", 1)
	assert.equal(query.mock.callCount(), 2001)
	await loadFingerprintTitle("movie", 2)
	assert.equal(query.mock.callCount(), 2002)
})
