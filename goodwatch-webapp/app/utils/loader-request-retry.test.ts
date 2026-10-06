import assert from "node:assert/strict"
import { test } from "node:test"
import {
	LOADER_RETRY_DELAY_MS,
	type LoaderRetryEnv,
	keptLoaderData,
	loaderRequestUrl,
	withLoaderRetry,
} from "./loader-request-retry.ts"

const ORIGIN = "https://goodwatch.test"
const networkError = () => new TypeError("Failed to fetch")
const ok = (data: unknown) => () =>
	new Response(JSON.stringify(data), {
		headers: { "Content-Type": "application/json" },
	})

type Step = () => Response
/** A `fetch` that plays the steps in order. A step that throws is a failed request. */
function setup(
	steps: Step[],
	page: { url: string | null; data?: Record<string, unknown> } = { url: null },
) {
	const calls: string[] = []
	const waits: number[] = []
	const env: LoaderRetryEnv = {
		fetch: async (input) => {
			calls.push(String(input))
			const step = steps.shift()
			if (!step) throw new Error("unexpected request")
			return step()
		},
		origin: ORIGIN,
		wait: async (ms) => {
			waits.push(ms)
		},
		currentPage: () => page.url,
		currentLoaderData: (routeId) => page.data?.[routeId],
	}
	return { fetch: withLoaderRetry(env), calls, waits }
}
const fail: Step = () => {
	throw networkError()
}

test("only same-origin GET requests for loader data are loader requests", () => {
	const is = (url: string, init?: RequestInit) =>
		loaderRequestUrl(url, init, ORIGIN) !== null
	assert.equal(is("/?_data=routes%2F_index"), true)
	assert.equal(is(`${ORIGIN}/movie/603?_data=routes%2Fmovie.%24movieKey`), true)
	assert.equal(is("/api/streaming-providers"), false)
	assert.equal(is("/api/update-scores?_data=x", { method: "POST" }), false)
	assert.equal(is("https://other.test/?_data=root"), false)
})

test("a loader request that succeeds is sent once", async () => {
	const { fetch, calls, waits } = setup([ok({ a: 1 })])
	const response = await fetch("/?_data=root")
	assert.deepEqual(await response.json(), { a: 1 })
	assert.equal(calls.length, 1)
	assert.deepEqual(waits, [])
})

test("a network failure is retried once after the delay", async () => {
	const { fetch, calls, waits } = setup([fail, ok({ a: 2 })])
	const response = await fetch("/?_data=root")
	assert.deepEqual(await response.json(), { a: 2 })
	assert.equal(calls.length, 2)
	assert.deepEqual(waits, [LOADER_RETRY_DELAY_MS])
})

test("an error answer from the server is not retried", async () => {
	const { fetch, calls } = setup([() => new Response("down", { status: 503 })])
	const response = await fetch("/?_data=root")
	assert.equal(response.status, 503)
	assert.equal(calls.length, 1)
})

test("other requests are not retried", async () => {
	for (const [url, init] of [
		["/api/streaming-providers", undefined],
		["/api/update-scores?_data=x", { method: "POST" }],
	] as const) {
		const { fetch, calls } = setup([fail])
		await assert.rejects(() => fetch(url, init), TypeError)
		assert.equal(calls.length, 1)
	}
})

test("a cancelled request is not retried", async () => {
	const controller = new AbortController()
	const { fetch, calls } = setup([
		() => {
			controller.abort()
			throw networkError()
		},
	])
	await assert.rejects(() =>
		fetch("/?_data=root", { signal: controller.signal }),
	)
	assert.equal(calls.length, 1)
})

test("an error that isn't a network failure is not retried", async () => {
	const { fetch, calls } = setup([
		() => {
			throw new DOMException("cancelled", "AbortError")
		},
	])
	await assert.rejects(() => fetch("/?_data=root"), { name: "AbortError" })
	assert.equal(calls.length, 1)
})

test("a navigation that fails twice reports the failure", async () => {
	const { fetch, calls } = setup([fail, fail], {
		url: "/",
		data: { root: { user: null } },
	})
	await assert.rejects(
		() => fetch("/movie/603?_data=routes%2Fmovie.%24movieKey"),
		TypeError,
	)
	assert.equal(calls.length, 2)
})

test("a revalidation that fails twice keeps the route's data", async () => {
	const page = {
		url: "/discover?type=movie",
		data: { root: { user: null }, "routes/discover": { titles: [1, 2] } },
	}
	const { fetch } = setup([fail, fail, fail, fail, ok({ user: "new" })], page)
	const kept = await fetch("/discover?type=movie&_data=routes%2Fdiscover")
	assert.equal(kept.status, 200)
	assert.equal(kept.headers.get("X-Remix-Response"), "yes")
	assert.deepEqual(await kept.json(), { titles: [1, 2] })
	assert.equal(keptLoaderData("routes/discover"), true)
	assert.equal(keptLoaderData("root"), false)

	// The mark stays until the server answers for that route.
	await fetch("/discover?type=movie&_data=root")
	assert.equal(keptLoaderData("root"), true)
	await fetch("/discover?type=movie&_data=root")
	assert.equal(keptLoaderData("root"), false)
})

test("a revalidation without data to keep reports the failure", async () => {
	for (const data of [
		{},
		// Streamed data holds promises, which can't go into a response.
		{ "routes/x": { later: Promise.resolve(1) } },
	]) {
		const { fetch } = setup([fail, fail], { url: "/x", data })
		await assert.rejects(() => fetch("/x?_data=routes%2Fx"), TypeError)
	}
})
