// Discover's free-text search against the answers a search can get once the search roles sit behind the proxy. The
// page shows the rejection's message next to its Retry button, so a bare 502, 503, or 504 and a request without an
// answer must read like the search role's own busy answer. Nothing is requested twice.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import {
	busyAnswer,
	gatewayAnswers,
	networkError,
	streamAnswer,
	stubFetch,
} from "../search/search-test-answers.ts"

const { runDiscoverSearch } = await import("./discover-search-request.ts")

const BUSY = "Search is busy right now. Try again in a moment."
const UNAVAILABLE = "Search is unavailable right now. Try again in a moment."

const discover = (onReading: (chips: unknown[]) => void = () => {}) =>
	runDiscoverSearch("heist movies", {}, false, new AbortController().signal, onReading)
// What Discover shows next to Retry.
const shown = async (search: Promise<unknown>) => {
	const error = await search.then(
		() => null,
		(reason: unknown) => reason,
	)
	assert.ok(error instanceof Error, "the search rejects with an Error")
	return error.message
}

test("the search role's busy answer shows its message, as before", async (t) => {
	const fetched = stubFetch(t, busyAnswer)
	assert.equal(await shown(discover()), BUSY)
	assert.equal(fetched.mock.callCount(), 1)
})

for (const [name, answer] of Object.entries(gatewayAnswers))
	test(`${name} shows the busy message`, async (t) => {
		const fetched = stubFetch(t, answer)
		assert.equal(await shown(discover()), BUSY)
		assert.equal(fetched.mock.callCount(), 1, "no automatic retry")
	})

test("a request without an answer shows the busy message", async (t) => {
	const fetched = stubFetch(t, () => {
		throw networkError()
	})
	assert.equal(await shown(discover()), BUSY)
	assert.equal(fetched.mock.callCount(), 1, "no automatic retry")
})

test("a 200 whose body isn't the stream shows Discover's own message", async (t) => {
	stubFetch(t, () => new Response("<html><body>Welcome</body></html>"))
	assert.equal(await shown(discover()), UNAVAILABLE)
})

test("the ranked stream gives the reading and the ranked titles", async (t) => {
	const fetched = stubFetch(t, () =>
		streamAnswer(
			{ kind: "reading", reading: [{ label: "heist" }] },
			{
				kind: "batch",
				batch: {
					rows: [{ key: "movie:603" }, { key: "show:1396" }, { key: "movie:603" }, { key: "person:1" }],
					reading: [{ label: "heist" }],
					errors: [],
				},
			},
		),
	)
	const readings: unknown[] = []
	const result = await discover((chips) => readings.push(chips))
	assert.equal(result.ranked.length, 2)
	assert.deepEqual(readings, [[{ label: "heist" }]])
	assert.deepEqual(result.errors, [])
	const request = fetched.mock.calls[0].arguments as unknown as [string, RequestInit]
	assert.equal(request[0], "/api/combined-search")
	assert.deepEqual(JSON.parse(String(request[1].body)), {
		q: "heist movies",
		filters: {},
		allTitles: false,
		discover: true,
	})
})
