// Which reading the search page and Discover's search show, and how a partial list is counted. The selector and the
// count are the functions both controllers call (SearchJourney.tsx, useDiscoverSearch.ts). The stream tests feed them
// what the real requests deliver, in the order the controllers store it. Nothing here renders React: that the
// controllers pass their own state to these functions is read from their source, not shown by a test.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import type { ReadingChip } from "../../server/combined-search/reading-retrieval.server.ts"
import { searchFiltersKey } from "../../server/combined-search/search-filters.ts"
import {
	type BatchReading,
	type StreamedReading,
	foundSoFar,
	selectReading,
	showsNoResults,
} from "./search-partial.ts"
import { streamAnswer, stubFetch } from "./search-test-answers.ts"

const { SEARCH_PAGE_UNAVAILABLE, requestSearch } = await import(
	"./search-client.ts"
)
const { runDiscoverSearch } = await import(
	"../discover/discover-search-request.ts"
)

const chip = (text: string) => ({ kind: "want", text }) as ReadingChip
const heist = [chip("heist")]
const older = [chip("older reading")]

// The two controllers' keys, restated: Discover's (useDiscoverSearch.ts) and the search page's batch key
// (SearchJourney.tsx, with a fixed policy version and no lesser-known titles).
const discoverKey = (
	q: string,
	filters: Parameters<typeof searchFiltersKey>[0] = {},
	allTitles = false,
) => `${q}|${searchFiltersKey(filters)}|${allTitles ? 1 : 0}`
const journeyKey = (
	q: string,
	filters: Parameters<typeof searchFiltersKey>[0] = {},
	allTitles = false,
) => {
	const filtersKey = searchFiltersKey(filters)
	return `v1:false:false${allTitles ? ":allTitles" : ""}${filtersKey ? `:${filtersKey}` : ""}:${q}`
}
const keys = { Discover: discoverKey, "the search page": journeyKey }

for (const [client, keyOf] of Object.entries(keys)) {
	const key = keyOf("heist movies")
	const otherFilters = keyOf("heist movies", { type: "movie" })
	const otherScope = keyOf("heist movies", {}, true)

	test(`${client}: without a batch, the reading streamed for this request shows`, () => {
		assert.equal(selectReading(key, null, { key, chips: heist }), heist)
		assert.equal(selectReading(key, null, null), null)
	})

	test(`${client}: a reading streamed for the same query with other filters or another allTitles never shows`, () => {
		assert.notEqual(otherFilters, key)
		assert.notEqual(otherScope, key)
		for (const stale of [otherFilters, otherScope]) {
			assert.equal(selectReading(key, null, { key: stale, chips: older }), null)
			// Nor does it show under a list sent ahead of this request's ranking.
			assert.equal(
				selectReading(
					key,
					{ key, reading: [], pendingRanking: true },
					{ key: stale, chips: older },
				),
				null,
			)
		}
	})

	test(`${client}: a batch of the same query with other filters or another allTitles never gives its reading`, () => {
		for (const stale of [otherFilters, otherScope]) {
			const batch = { key: stale, reading: older }
			assert.equal(selectReading(key, batch, null), null)
			// This request's streamed reading shows over it.
			assert.equal(selectReading(key, batch, { key, chips: heist }), heist)
			// A stale partial list is no different.
			assert.equal(
				selectReading(key, { ...batch, pendingRanking: true }, null),
				null,
			)
		}
	})

	test(`${client}: a pendingRanking list's empty reading does not cover the reading streamed for this request`, () => {
		const early = { key, reading: [], pendingRanking: true }
		assert.equal(selectReading(key, early, null), null)
		assert.equal(selectReading(key, early, { key, chips: heist }), heist)
	})

	test(`${client}: the completed batch's reading wins, also when it is empty`, () => {
		const streamed = { key, chips: older }
		assert.deepEqual(
			selectReading(key, { key, reading: heist, pendingRanking: false }, streamed),
			heist,
		)
		assert.deepEqual(
			selectReading(key, { key, reading: [], pendingRanking: false }, streamed),
			[],
		)
		// A batch saved before readings existed has none.
		assert.deepEqual(
			selectReading(key, { key, reading: undefined }, streamed),
			[],
		)
	})
}

test("the search page's request: the reading shown after each packet of a stream is this request's own", async (t) => {
	const final = [chip("heist"), chip("tense")]
	stubFetch(t, () =>
		streamAnswer(
			{ kind: "provisional", batch: { q: "heist movies", rows: [], reading: [], people: [{ id: 7 }], pendingRanking: true } },
			{ kind: "reading", reading: heist },
			{ kind: "batch", batch: { q: "heist movies", rows: [], reading: final, pendingRanking: false } },
		),
	)
	const key = journeyKey("heist movies")
	// What the controller keeps, as it stores it: the partial batch and the streamed reading under the batch key.
	const state = {
		partial: null as BatchReading | null,
		streamed: null as StreamedReading | null,
	}
	const shown: (ReadingChip[] | null)[] = []
	const batch = await requestSearch({
		body: { q: "heist movies", filters: {}, allTitles: false },
		signal: new AbortController().signal,
		onReading: (chips) => {
			state.streamed = { key, chips }
			shown.push(selectReading(key, state.partial, state.streamed))
		},
		onProgress: (partial) => {
			state.partial = {
				key,
				reading: partial.reading,
				pendingRanking: Boolean(partial.pendingRanking),
			}
			shown.push(selectReading(key, state.partial, state.streamed))
		},
		unavailable: SEARCH_PAGE_UNAVAILABLE,
	})
	const completed = { key, reading: batch.reading, pendingRanking: false }
	shown.push(selectReading(key, completed, state.streamed))
	assert.deepEqual(shown, [null, heist, final])
	// The same query with a filter added, before its own search answered: nothing of the search above shows.
	const filtered = journeyKey("heist movies", { type: "movie" })
	assert.equal(selectReading(filtered, completed, state.streamed), null)
	assert.equal(selectReading(filtered, state.partial, state.streamed), null)
})

