import assert from "node:assert/strict"
import test from "node:test"
import { drain, fetchWithTimeout } from "./fetch-timeout.ts"

test("the timeout never outlives the request, so a late abort can't fire on a finished response", async () => {
	let signal: AbortSignal | undefined
	const send = (async (_url: string, init: RequestInit) => {
		signal = init.signal ?? undefined
		return new Response("ignored body")
	}) as typeof fetch
	const status = await fetchWithTimeout(send, "https://example.test", {}, 20, async (response) => {
		await drain(response)
		return response.status
	})
	assert.equal(status, 200)
	await new Promise((resolve) => setTimeout(resolve, 40))
	assert.equal(signal?.aborted, false)
})

test("a slow request is aborted after the timeout", async () => {
	const send = ((_url: string, init: RequestInit) =>
		new Promise((_resolve, reject) => {
			init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
		})) as typeof fetch
	await assert.rejects(
		fetchWithTimeout(send, "https://example.test", {}, 10, async () => 1),
		/aborted/,
	)
})
