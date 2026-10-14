// The TV's search results: the full search for the query in the address, then the first four cards of Discover's
// own results over its ranked list. Two requests, the two the Discover page makes for `/discover?q=`:
// - `POST /api/combined-search` through `requestSearch`, with the page's body. It spends the paid inference
//   budget and writes a history row, so it runs once per query the person asked for with OK, and never again by
//   itself: not on a retry, not when the window gets the focus back, and not when the results are shown again
//   (Back from a title) while the answer is still kept.
// - `/api/discover/results?ranked=<the ranked list>` through `useDiscoverResults` (members GET, guests POST their
//   browser's progress), which filters the list as the page does and answers the cards.
//
// The answer is kept under the Discover page's own key, so the page behind the Expand key draws from it.
//
// None of this is in the page's first view: the hook runs in `SearchData` (screens/Search.tsx), which arrives with
// the search screen's chunk and reports up to the scene (`TvSearchReport`). The scene imports this file's types
// only.
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import type { TitleCard } from "~/server/title-cards.server"
import { requestSearch } from "~/ui/search/search-client"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import { tvTitleKey } from "./tv-home"
import type { TvScreen } from "./tv-machine"
import {
	SEARCH_UNAVAILABLE,
	type TvSearchScope,
	guestSearchScope,
	searchCards,
	tvResultsQuery,
	tvSearchBody,
	tvSearchFilters,
	tvSearchKey,
	tvSearchResult,
	tvSearchText,
} from "./tv-search"

/** What the search's data component reports up to the scene. */
export type TvSearchReport = {
	/** The titles found, at most four, in the search's order. */
	cards: readonly TitleCard[]
	/** Their keys on the TV, for the machine's context. */
	titles: readonly string[]
	/** The search or its cards are still on their way. */
	waiting: boolean
	/** What the search said when it failed, or null. */
	failed: string | null
}

export function useTvSearch({
	screen,
	member,
	scope,
}: {
	screen: TvScreen
	member: boolean
	/** A member's country and saved services, from the page's loader. A guest's are in their browser. */
	scope: TvSearchScope | null
}): TvSearchReport {
	const q = screen.name === "search" ? tvSearchText(screen.query) : null
	// A guest's progress as it is when the search is asked for. The three parts the Discover page sends, no more.
	const guest = useMemo(() => {
		if (member) return null
		const { interactions, country, services } = snapshotGuestProgress()
		return { interactions, country, services }
	}, [member, q])
	const filters = useMemo(
		() => tvSearchFilters(guest ? guestSearchScope(guest) : scope),
		[guest, scope],
	)
	const search = useQuery({
		queryKey: tvSearchKey(q ?? "", filters),
		queryFn: async ({ signal }) =>
			tvSearchResult(
				q ?? "",
				await requestSearch({
					body: tvSearchBody(q ?? "", filters),
					signal,
					onReading: () => {},
					unavailable: SEARCH_UNAVAILABLE,
				}),
			),
		enabled: q !== null,
		// One search per OK (see the header).
		retry: false,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	})
	const ranked = q !== null ? search.data?.ranked : undefined
	const results = useDiscoverResults({
		query: ranked?.length ? tvResultsQuery(ranked) : "",
		guest,
		enabled: Boolean(ranked?.length),
	})
	// The hook keeps the last answer while the next loads; on the TV that would be another search's titles.
	const data =
		ranked?.length && !results.isPlaceholderData ? results.data : undefined
	const cards = useMemo(() => searchCards(data?.cards ?? []), [data])
	const failed =
		q !== null && search.isError
			? search.error.message
			: results.isError
				? SEARCH_UNAVAILABLE
				: null
	// A search that found nothing asks for no cards.
	const waiting =
		q !== null && !failed && (!ranked || (ranked.length > 0 && !data))
	// The same object while nothing changed: every new one is another render of the scene (`useReport`).
	return useMemo(
		() => ({ cards, titles: cards.map(tvTitleKey), waiting, failed }),
		[cards, waiting, failed],
	)
}
