// The search page against the answers a search can get once the search roles sit behind the proxy: the status line
// shows the busy message with Retry for a bare 502, 503, or 504 and for a request without an answer, as it does for
// the search role's own busy answer. Nothing is requested twice.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import { SEARCH_BUSY_MESSAGE as SERVER_BUSY_MESSAGE } from "../../server/search-runtime/admission.server.ts"
import {
	busyAnswer,
	gatewayAnswers,
	networkError,
	streamAnswer,
	stubFetch,
} from "./search-test-answers.ts"

const {
	SEARCH_BUSY_MESSAGE,
	SEARCH_PAGE_UNAVAILABLE,
	offerRetry,
	requestSearch,
} = await import("./search-client.ts")
const { classifySearchResponse } = await import("./search-request.ts")

// What the search page's query does with one search: the status line shows the rejection's message.
const searchPage = (signal = new AbortController().signal) => {
	const readings: unknown[] = []
	const batch = requestSearch({
		body: { q: "heist movies", includeAdult: false, filters: {} },
		signal,
		onReading: (chips) => readings.push(chips),
		unavailable: SEARCH_PAGE_UNAVAILABLE,
	})
	return { batch, readings }
}
const statusOf = async (batch: Promise<unknown>) => {
	const error = await batch.then(
		() => null,
		(reason: unknown) => reason,
	)
	assert.ok(error instanceof Error, "the search rejects with an Error")
	return error.message
}

test("the browser's busy message is the server's", () => {
	assert.equal(SEARCH_BUSY_MESSAGE, SERVER_BUSY_MESSAGE)
})

test("the search role's busy answer shows its message with Retry, as before", async (t) => {
	const fetched = stubFetch(t, busyAnswer)
	const status = await statusOf(searchPage().batch)
	assert.equal(status, SERVER_BUSY_MESSAGE)
	assert.equal(offerRetry(status), true)
	assert.equal(fetched.mock.callCount(), 1)
})

for (const [name, answer] of Object.entries(gatewayAnswers))
	test(`${name} shows the busy message with Retry`, async (t) => {
		const fetched = stubFetch(t, answer)
		const status = await statusOf(searchPage().batch)
		assert.equal(status, SEARCH_BUSY_MESSAGE)
		assert.equal(offerRetry(status), true)
		assert.equal(fetched.mock.callCount(), 1, "no automatic retry")
	})

test("a request without an answer shows the busy message with Retry", async (t) => {
	const fetched = stubFetch(t, () => {
		throw networkError()
	})
	const status = await statusOf(searchPage().batch)
	assert.equal(status, SEARCH_BUSY_MESSAGE)
	assert.equal(offerRetry(status), true)
	assert.equal(fetched.mock.callCount(), 1, "no automatic retry")
})

test("a stream that breaks off partway shows the busy message", async (t) => {
	stubFetch(
		t,
		() =>
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode('{"kind":"reading","reading":[]}\n'),
						)
						controller.error(new TypeError("network error"))
					},
				}),
			),
	)
	assert.equal(await statusOf(searchPage().batch), SEARCH_BUSY_MESSAGE)
})

test("a cancelled search keeps its own error, so it isn't shown as busy", async (t) => {
	const cancelled = new AbortController()
	cancelled.abort()
	stubFetch(t, () => {
		throw new DOMException("The operation was aborted.", "AbortError")
	})
	const error = await searchPage(cancelled.signal).batch.catch(
		(reason: unknown) => reason,
	)
	assert.equal((error as Error).name, "AbortError")
})

test("a 200 whose body isn't the stream rejects with the page's own message", async (t) => {
	for (const body of ["<html><body>Welcome</body></html>", "null\n", ""]) {
		stubFetch(t, () => new Response(body))
		const status = await statusOf(searchPage().batch)
		assert.equal(status, SEARCH_PAGE_UNAVAILABLE)
		assert.equal(offerRetry(status), true)
	}
})

test("a refusal with a message of its own shows that message", async (t) => {
	stubFetch(t, () => Response.json({ error: "Search is too long" }, { status: 413 }))
	const status = await statusOf(searchPage().batch)
	assert.equal(status, "Search is too long")
	assert.equal(offerRetry(status), false)
})

test("the route's 503 for a failed search keeps its own message", async (t) => {
	stubFetch(t, () => Response.json({ error: SEARCH_PAGE_UNAVAILABLE }, { status: 503 }))
	assert.equal(await statusOf(searchPage().batch), SEARCH_PAGE_UNAVAILABLE)
})

test("a refusal without a message shows the page's own", async (t) => {
	stubFetch(t, () => new Response("Internal Server Error", { status: 500 }))
	assert.equal(await statusOf(searchPage().batch), SEARCH_PAGE_UNAVAILABLE)
})

test("the ranked stream gives the reading first and then the batch", async (t) => {
	const batch = { q: "heist movies", rows: [], errors: [] }
	stubFetch(t, () =>
		streamAnswer({ kind: "reading", reading: [{ label: "heist" }] }, { kind: "batch", batch }),
	)
	const search = searchPage()
	assert.deepEqual(await search.batch, batch)
	assert.deepEqual(search.readings, [[{ label: "heist" }]])
})

test("an error inside the stream shows its message", async (t) => {
	stubFetch(t, () => streamAnswer({ kind: "error", error: "Search is unavailable right now." }))
	assert.equal(await statusOf(searchPage().batch), "Search is unavailable right now.")
})

test("each answer is one of four kinds", async () => {
	assert.deepEqual(await classifySearchResponse(streamAnswer()), { kind: "stream" })
	assert.deepEqual(await classifySearchResponse(busyAnswer()), {
		kind: "busy",
		message: SERVER_BUSY_MESSAGE,
	})
	for (const answer of Object.values(gatewayAnswers))
		assert.deepEqual(await classifySearchResponse(answer()), { kind: "gateway" })
	// JSON that isn't the busy answer's shape is still the proxy's.
	assert.deepEqual(await classifySearchResponse(Response.json(["down"], { status: 502 })), {
		kind: "gateway",
	})
	assert.deepEqual(await classifySearchResponse(new Response("nope", { status: 500 })), {
		kind: "other",
		message: null,
	})
	assert.deepEqual(
		await classifySearchResponse(Response.json({ error: "Invalid origin" }, { status: 403 })),
		{ kind: "other", message: "Invalid origin" },
	)
})
