// What the start page asks for a query, and what it answers: the same two requests Discover makes, so a search plus
// mood picks behaves as on Discover.
//
// 1. The search text goes to the combined search (runDiscoverSearch): its stream gives the reading first ("Read as"),
//    then the ranked list. Each text is searched once: the answer is kept, so changing the picks only re-filters.
// 2. The ranked list (or, with picks only, the catalog) goes to /api/discover/results with the picks as moods, themes,
//    and styles, and the services scope: `any` (any streaming offer in the country) without saved services, `mine`
//    with them. A guest POSTs their progress (useGuestBody); a member GETs.
//
// The answer is StartResults, marked with the query's signature. A newer query aborts the requests of an older one,
// and an answer that arrives for a query no longer asked is dropped. A 503 while the title snapshot loads is asked
// again after its Retry-After; a failed search or results request shows its message in the card's box.
//
// Framework-free, so it's tested against a mocked `fetch` (start-search.test.ts); useStartSearch.ts holds one per page.
import {
	type SearchScope,
	searchEligibility,
	searchText,
} from "~/domain/discover-search"
import {
	type FilterDefaults,
	type FilterState,
	defaultFilterState,
	filterQuery,
	filterStateToParams,
} from "~/domain/filter-state"
import { picksOf } from "~/domain/taste-picker"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { DiscoverResults } from "~/server/discover-results.server"
import { runDiscoverSearch } from "~/ui/discover/discover-search-request"
import type { GuestBody } from "~/ui/discover/useDiscoverBrowse"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import type { TitleKey } from "~/utils/title-key"
import {
	IDLE_RESULTS,
	type StartQuery,
	type StartResults,
	querySignature,
} from "../stage/start-query"

/** The most titles the card takes: two views of its row on the widest screen. */
export const START_CARDS = 16

/** What the card says when the results couldn't load (Discover's words). */
export const RESULTS_ERROR =
	"Discover couldn't load right now. Try again in a moment."

/** How often a 503 (the title snapshot still loading) is asked again before the card says so. */
const SNAPSHOT_RETRIES = 3
const RETRY_AFTER = { fallback: 5, min: 1, max: 30 }
/** Searched texts kept, so going back to one doesn't search it again. */
const KEPT_SEARCHES = 8

/** Where the results come from: any streaming offer in the country, or the viewer's services. */
export type ResultsScope = "any" | "mine"

/**
 * The one scope rule for the start page's results and the mood picker's counts: `mine` once the viewer (a guest who
 * saved services, or a member with services) has any, else `any`.
 */
export const resultsScope = (
	scope: Pick<SearchScope, "services">,
): ResultsScope => (scope.services.length ? "mine" : "any")

/** The counts of a search that found nothing: there was nothing to count. */
const NO_COUNTS = { moods: {}, themes: {}, styles: {} }

// The defaults the start page serializes against: everything at its widest, so only what the guest chose is written.
const WIDEST: FilterDefaults = { onMyServices: false, notSeenYet: false }

/**
 * The filter state of the picks in a scope. Titles the viewer has seen stay in: the row is for tapping titles they
 * loved, so a loved title has to stay where it is.
 */
function pickedState(
	picks: readonly string[],
	scope: ResultsScope,
): FilterState {
	const { moods, themes, styles } = picksOf(picks)
	return {
		...defaultFilterState(WIDEST),
		...(scope === "mine" ? { onMyServices: true } : { anyService: true }),
		moods,
		themes,
		styles,
	}
}

/** The results request's path for the picks, and the search's ranked list when a search is on. */
export function resultsPath({
	picks,
	scope,
	ranked,
	language,
}: {
	picks: readonly string[]
	scope: ResultsScope
	/** The search's ranked list; null without a search. */
	ranked: readonly TitleKey[] | null
	language?: string
}): string {
	const params = new URLSearchParams(
		filterQuery(
			pickedState(picks, scope),
			ranked ? "relevance" : "popular",
			WIDEST,
		),
	)
	if (ranked) params.set("ranked", ranked.join(","))
	params.set("page", "1")
	const path = `/api/discover/results?${params}`
	return language ? mediaLanguageUrl(path, language) : path
}

