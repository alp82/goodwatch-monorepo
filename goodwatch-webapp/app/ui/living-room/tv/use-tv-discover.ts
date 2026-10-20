import { useProductExposure } from "~/telemetry/useProductAnalytics"
// A complete server page from Discover's existing results endpoint. Members GET; guests send browser progress.
// Placeholder cards are never reported for a changed filter/page. The scene also checks the report identity.
// Disabled while editing filters; Done/Back applies the query. Failures are distinct from empty lists and retryable.
import { useCallback, useMemo } from "react"
import { listCards } from "./tv-discover"
import { browseIdentity, browseQuery, pageInfo } from "./tv-browse"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import type { TitleCard } from "~/server/title-cards.server"
import { snapshotGuestProgress } from "~/utils/guest-progress"

import { tvTitleKey } from "./tv-home"
import type { TvScreen } from "./tv-machine"

/** What Discover's data component reports up to the scene. */
export type TvDiscoverReport = {
	/** This server page, in its actual order. */
	id: string
	total: number
	pages: number
	next: boolean
	failed: string | null
	retry: () => void
	hasTaste: boolean
	summary: string
	controls: Record<string, string>
	cards: readonly TitleCard[]
	/** Their keys on the TV, for the machine's context. */
	titles: readonly string[]
	/** They are still on their way; else these are all there are. */
	waiting: boolean
}

export function useTvDiscover({
	screen,
	member,
}: {
	screen: TvScreen
	member: boolean
}): TvDiscoverReport {
	const tab = screen.name === "discover" ? screen.tab : null
	const choice = screen.name === "discover" ? screen.choice : null
	// A guest's progress as it is when the choice is made, so what they rated on the TV since counts. The three
	// parts the Discover page sends, no more.
	const guest = useMemo(() => {
		if (member) return null
		const { interactions, country, services } = snapshotGuestProgress()
		return { interactions, country, services }
	}, [member, tab, choice, screen])
	const results = useDiscoverResults({
		query: screen.name === "discover" ? browseQuery(screen) : "",
		page: screen.name === "discover" ? (screen.page ?? 1) : 1,
		guest,
		enabled:
			screen.name === "discover" &&
			!screen.filters &&
			Boolean(choice || screen.all),
	})
	// The hook keeps the last answer while the next loads; on the TV that would be another choice's titles.
	const data = results.isPlaceholderData ? undefined : results.data
	const cards = useMemo(() => listCards(data?.cards ?? []), [data])
	const id = screen.name === "discover" ? browseIdentity(screen) : ""
	useProductExposure(
		"discovery results shown",
		data ? `${id}:${cards.length}` : null,
		{
			source: "living_room",
			surface: "discover",
			result_count: cards.length,
			moods: tab === "moods" && choice ? [choice] : undefined,
		},
	)
	const retry = useCallback(() => {
		void results.refetch()
	}, [results.refetch])
	const failed = results.isError ? "Titles are unavailable. Try again." : null
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
	const waiting = !data && !results.isError
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

export function resultSummary(data?: {
	state: { type: string; onMyServices: boolean; notSeenYet: boolean }
	sortUsed: string
	forYou: { on: boolean; applied: boolean; status: string }
}) {
	if (!data) return ""
	const sorts: Record<string, string> = {
		popular: "Popular",
		top: "Top rated",
		newest: "Newest",
		relevance: "Relevance",
		match: "Best match",
	}
	return [
		data.state.type === "all"
			? "Movies & shows"
			: data.state.type === "movie"
				? "Movies"
				: "Shows",
		data.state.onMyServices ? "On my services" : "Everywhere",
		data.state.notSeenYet ? "Not seen yet" : "Include seen",
		sorts[data.sortUsed],
		data.forYou.applied
			? "For you"
			: data.forYou.on && data.forYou.status !== "ready"
				? "For you needs taste"
				: null,
	]
		.filter(Boolean)
		.join(" · ")
}
