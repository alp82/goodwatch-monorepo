// The TV's search rules. The TV asks for the search the Discover page behind the Expand key runs, and writes the
// page's rules out for itself (tv-search.ts says why). Each is held to the page's own here: the text rule, the
// ranking's eligibility, the request's body, the key the answer is kept under, and the answer's shape.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import "../../../server/title-filter/test-alias.ts"
import type { SearchBatch } from "~/server/combined-search/search.server"
import type { TitleCard } from "~/server/title-cards.server"
import { streamAnswer, stubFetch } from "../../search/search-test-answers.ts"

const { SEARCH_MAX_CHARS, SEARCH_MIN_CHARS, searchEligibility, searchText } =
	await import("../../../domain/discover-search.ts")
const { filterStateFromParams } = await import(
	"../../../domain/filter-state.ts"
)
const { searchFiltersKey, parseSearchFilters } = await import(
	"../../../server/combined-search/search-filters.ts"
)
const { runDiscoverSearch } = await import(
	"../../discover/discover-search-request.ts"
)
const { titleKey } = await import("../../../utils/title-key.ts")
const { LIST_TITLES, MIN_QUERY_LENGTH, SEARCH_IDEAS } = await import(
	"./tv-machine.ts"
)
const { listFacts } = await import("./tv-discover.ts")
const {
	SEARCH_MAX_LENGTH,
	SEARCH_QUESTION,
	SEARCH_UNAVAILABLE,
	goLabel,
	guestSearchScope,
	searchCards,
	searchCrumb,
	searchEmptyLine,
	searchFacts,
	searchLine,
	searchable,
	tvResultsQuery,
	tvSearchBody,
	tvSearchFilters,
	tvSearchKey,
	tvSearchResult,
	tvSearchText,
} = await import("./tv-search.ts")

describe("what the search screen says", () => {
	it("asks its question, and says how to answer it on a desktop and on a phone", () => {
		assert.equal(SEARCH_QUESTION, "What are you looking for?")
		assert.equal(searchLine("", false), "Type on the keyboard, or pick one.")
		assert.equal(searchLine("  ", false), "Type on the keyboard, or pick one.")
		assert.equal(searchLine("", true), "Tap the line to type, or pick one.")
	})

	it("says that one character is too few, and that OK searches once there are two", () => {
		for (const phone of [false, true]) {
			assert.equal(searchLine("h", phone), "Two letters or more.")
			assert.equal(searchLine(" h ", phone), "Two letters or more.")
			assert.equal(searchLine("he", phone), "OK searches for it.")
			assert.equal(searchLine("heist movies", phone), "OK searches for it.")
		}
		assert.equal(searchable("h"), false)
		assert.equal(searchable(" h "), false)
		assert.equal(searchable("he"), true)
	})

	it("names what its key searches for, without the spaces around it", () => {
		assert.equal(goLabel(" heist "), "Search “heist”")
		assert.equal(goLabel("h"), "Search “h”")
		assert.equal(searchCrumb("cozy mystery"), "“cozy mystery”")
	})

	it("says in the titles' place that it searches, why it failed, or that it found nothing", () => {
		assert.equal(searchEmptyLine({ waiting: true, failed: null }), "Searching…")
		assert.equal(
			searchEmptyLine({ waiting: false, failed: null }),
			"Nothing found.",
		)
		assert.equal(
			searchEmptyLine({
				waiting: false,
				failed: "Search is busy right now. Try again in a moment.",
			}),
			"Search is busy right now. Try again in a moment.",
		)
		assert.equal(
			searchEmptyLine({
				waiting: false,
				failed: "Too many searches right now. Try again in a moment.",
			}),
			"Too many searches right now. Try again in a moment.",
		)
	})

	it("writes a found title's facts as mini Discover's list does", () => {
		const cards = [
			{
				media_type: "movie",
				release_year: 2001,
				runtime: 116,
				goodwatch_overall_score_normalized_percent: 81.6,
				match: 91,
				services: [{ id: 8, name: "Netflix", logo_path: "/n.jpg" }],
			},
			{
				media_type: "show",
				release_year: 2011,
				runtime: null,
				goodwatch_overall_score_normalized_percent: null,
				match: null,
				services: [],
			},
			{
				media_type: "movie",
				release_year: null,
				runtime: 90,
				goodwatch_overall_score_normalized_percent: 55,
				match: null,
				services: null,
			},
		] as unknown as TitleCard[]
		for (const card of cards) assert.equal(searchFacts(card), listFacts(card))
		assert.equal(
			searchFacts(cards[0]),
			"2001 · Movie · 1h 56m · 82 score · 91% match · On Netflix",
		)
	})

	it("shows the first four titles found", () => {
		const cards = Array.from({ length: 9 }, (_, id) => ({ tmdb_id: id }))
		assert.deepEqual(
			searchCards(cards as unknown as TitleCard[]),
			cards.slice(0, LIST_TITLES),
		)
		assert.equal(LIST_TITLES, 4)
	})

	it("has ideas that are long enough to search for", () => {
		for (const idea of SEARCH_IDEAS) assert.equal(tvSearchText(idea), idea)
	})
})

