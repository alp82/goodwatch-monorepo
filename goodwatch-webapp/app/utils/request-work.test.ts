import assert from "node:assert/strict"
import { test } from "node:test"
import {
	requestServerTiming,
	requestWork,
	timeRequestWork,
} from "./request-work.ts"

test("concurrent callers share work and separate requests do not", async () => {
	let calls = 0
	const resolve = requestWork(async () => ++calls)
	const first = new Request("http://localhost/")
	const a = resolve(first)
	assert.equal(a, resolve(first))
	assert.deepEqual(await Promise.all([a, resolve(first)]), [1, 1])
	assert.equal(await resolve(new Request(first)), 2)
})

test("failures are shared only within the request", async () => {
	let calls = 0
	const resolve = requestWork(async () => {
		calls++
		throw new Error("failed")
	})
	const request = new Request("http://localhost/")
	await Promise.allSettled([resolve(request), resolve(request)])
	assert.equal(calls, 1)
	await assert.rejects(resolve(new Request(request)))
	assert.equal(calls, 2)
})

test("timings contain only durations and stay within the request", async () => {
	const request = new Request("http://localhost/private")
	await timeRequestWork(request, "session", async () => "member-secret")
	assert.match(
		requestServerTiming(request) ?? "",
		/^session;dur=\d+\.\d, total;dur=\d+\.\d$/,
	)
	assert.equal(requestServerTiming(new Request(request)), undefined)
})

test("loader timing preserves JSON, status, cookies and cache policy", async () => {
	const { withRequestTiming } = await import("./request-work.ts")
	const request = new Request("http://localhost/")
	const response = new Response(JSON.stringify({ complete: true }), {
		status: 201,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "private, no-store",
			"Set-Cookie": "refresh=test",
		},
	})
	const result = await withRequestTiming(async () => response)({ request })
	assert.equal(result, response)
	assert.equal(result.status, 201)
	assert.equal(result.headers.get("Cache-Control"), "private, no-store")
	assert.equal(result.headers.get("Set-Cookie"), "refresh=test")
	assert.deepEqual(await result.json(), { complete: true })
	assert.match(result.headers.get("Server-Timing") ?? "", /^total;dur=\d+\.\d$/)
	const plain = await withRequestTiming(async () => ({ complete: true }))({
		request,
	})
	assert.ok(plain instanceof Response)
	assert.deepEqual(await plain.json(), { complete: true })
})
