import assert from "node:assert/strict"
import { test } from "node:test"
import { pageHeaders } from "./headers.ts"

test("page headers preserve a temporary failure's Retry-After through the error boundary", () => {
	const headers = new Headers(
		pageHeaders({
			parentHeaders: new Headers({ "Cache-Control": "public, s-maxage=1800" }),
			loaderHeaders: new Headers(),
			actionHeaders: new Headers(),
			errorHeaders: new Headers({
				"Cache-Control": "private, no-store",
				"Retry-After": "5",
			}),
		}),
	)
	assert.equal(headers.get("Retry-After"), "5")
	assert.equal(headers.get("Cache-Control"), "private, no-store")
})

test("page headers allow a child to shorten the shared lifetime, with privacy taking precedence", () => {
	const parent = "public, s-maxage=1800, stale-while-revalidate=7200"
	const short = "public, s-maxage=10, stale-while-revalidate=10"
	for (const [parentPolicy, loaderPolicy, expected] of [
		[parent, short, short],
		[short, parent, short],
		["private, no-store", short, "private, no-store"],
		[parent, "private, no-store", "private, no-store"],
		["", short, short],
	]) {
		const headers = pageHeaders({
			parentHeaders: new Headers(
				parentPolicy ? { "Cache-Control": parentPolicy } : {},
			),
			loaderHeaders: new Headers({ "Cache-Control": loaderPolicy }),
			actionHeaders: new Headers(),
			errorHeaders: new Headers(),
		})
		assert.equal(new Headers(headers).get("Cache-Control"), expected)
	}
	for (const source of [
		"parentHeaders",
		"loaderHeaders",
		"actionHeaders",
		"errorHeaders",
	] as const) {
		const inputs = {
			parentHeaders: new Headers({ "Cache-Control": parent }),
			loaderHeaders: new Headers({ "Cache-Control": short }),
			actionHeaders: new Headers(),
			errorHeaders: new Headers(),
		}
		inputs[source].set("Set-Cookie", "a=b")
		assert.equal(
			new Headers(pageHeaders(inputs)).get("Cache-Control"),
			"private, no-store",
		)
	}
})

test("preserves parent, child and thrown-response timing in document headers", () => {
	const headers = new Headers(
		pageHeaders({
			parentHeaders: new Headers({ "Server-Timing": "session;dur=12.0" }),
			loaderHeaders: new Headers({ "Server-Timing": "data;dur=350.0" }),
			actionHeaders: new Headers(),
			errorHeaders: new Headers({
				"Server-Timing": "total;dur=400.0",
				"Cache-Control": "private, no-store",
				"Retry-After": "2",
			}),
		}),
	)
	assert.equal(
		headers.get("Server-Timing"),
		"session;dur=12.0, data;dur=350.0, total;dur=400.0",
	)
	assert.equal(headers.get("Cache-Control"), "private, no-store")
	assert.equal(headers.get("Retry-After"), "2")
})

test("adds timings to a thrown loader Response without changing its status or retry policy", async () => {
	const { withRequestTiming, timeRequestWork } = await import(
		"./request-work.ts"
	)
	const response = new Response("temporarily unavailable", {
		status: 503,
		headers: { "Cache-Control": "private, no-store", "Retry-After": "2" },
	})
	const request = new Request("http://localhost/hot-on-socials")
	const load = withRequestTiming(async ({ request }: { request: Request }) => {
		await timeRequestWork(request, "data", async () => {
			throw response
		})
	})
	await assert.rejects(load({ request }), (error) => error === response)
	assert.match(
		response.headers.get("Server-Timing") ?? "",
		/data;dur=\d+\.\d, total;dur=\d+\.\d/,
	)
	assert.equal(response.status, 503)
	assert.equal(response.headers.get("Retry-After"), "2")
})