describe("the query, as the Discover page reads it", () => {
	it("has the page's limits", () => {
		assert.equal(MIN_QUERY_LENGTH, SEARCH_MIN_CHARS)
		assert.equal(SEARCH_MAX_LENGTH, SEARCH_MAX_CHARS)
	})

	it("is the page's text for every query", () => {
		for (const q of [
			null,
			undefined,
			"",
			" ",
			"h",
			" h ",
			"he",
			"  heist movies  ",
			"é",
			"日本",
			"x".repeat(SEARCH_MAX_CHARS),
			`  ${"x".repeat(SEARCH_MAX_CHARS + 40)}  `,
		])
			assert.equal(tvSearchText(q), searchText(q), JSON.stringify(q))
		assert.equal(tvSearchText("h"), null)
		assert.equal(tvSearchText(" heist "), "heist")
	})
})

/** The eligibility the Discover page sends for `/discover?q=`, with the filter bar untouched. */
function pageFilters(
	q: string,
	scope: { country: string; services: number[] },
) {
	// The page's defaults: On my services is on for a person with services (`discoverFilterDefaults`).
	const defaults = { onMyServices: scope.services.length > 0, notSeenYet: true }
	const state = filterStateFromParams(new URLSearchParams({ q }), defaults)
	return searchEligibility(state, scope)
}

describe("the ranking's eligibility, as the Discover page sends it", () => {
	const scopes = [
		{ country: "US", services: [] },
		{ country: "US", services: [8] },
		{ country: "DE", services: [337, 8, 9] },
		{ country: "US", services: [8, 8, 9, 8] },
		{ country: "US", services: Array.from({ length: 70 }, (_, at) => at + 1) },
		// No country the ranking knows: the page narrows nothing either.
		{ country: "", services: [8] },
		{ country: "usa", services: [8] },
	]

	it("is the page's for a member's scope, with and without services", () => {
		for (const scope of scopes)
			assert.deepEqual(
				tvSearchFilters(scope),
				pageFilters("heist", scope),
				JSON.stringify(scope),
			)
	})

	it("narrows to a person's own services in their country, and to nothing else", () => {
		assert.deepEqual(tvSearchFilters({ country: "US", services: [] }), {})
		assert.deepEqual(tvSearchFilters(null), {})
		assert.deepEqual(tvSearchFilters({ country: "DE", services: [337, 8] }), {
			streaming: { country: "DE", providerIds: [337, 8] },
		})
	})

	it("is what the server reads from it, unchanged", () => {
		for (const scope of scopes) {
			const filters = tvSearchFilters(scope)
			assert.deepEqual(parseSearchFilters(filters), filters)
		}
	})

	it("reads a guest's scope from their browser as the page does: the ids of their services, and their country", () => {
		assert.deepEqual(guestSearchScope({ country: "DE", services: "8,337" }), {
			country: "DE",
			services: [8, 337],
		})
		assert.deepEqual(guestSearchScope({ country: null, services: null }), {
			country: null,
			services: [],
		})
		assert.deepEqual(
			guestSearchScope({ country: "", services: "8,x,,-3,0,9" }),
			{ country: null, services: [8, 9] },
		)
		// A guest with services saved and a country: the page's eligibility.
		assert.deepEqual(
			tvSearchFilters(guestSearchScope({ country: "DE", services: "8,337" })),
			pageFilters("heist", { country: "DE", services: [8, 337] }),
		)
	})

	it("leaves the ranking wide for a guest with services and no country in their browser", () => {
		// The page uses its own guess of the country there, which the TV does not know. The results endpoint
		// still narrows the list to the guest's services.
		assert.deepEqual(
			tvSearchFilters(guestSearchScope({ country: null, services: "8" })),
			{},
		)
	})
})

