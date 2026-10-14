// Which reading Discover's search shows. The selector is the function its controller calls (useDiscoverSearch.ts). The
// stream test feeds it what the real request delivers, in the order the controller stores it. Nothing here renders
// React: that the controller passes its own state to the function is read from its source, not shown by a test.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import type { ReadingChip } from "../../server/combined-search/reading-retrieval.server.ts"
import { searchFiltersKey } from "../../server/combined-search/search-filters.ts"
import {
	type BatchReading,
	type StreamedReading,
	selectReading,
} from "./search-partial.ts"
import { streamAnswer, stubFetch } from "./search-test-answers.ts"

const { runDiscoverSearch } = await import(
	"../discover/discover-search-request.ts"
)

const chip = (text: string) => ({ kind: "want", text }) as ReadingChip
const heist = [chip("heist")]
const older = [chip("older reading")]

// The controller's key, restated: Discover's (useDiscoverSearch.ts).
const discoverKey = (
	q: string,
	filters: Parameters<typeof searchFiltersKey>[0] = {},
	allTitles = false,
) => `${q}|${searchFiltersKey(filters)}|${allTitles ? 1 : 0}`
const keys = { Discover: discoverKey }

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
