import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { ResolutionContext } from "./resolution-job.server.ts"
const { createResolutionTmdb } = await import("./resolution-tmdb.server.ts")
test("background TMDB retries 429 after Retry-After and counts every attempt without caching failures", async () => {
	let time = 0
	let attempts = 0
	let requests = 0
	const waits: number[] = []
	const ctx = {
		job: { root: "root", deadline: 30000 },
		signal: new AbortController().signal,
		check: async () => ({}),
		attempt: async () => {
			attempts++
		},
		commit: async () => {},
	} as unknown as ResolutionContext
	const api = createResolutionTmdb({
		fetch: async () =>
			++requests === 1
				? new Response("", { status: 429, headers: { "Retry-After": "2" } })
				: Response.json({ tv_results: [], tv_episode_results: [] }),
		cache: false,
		take: async () => ({ allowed: true, store: "memory" }),
		now: () => time,
		wait: async (ms) => {
			waits.push(ms)
			time += ms
		},
	})
	assert.deepEqual(
		await api.get(ctx, "/find/100", { external_source: "tvdb_id" }),
		{ tv_results: [], tv_episode_results: [] },
	)
	assert.equal(attempts, 2)
	assert.ok(waits.reduce((a, b) => a + b, 0) >= 2000)
})
test("background lookups share four process slots even when the limiter falls back to memory", async () => {
	let active = 0
	let peak = 0
	let started = 0
	let release!: () => void
	let ready!: () => void
	const gate = new Promise<void>((r) => {
		release = r
	})
	const entered = new Promise<void>((r) => {
		ready = r
	})
	const ctx = {
		job: { root: "root", deadline: Date.now() + 30000 },
		signal: new AbortController().signal,
		check: async () => ({}),
		attempt: async () => {},
		commit: async () => {},
	} as unknown as ResolutionContext
	const api = createResolutionTmdb({
		cache: false,
		take: async () => ({ allowed: true, store: "memory" }),
		fetch: async () => {
			started++
			active++
			peak = Math.max(peak, active)
			if (started === 4) ready()
			await gate
			active--
			return Response.json({ tv_results: [], tv_episode_results: [] })
		},
	})
	const work = Promise.all(
		Array.from({ length: 8 }, (_, i) => api.get(ctx, `/find/${100 + i}`)),
	)
	await entered
	assert.equal(started, 4)
	release()
	await work
	assert.equal(peak, 4)
})
test("provider failures use at most three counted attempts and are not mistaken for a negative identity", async () => {
	let attempts = 0
	const ctx = {
		job: { root: "root", deadline: Date.now() + 30000 },
		signal: new AbortController().signal,
		check: async () => ({}),
		attempt: async () => {
			attempts++
		},
		commit: async () => assert.fail("Failures must not be cached"),
	} as unknown as ResolutionContext
	const api = createResolutionTmdb({
		cache: false,
		take: async () => ({ allowed: true, store: "memory" }),
		wait: async () => {},
		fetch: async () => new Response("", { status: 503 }),
	})
	await assert.rejects(api.get(ctx, "/find/100"), /unavailable/)
	assert.equal(attempts, 3)
})