describe("the answer's key, the Discover page's", () => {
	it("is the key `useDiscoverSearch` keeps a search under, so the page behind Expand draws from it", () => {
		for (const scope of [
			null,
			{ country: "US", services: [8] },
			{ country: "DE", services: [337, 8, 9] },
		]) {
			const filters = tvSearchFilters(scope)
			// useDiscoverSearch.ts: `${q ?? ""}|${searchFiltersKey(filters)}|${allTitles ? 1 : 0}`.
			assert.deepEqual(tvSearchKey("heist", filters), [
				"discover-search",
				`heist|${searchFiltersKey(filters)}|0`,
			])
		}
		assert.deepEqual(tvSearchKey("heist", {}), ["discover-search", "heist||0"])
		assert.deepEqual(
			tvSearchKey(
				"heist",
				tvSearchFilters({ country: "DE", services: [337, 8] }),
			),
			["discover-search", "heist|s=DE:8,337|0"],
		)
	})
})

const batch = (rest: Partial<SearchBatch> = {}): SearchBatch =>
	({
		q: "heist",
		rows: [
			{ key: "movie:161" },
			{ key: "show:1399" },
			{ key: "movie:161" },
			{ key: "person:5" },
			{ key: "movie:x" },
			{ key: "movie:388" },
		],
		reading: [{ label: "heist", kind: "theme" }],
		metadata: [],
		errors: [],
		mode: "en",
		elapsedMs: 900,
		chargedNano: 0,
		people: [],
		creditScope: null,
		...rest,
	}) as unknown as SearchBatch

describe("the request and its answer, the Discover page's", () => {
	it("sends the body the page sends, byte for byte", async (t) => {
		for (const scope of [
			null,
			{ country: "US", services: [8] },
			{ country: "DE", services: [337, 8, 9] },
		]) {
			const filters = tvSearchFilters(scope)
			const fetched = stubFetch(t, () =>
				streamAnswer({ kind: "batch", batch: batch() }),
			)
			await runDiscoverSearch(
				"heist",
				filters,
				false,
				new AbortController().signal,
				() => {},
			)
			const [, init] = fetched.mock.calls[0].arguments as unknown as [
				string,
				RequestInit,
			]
			assert.equal(init.body, JSON.stringify(tvSearchBody("heist", filters)))
		}
		assert.deepEqual(tvSearchBody("heist", {}), {
			q: "heist",
			filters: {},
			allTitles: false,
			discover: true,
		})
	})

	it("reads the answer as the page does: the ranked titles as keys, once each, in the ranking's order", async (t) => {
		for (const answer of [
			batch(),
			batch({ rows: [] }),
			batch({ errors: ["The basic search served."] }),
			batch({ pendingRanking: true, pendingTitleLookup: true }),
		]) {
			stubFetch(t, () => streamAnswer({ kind: "batch", batch: answer }))
			const page = await runDiscoverSearch(
				"heist",
				{},
				false,
				new AbortController().signal,
				() => {},
			)
			assert.deepEqual(tvSearchResult("heist", answer), page)
		}
		assert.deepEqual(tvSearchResult("heist", batch()).ranked, [
			titleKey("movie", 161),
			titleKey("show", 1399),
			titleKey("movie", 388),
		])
	})

	it("says what the page says when the search failed and the server did not say why", async (t) => {
		stubFetch(t, () => new Response("<html><body>Welcome</body></html>"))
		const error = await runDiscoverSearch(
			"heist",
			{},
			false,
			new AbortController().signal,
			() => {},
		).then(
			() => null,
			(reason: Error) => reason,
		)
		assert.equal(error?.message, SEARCH_UNAVAILABLE)
	})

	it("asks the results endpoint for the ranked list and nothing else, so the person's defaults are the server's", () => {
		const ranked = [titleKey("movie", 161), titleKey("show", 1399)]
		assert.equal(tvResultsQuery(ranked), `ranked=${ranked[0]},${ranked[1]}`)
		assert.deepEqual(
			[...new URLSearchParams(tvResultsQuery(ranked)).keys()],
			["ranked"],
		)
	})
})
