import { useProductExposure } from "~/telemetry/useProductAnalytics"
// The titles of one choice on mini Discover: Discover's own results for that one mood, theme or style, read with
// the results hook of `/api/discover/results` (members GET, guests POST their browser's progress; the answer is
// never stored by a cache). The request returns Discover's first page of 40 cards and the TV shows the first
// four: it is the request the Discover page makes for the same filter, so both show the same titles in the same
// order.
//
// Until the title snapshot is loaded the endpoint answers 503; the list then says "Nothing fits." after the
// query's retries, as an empty result does.
//
// None of this is in the page's first view: the hook runs in `DiscoverData` (screens/Discover.tsx), which arrives
// with the Discover screen's chunk and reports up to the scene (`TvDiscoverReport`). The scene imports this
// file's types only.
import { useMemo } from "react"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import type { TitleCard } from "~/server/title-cards.server"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import { discoverQuery, listCards } from "./tv-discover"
import { tvTitleKey } from "./tv-home"
import type { TvScreen } from "./tv-machine"

/** What Discover's data component reports up to the scene. */
export type TvDiscoverReport = {
	/** The titles of the choice on screen, at most four, best first. */
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
	}, [member, tab, choice])
	const results = useDiscoverResults({
		query: tab && choice ? discoverQuery(tab, choice) : "",
		guest,
		enabled: Boolean(tab && choice),
	})
	// The hook keeps the last answer while the next loads; on the TV that would be another choice's titles.
	const data = results.isPlaceholderData ? undefined : results.data
	const cards = useMemo(() => listCards(data?.cards ?? []), [data])
	useProductExposure(
		"discovery results shown",
		data ? `${tab}:${choice}:${cards.length}` : null,
		{
			source: "living_room",
			surface: "discover",
			result_count: cards.length,
			moods: tab === "moods" && choice ? [choice] : undefined,
		},
	)
	const waiting = Boolean(choice) && !data && !results.isError
	// The same object while nothing changed: every new one is another render of the scene (`useReport`).
	return useMemo(
		() => ({ cards, titles: cards.map(tvTitleKey), waiting }),
		[cards, waiting],
	)
}