test("Discover's request: the reading shown after each packet of a stream is this request's own", async (t) => {
	const final = [chip("heist"), chip("tense")]
	stubFetch(t, () =>
		streamAnswer(
			{ kind: "provisional", batch: { rows: [{ key: "movie:42" }], reading: [], pendingRanking: true } },
			{ kind: "reading", reading: heist },
			{ kind: "batch", batch: { rows: [{ key: "movie:43" }], reading: final, pendingRanking: false } },
		),
	)
	const key = discoverKey("heist movies")
	const state = {
		partial: null as BatchReading | null,
		streamed: null as StreamedReading | null,
	}
	const shown: (ReadingChip[] | null)[] = []
	const answer = await runDiscoverSearch(
		"heist movies",
		{},
		false,
		new AbortController().signal,
		(chips) => {
			state.streamed = { key, chips }
			shown.push(selectReading(key, state.partial, state.streamed))
		},
		(partial) => {
			state.partial = {
				key,
				reading: partial.reading,
				pendingRanking: Boolean(partial.pendingRanking),
			}
			shown.push(selectReading(key, state.partial, state.streamed))
		},
	)
	const completed = { key, reading: answer.reading }
	shown.push(selectReading(key, completed, state.streamed))
	assert.deepEqual(shown, [null, heist, final])
	// The same query with allTitles, before its own search answered: nothing of the search above shows.
	const allTitles = discoverKey("heist movies", {}, true)
	assert.equal(selectReading(allTitles, completed, state.streamed), null)
	assert.equal(selectReading(allTitles, state.partial, state.streamed), null)
})

test("the search page's request: a people-only partial list whose search then fails does not read as a search that found nothing", async (t) => {
	stubFetch(t, () =>
		streamAnswer(
			{ kind: "provisional", batch: { q: "fixture person", rows: [], reading: [], people: [{ id: 7 }], pendingRanking: true } },
			{ kind: "error", error: "Search ranking did not complete" },
		),
	)
	// What the controller keeps of the partial batch for its status line and its empty list: the titles and the people.
	const state = { partial: null as { titles: number; people: number } | null }
	await assert.rejects(
		requestSearch({
			body: { q: "fixture person", filters: {}, allTitles: false },
			signal: new AbortController().signal,
			onReading: () => {},
			onProgress: (partial) => {
				state.partial = {
					titles: partial.rows.length,
					people: partial.people?.length ?? 0,
				}
			},
			unavailable: SEARCH_PAGE_UNAVAILABLE,
		}),
		/Search ranking did not complete/,
	)
	// The failed search is no longer loading, and its partial list stays: one person, no title.
	assert.deepEqual(state.partial, { titles: 0, people: 1 })
	const { titles, people } = state.partial ?? { titles: 0, people: 0 }
	assert.equal(showsNoResults(titles, false, people), false)
	assert.equal(foundSoFar(titles, people), "1 person")
})

test("the search page's request: a completed answer without a title still reads as a search that found nothing", async (t) => {
	stubFetch(t, () =>
		streamAnswer(
			{ kind: "provisional", batch: { q: "fixture person", rows: [], reading: [], people: [{ id: 7 }], pendingRanking: true } },
			{ kind: "batch", batch: { q: "fixture person", rows: [], reading: [], people: [{ id: 7 }], pendingRanking: false } },
		),
	)
	const batch = await requestSearch({
		body: { q: "fixture person", filters: {}, allTitles: false },
		signal: new AbortController().signal,
		onReading: () => {},
		onProgress: () => {},
		unavailable: SEARCH_PAGE_UNAVAILABLE,
	})
	// The completed answer replaces the partial list: no partial people remain, whatever the answer itself names.
	assert.equal(showsNoResults(batch.rows.length, false, 0), true)
})

test("an empty list says nothing was found only once the search is done and no partial people show", () => {
	assert.equal(showsNoResults(0, false, 0), true)
	assert.equal(showsNoResults(0, true, 0), false)
	assert.equal(showsNoResults(0, false, 2), false)
	assert.equal(showsNoResults(0, true, 2), false)
	assert.equal(showsNoResults(3, false, 0), false)
	assert.equal(showsNoResults(1, false, 1), false)
})

test("a partial list's count names the people it shows, and reads as before without them", () => {
	assert.equal(foundSoFar(0, 0), "0 results")
	assert.equal(foundSoFar(3, 0), "3 results")
	// The people-only early batch: no title row yet, and not "0 results".
	assert.equal(foundSoFar(0, 1), "1 person")
	assert.equal(foundSoFar(0, 2), "2 people")
	assert.equal(foundSoFar(1, 1), "1 title and 1 person")
	assert.equal(foundSoFar(4, 2), "4 titles and 2 people")
})