/** See all: Discover with the search's text and the picks. */
export function seeAllHref(query: Pick<StartQuery, "text" | "picks">): string {
	const { moods, themes, styles } = picksOf(query.picks)
	const params = filterStateToParams(
		{ ...defaultFilterState(WIDEST), moods, themes, styles },
		WIDEST,
	)
	const text = searchText(query.text)
	const out = new URLSearchParams(text ? { q: text } : {})
	for (const [name, value] of params) out.set(name, value)
	const search = out.toString()
	return search ? `/discover?${search}` : "/discover"
}

/** Seconds from a Retry-After header, kept to a sane range. */
function retryAfterMs(response: Response): number {
	const seconds = Number(response.headers.get("Retry-After"))
	const s =
		Number.isFinite(seconds) && seconds > 0 ? seconds : RETRY_AFTER.fallback
	return Math.min(RETRY_AFTER.max, Math.max(RETRY_AFTER.min, s)) * 1000
}

type Searched = { ranked: TitleKey[]; reading: ReadingChip[] }

export interface StartSearch {
	/** Answer this query (a no-op for the query already asked). */
	set(query: Pick<StartQuery, "text" | "picks">): void
	/** Ask the current query again (after an error). */
	retry(): void
	/** Abort everything; nothing is answered after this. */
	dispose(): void
}

