// A search request against the answers a search can get once the search roles sit behind the proxy: it rejects with
// the busy message for a bare 502, 503, or 504 and for a request without an answer, as it does for the search role's
// own busy answer. Nothing is requested twice.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import { SEARCH_BUSY_MESSAGE as SERVER_BUSY_MESSAGE } from "../../server/search-runtime/admission.server.ts"
import {
	busyAnswer,
	gatewayAnswers,
	limitedAnswer,
	networkError,
	streamAnswer,
	stubFetch,
} from "./search-test-answers.ts"

const { SEARCH_BUSY_MESSAGE, SEARCH_LIMITED_MESSAGE, requestSearch } = await import(
	"./search-client.ts"
)
const { classifySearchResponse } = await import("./search-request.ts")

// What the caller says when the search failed and the server didn't say why.
const UNAVAILABLE = "Search is unavailable. Your previous results are kept."

// One search, as a caller makes it: its status line shows the rejection's message.
const oneSearch = (signal = new AbortController().signal) => {
	const readings: unknown[] = []
	const batch = requestSearch({
		body: { q: "heist movies", includeAdult: false, filters: {} },
		signal,
		onReading: (chips) => readings.push(chips),
		unavailable: UNAVAILABLE,
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

test("the search role's busy answer shows its message, as before", async (t) => {
	const fetched = stubFetch(t, busyAnswer)
	const status = await statusOf(oneSearch().batch)
	assert.equal(status, SERVER_BUSY_MESSAGE)
	assert.equal(fetched.mock.callCount(), 1)
})

for (const [name, answer] of Object.entries(gatewayAnswers))
	test(`${name} shows the busy message`, async (t) => {
		const fetched = stubFetch(t, answer)
		const status = await statusOf(oneSearch().batch)
		assert.equal(status, SEARCH_BUSY_MESSAGE)
		assert.equal(fetched.mock.callCount(), 1, "no automatic retry")
	})

test("the search limit's 429 shows the calm limit message, not an error, and isn't retried", async (t) => {
	for (const answer of [
		limitedAnswer,
		// A 429 from anywhere else on the way (no JSON body) reads the same.
		() => new Response(null, { status: 429, headers: { "Retry-After": "30" } }),
		() => new Response("Too Many Requests", { status: 429 }),
	]) {
		const fetched = stubFetch(t, answer)
		assert.equal(await statusOf(oneSearch().batch), SEARCH_LIMITED_MESSAGE)
		assert.equal(fetched.mock.callCount(), 1, "no automatic retry")
	}
})

test("a request without an answer shows the busy message", async (t) => {
	const fetched = stubFetch(t, () => {
		throw networkError()
	})
	const status = await statusOf(oneSearch().batch)
	assert.equal(status, SEARCH_BUSY_MESSAGE)
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
	assert.equal(await statusOf(oneSearch().batch), SEARCH_BUSY_MESSAGE)
})

test("a cancelled search keeps its own error, so it isn't shown as busy", async (t) => {
	const cancelled = new AbortController()
	cancelled.abort()
	stubFetch(t, () => {
		throw new DOMException("The operation was aborted.", "AbortError")
	})
	const error = await oneSearch(cancelled.signal).batch.catch(
		(reason: unknown) => reason,
	)
	assert.equal((error as Error).name, "AbortError")
})

test("a 200 whose body isn't the stream rejects with the caller's own message", async (t) => {
	for (const body of ["<html><body>Welcome</body></html>", "null\n", ""]) {
		stubFetch(t, () => new Response(body))
		const status = await statusOf(oneSearch().batch)
		assert.equal(status, UNAVAILABLE)
	}
})

test("a refusal with a message of its own shows that message", async (t) => {
	stubFetch(t, () => Response.json({ error: "Search is too long" }, { status: 413 }))
	const status = await statusOf(oneSearch().batch)
	assert.equal(status, "Search is too long")
})

test("the route's 503 for a failed search keeps its own message", async (t) => {
	stubFetch(t, () => Response.json({ error: UNAVAILABLE }, { status: 503 }))
	assert.equal(await statusOf(oneSearch().batch), UNAVAILABLE)
})

test("a refusal without a message shows the caller's own", async (t) => {
	stubFetch(t, () => new Response("Internal Server Error", { status: 500 }))
	assert.equal(await statusOf(oneSearch().batch), UNAVAILABLE)
})

test("the ranked stream gives the reading first and then the batch", async (t) => {
	const batch = { q: "heist movies", rows: [], errors: [] }
	stubFetch(t, () =>
		streamAnswer({ kind: "reading", reading: [{ label: "heist" }] }, { kind: "batch", batch }),
	)
	const search = oneSearch()
	assert.deepEqual(await search.batch, batch)
	assert.deepEqual(search.readings, [[{ label: "heist" }]])
})

test("an error inside the stream shows its message", async (t) => {
	stubFetch(t, () => streamAnswer({ kind: "error", error: "Search is unavailable right now." }))
	assert.equal(await statusOf(oneSearch().batch), "Search is unavailable right now.")
})

test("each answer is one of five kinds", async () => {
	assert.deepEqual(await classifySearchResponse(streamAnswer()), { kind: "stream" })
	assert.deepEqual(await classifySearchResponse(limitedAnswer()), { kind: "limited" })
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

test("provisional results arrive before full completion and never resolve the request", async (t) => {
	let writer!: ReadableStreamDefaultController<Uint8Array>
	stubFetch(t, () => new Response(new ReadableStream({ start(controller) { writer = controller } })))
	const partial = { q: "fixture", rows: [{ key: "movie:42" }], pendingTitleLookup: true }
	const final = { q: "fixture", rows: [{ key: "movie:43" }], pendingTitleLookup: false }
	const progress: unknown[] = []
	let completed = false
	const answer = requestSearch({ body: { q: "fixture" }, signal: new AbortController().signal,
		onReading: () => {}, onProgress: batch => progress.push(batch), unavailable: UNAVAILABLE })
	answer.then(() => { completed = true })
	await new Promise(resolve => setImmediate(resolve))
	const send = (packet: unknown) => writer.enqueue(new TextEncoder().encode(`${JSON.stringify(packet)}\n`))
	send({ kind: "provisional", batch: partial })
	await new Promise(resolve => setImmediate(resolve))
	assert.deepEqual(progress, [partial])
	assert.equal(completed, false)
	send({ kind: "batch", batch: final })
	// A delayed malformed producer cannot downgrade a final answer.
	send({ kind: "provisional", batch: partial })
	writer.close()
	assert.deepEqual(await answer, final)
	assert.deepEqual(progress, [partial])
})

// The wire only: which reading a page then shows is chosen inside its controller.
test("a reading streamed after a pendingRanking batch still arrives, after that batch and never after the completed answer", async (t) => {
	const early = { q: "fixture", rows: [{ key: "movie:42" }], reading: [], pendingRanking: true }
	const final = { q: "fixture", rows: [{ key: "movie:43" }], reading: [{ label: "heist" }], pendingRanking: false }
	stubFetch(t, () => streamAnswer(
		{ kind: "provisional", batch: early },
		{ kind: "reading", reading: [{ label: "heist" }] },
		{ kind: "batch", batch: final },
		{ kind: "reading", reading: [{ label: "late" }] },
	))
	const events: unknown[] = []
	const answer = await requestSearch({ body: { q: "fixture" }, signal: new AbortController().signal,
		onReading: chips => events.push(["reading", chips]), onProgress: batch => events.push(["provisional", batch]),
		unavailable: UNAVAILABLE })
	assert.deepEqual(events, [["provisional", early], ["reading", [{ label: "heist" }]]])
	assert.deepEqual(answer, final)
})

test("a failure after provisional results rejects without discarding delivered progress", async (t) => {
	const partial = { q: "fixture", rows: [{ key: "movie:42" }] }
	stubFetch(t, () => streamAnswer({ kind: "provisional", batch: partial }, { kind: "error", error: "Title check failed" }))
	const progress: unknown[] = []
	const answer = requestSearch({ body: {}, signal: new AbortController().signal, onReading: () => {},
		onProgress: batch => progress.push(batch), unavailable: UNAVAILABLE })
	await assert.rejects(answer, /Title check failed/)
	assert.deepEqual(progress, [partial])
})

test("aborted requests do not deliver queued provisional packets and cancel their reader", async (t) => {
	const stop = new AbortController()
	let cancelled = 0
	stubFetch(t, () => new Response(new ReadableStream({
		start(controller) { controller.enqueue(new TextEncoder().encode('{"kind":"provisional","batch":{"rows":[]}}\n')) },
		cancel() { cancelled++ },
	})))
	const progress: unknown[] = []
	const answer = requestSearch({ body: {}, signal: stop.signal, onReading: () => {},
		onProgress: batch => progress.push(batch), unavailable: UNAVAILABLE })
	stop.abort()
	await assert.rejects(answer, error => (error as Error).name === "AbortError")
	assert.deepEqual(progress, [])
	assert.equal(cancelled, 1)
})
