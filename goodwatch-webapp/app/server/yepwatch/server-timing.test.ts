import assert from "node:assert/strict"
import test from "node:test"
import { measured, timed, withServerTiming } from "./server-timing.ts"

test("an answer carries the request's timed steps and its total; outside a request nothing is kept", async () => {
	const response = await withServerTiming(async () => {
		await timed("read", new Promise((resolve) => setTimeout(resolve, 5)))
		await timed("read", Promise.resolve())
		await timed("seen", Promise.reject(new Error("refused"))).catch(() => {})
		return new Response("{}")
	})
	const header = response.headers.get("server-timing") ?? ""
	assert.match(header, /^read;dur=\d+\.\d, seen;dur=\d+\.\d, total;dur=\d+\.\d$/)
	assert.ok(Number(/read;dur=([\d.]+)/.exec(header)![1]) >= 4)
	assert.equal(await timed("outside", Promise.resolve(7)), 7)
})

test("background work started inside a request keeps its own marks, not the request's", async () => {
	let reported: { marks: Record<string, number>; totalMs: number } | undefined
	let build: Promise<number> | undefined
	const response = await withServerTiming(async () => {
		build = measured(async () => {
			await timed("availability", new Promise((resolve) => setTimeout(resolve, 5)))
			return 7
		}, (marks, totalMs) => { reported = { marks, totalMs } })
		return new Response("{}")
	})
	assert.equal(await build, 7)
	await new Promise((resolve) => setImmediate(resolve))
	assert.match(response.headers.get("server-timing") ?? "", /^total;dur=/)
	assert.deepEqual(Object.keys(reported!.marks), ["availability"])
	assert.ok(reported!.marks.availability >= 4 && reported!.totalMs >= reported!.marks.availability)
	// A failed build reports too, and still fails.
	let failed = false
	await assert.rejects(measured(() => Promise.reject(new Error("no deck")), () => { failed = true }))
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(failed, true)
})