export function createStartSearch({
	scope,
	guest,
	language,
	onChange,
}: {
	/** The viewer's country and services: the search's eligibility and the results' scope. */
	scope: SearchScope
	/** A guest's progress, read as each request starts; null for a member. */
	guest: () => GuestBody | null
	language?: string
	onChange: (results: StartResults) => void
}): StartSearch {
	const searches = new Map<string, Promise<Searched>>()
	/** Readings streamed ahead of their ranked lists. */
	const readings = new Map<string, ReadingChip[]>()
	const filters = searchEligibility(pickedState([], resultsScope(scope)), scope)
	let shown: StartResults = IDLE_RESULTS
	let asked: {
		query: Pick<StartQuery, "text" | "picks">
		signature: string
	} | null = null
	let requests: AbortController | null = null
	/** The search in flight, aborted when another text is searched. */
	let searching: {
		text: string
		abort: AbortController
		promise: Promise<Searched>
	} | null = null
	let retryTimer: ReturnType<typeof setTimeout> | null = null
	let disposed = false

	const emit = (next: StartResults) => {
		shown = next
		onChange(next)
	}
	const stopRetry = () => {
		if (retryTimer !== null) clearTimeout(retryTimer)
		retryTimer = null
	}

	/** Stops the search in flight and forgets it now, not when its rejection settles, so its text can be asked anew. */
	function stopSearching() {
		if (!searching) return
		if (searches.get(searching.text) === searching.promise)
			searches.delete(searching.text)
		searching.abort.abort()
		searching = null
	}

	function search(text: string): Promise<Searched> {
		const kept = searches.get(text)
		if (kept) return kept
		stopSearching()
		const abort = new AbortController()
		const promise: Promise<Searched> = runDiscoverSearch(
			text,
			filters,
			false,
			abort.signal,
			(chips) => {
				readings.set(text, chips)
				// The reading shows as soon as it arrives, while the titles are still on their way.
				if (
					shown.status === "loading" &&
					asked?.query.text === text &&
					shown.signature === asked.signature
				)
					emit({ ...shown, reading: chips })
			},
			undefined,
			language,
		).then(
			(answer) => {
				if (searching?.abort === abort) searching = null
				return {
					ranked: answer.ranked,
					reading: answer.reading.length
						? answer.reading
						: (readings.get(text) ?? []),
				}
			},
			(error: unknown) => {
				if (searching?.abort === abort) searching = null
				// A failed or aborted search is asked again next time.
				if (searches.get(text) === promise) searches.delete(text)
				throw error
			},
		)
		searching = { text, abort, promise }
		searches.set(text, promise)
		while (searches.size > KEPT_SEARCHES)
			searches.delete(searches.keys().next().value as string)
		return promise
	}

	async function load(
		signature: string,
		text: string | null,
		picks: readonly string[],
		signal: AbortSignal,
		attempt: number,
	) {
		const live = () =>
			!disposed && !signal.aborted && asked?.signature === signature
		const fail = (error: string) =>
			emit({
				...shown,
				status: "error",
				cards: [],
				total: null,
				ranked: null,
				optionCounts: null,
				error,
			})
		let ranked: TitleKey[] | null = null
		let reading: ReadingChip[] | null = null
		if (text !== null) {
			let answer: Searched
			try {
				answer = await search(text)
			} catch (error) {
				if (live()) fail(error instanceof Error ? error.message : RESULTS_ERROR)
				return
			}
			if (!live()) return
			ranked = answer.ranked
			reading = answer.reading
			// The search found nothing: there is nothing to filter.
			if (!ranked.length) {
				emit({
					status: "ready",
					signature,
					cards: [],
					reading,
					total: 0,
					ranked,
					optionCounts: NO_COUNTS,
					error: null,
				})
				return
			}
		}
		const viewer = guest()
		const path = resultsPath({
			picks,
			scope: resultsScope(scope),
			ranked,
			language,
		})
		let response: Response
		try {
			response = await fetch(
				path,
				viewer
					? {
							signal,
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ guest: viewer }),
						}
					: { signal },
			)
		} catch {
			if (live()) fail(RESULTS_ERROR)
			return
		}
		if (!live()) return
		if (response.status === 503 && attempt < SNAPSHOT_RETRIES) {
			void response.body?.cancel().catch(() => {})
			retryTimer = setTimeout(() => {
				retryTimer = null
				if (live()) void load(signature, text, picks, signal, attempt + 1)
			}, retryAfterMs(response))
			return
		}
		if (!response.ok) {
			void response.body?.cancel().catch(() => {})
			fail(RESULTS_ERROR)
			return
		}
		let body: DiscoverResults
		try {
			body = await response.json()
		} catch {
			if (live()) fail(RESULTS_ERROR)
			return
		}
		if (!live()) return
		emit({
			status: "ready",
			signature,
			cards: body.cards.slice(0, START_CARDS),
			reading,
			total: body.total,
			ranked,
			optionCounts: {
				moods: body.optionCounts?.moods ?? {},
				themes: body.optionCounts?.themes ?? {},
				styles: body.optionCounts?.styles ?? {},
			},
			error: null,
		})
	}

	function run(query: Pick<StartQuery, "text" | "picks">) {
		stopRetry()
		requests?.abort()
		requests = null
		const signature = querySignature(query)
		asked = { query, signature }
		const text = searchText(query.text)
		if (text === null && !query.picks.length) {
			emit({ ...IDLE_RESULTS, signature })
			return
		}
		const abort = new AbortController()
		requests = abort
		emit({
			status: "loading",
			signature,
			cards: [],
			reading: text === null ? null : (readings.get(text) ?? null),
			total: null,
			ranked: null,
			optionCounts: null,
			error: null,
		})
		void load(signature, text, query.picks, abort.signal, 0)
	}

	return {
		set(query) {
			if (disposed || asked?.signature === querySignature(query)) return
			// A search no longer asked for stops; a kept one (the same text) carries on.
			if (searching && searching.text !== searchText(query.text))
				stopSearching()
			run(query)
		},
		retry() {
			if (!disposed && asked) run(asked.query)
		},
		dispose() {
			disposed = true
			stopRetry()
			requests?.abort()
			stopSearching()
		},
	}
}
