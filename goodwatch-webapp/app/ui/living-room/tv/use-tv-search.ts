import useLocale from "~/utils/locale"
// Explicit combined search followed by Discover's filtering/sorting/pagination of the full ranked list (up to 100).
// Only query/type/service eligibility reruns ranking; other filters and pages reuse the ranking's query key.
// Search never retries automatically or on focus/remount. The user can explicitly Retry a failed request.
// Interaction-only: mounted by the lazy Search screen. No previous-query placeholder cards are reported.
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { browseIdentity, browseQuery, pageInfo } from "./tv-browse"
import { resultSummary } from "./use-tv-discover"
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
	/** The current server page of the ranked search. */
	id: string
	total: number
	pages: number
	next: boolean
	retry: () => void
	hasTaste: boolean
	summary: string
	controls: Record<string, string>
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
	const { locale } = useLocale()
	const q = screen.name === "search" ? tvSearchText(screen.query) : null
	// A guest's progress as it is when the search is asked for. The three parts the Discover page sends, no more.
	const guest = useMemo(() => {
		if (member) return null
		const { interactions, country, services } = snapshotGuestProgress()
		return { interactions, country, services }
	}, [member, q])
	const filters = useMemo(
		() =>
			tvSearchFilters(
				guest ? guestSearchScope(guest) : scope,
				screen.name === "search" ? screen.browse : undefined,
			),
		[guest, scope, screen.name === "search" ? screen.browse : undefined],
	)
	const search = useQuery({
		queryKey: tvSearchKey(q ?? "", filters, locale.language),
		queryFn: async ({ signal }) =>
			tvSearchResult(
				q ?? "",
				await requestSearch({
					body: tvSearchBody(q ?? "", filters),
					language: locale.language,
					signal,
					onReading: () => {},
					unavailable: SEARCH_UNAVAILABLE,
				}),
			),
		enabled: q !== null && !(screen.name === "search" && screen.filters),
		// One search per OK (see the header).
		retry: false,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	})
	const ranked = q !== null ? search.data?.ranked : undefined
	const results = useDiscoverResults({
		query: ranked?.length
			? `${tvResultsQuery(ranked)}&${screen.name === "search" ? browseQuery(screen) : ""}`
			: "",
		page: screen.name === "search" ? (screen.page ?? 1) : 1,
		guest,
		enabled:
			Boolean(ranked?.length) && !(screen.name === "search" && screen.filters),
	})
	// The hook keeps the last answer while the next loads; on the TV that would be another search's titles.
	const data =
		ranked?.length && !results.isPlaceholderData ? results.data : undefined
	const cards = useMemo(() => searchCards(data?.cards ?? []), [data])
	const id = screen.name === "search" ? browseIdentity(screen) : ""
	const info = pageInfo(data)
	const summary = resultSummary(results.data)
	const controls = useMemo(
		(): Record<string, string> =>
			results.data
				? {
						services: results.data.state.onMyServices ? "mine" : "all",
						unseen: results.data.state.notSeenYet ? "1" : "0",
						foryou: results.data.forYou.on ? "1" : "0",
						sort: results.data.sortUsed,
					}
				: {},
		[results.data],
	)
	const retry = useCallback(() => {
		if (search.isError) void search.refetch()
		else void results.refetch()
	}, [search.isError, search.refetch, results.refetch])
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
		() => ({
			id,
			cards,
			titles: cards.map(tvTitleKey),
			waiting,
			failed,
			retry,
			...info,
			hasTaste: results.data?.hasTaste ?? false,
			summary,
			controls,
		}),
		[
			id,
			cards,
			waiting,
			failed,
			retry,
			info.total,
			info.pages,
			info.next,
			results.data?.hasTaste,
			summary,
			controls,
		],
	)
}
