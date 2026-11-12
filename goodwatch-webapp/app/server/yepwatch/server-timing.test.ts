import assert from "node:assert/strict"
import test from "node:test"
import { timed, withServerTiming } from "./server-timing.ts"

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
