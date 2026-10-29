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

describe("population lifetime", () => {
	test("shares first loads and serves old data throughout a daily refresh", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		const query = t.mock.fn(async (): Promise<unknown[]> => [])
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
		complete([])
		await settle()
		assert.notEqual(await getFingerprintPopulation("movie"), old)
		await getFingerprintPopulation("show")
		assert.equal(query.mock.callCount(), 3)
	})
	test("keeps old data after refresh failure and retries the next day", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		const query = t.mock.fn(async (): Promise<unknown[]> => [])
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
		const query = t.mock.fn(async (): Promise<unknown[]> => [])
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
