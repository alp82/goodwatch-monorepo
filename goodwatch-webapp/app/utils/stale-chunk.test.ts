import assert from "node:assert/strict"
import { test } from "node:test"

const { RELOAD_GUARD_MS, reloadOnStaleChunk } = await import("./stale-chunk.ts")
type StaleChunkEnv = import("./stale-chunk.ts").StaleChunkEnv

function fakeBrowser({ storage = true } = {}) {
	let time = 1_000_000
	let lastReload: number | null = null
	let reloads = 0
	const env: StaleChunkEnv = {
		now: () => time,
		readLastReload: () => lastReload,
		writeLastReload: (value) => {
			if (storage) lastReload = value
		},
		reload: () => {
			reloads++
		},
	}
	return {
		env,
		reloads: () => reloads,
		advance: (ms: number) => {
			time += ms
		},
	}
}

const failing = () => Promise.reject(new Error("Failed to fetch chunk"))
// Resolves to "pending" when the promise hasn't settled after a turn of the event loop.
const settled = (promise: Promise<unknown>) =>
	Promise.race([
		promise.then(
			() => "resolved",
			() => "rejected",
		),
		new Promise((resolve) => setTimeout(() => resolve("pending"), 10)),
	])

test("a chunk that loads is passed through", async () => {
	const browser = fakeBrowser()
	const load = reloadOnStaleChunk(
		() => Promise.resolve({ default: "module" }),
		browser.env,
	)
	assert.deepEqual(await load(), { default: "module" })
	assert.equal(browser.reloads(), 0)
})

test("a chunk that fails reloads the page once and renders nothing in between", async () => {
	const browser = fakeBrowser()
	const load = reloadOnStaleChunk(failing, browser.env)
	assert.equal(await settled(load()), "pending")
	assert.equal(browser.reloads(), 1)
})

test("a second failure right after the reload goes to the caller instead of reloading again", async () => {
	const browser = fakeBrowser()
	const load = reloadOnStaleChunk(failing, browser.env)
	await settled(load())
	browser.advance(RELOAD_GUARD_MS - 1)
	await assert.rejects(load(), /Failed to fetch chunk/)
	assert.equal(browser.reloads(), 1)
})

test("a failure long after the last reload reloads again", async () => {
	const browser = fakeBrowser()
	const load = reloadOnStaleChunk(failing, browser.env)
	await settled(load())
	browser.advance(RELOAD_GUARD_MS)
	assert.equal(await settled(load()), "pending")
	assert.equal(browser.reloads(), 2)
})

test("without storage for the guard, the error goes to the caller", async () => {
	const browser = fakeBrowser({ storage: false })
	const load = reloadOnStaleChunk(failing, browser.env)
	await assert.rejects(load(), /Failed to fetch chunk/)
	assert.equal(browser.reloads(), 0)
})

test("on the server the error goes to the caller", async () => {
	await assert.rejects(
		reloadOnStaleChunk(failing, null)(),
		/Failed to fetch chunk/,
	)
})
