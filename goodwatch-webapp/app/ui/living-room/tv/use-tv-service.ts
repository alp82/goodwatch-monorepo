// The titles to watch on one streaming service: Discover's own results for that one service, read with the
// results hook of `/api/discover/results` (members GET, guests POST their browser's progress; the answer is never
// stored by a cache). It is the request the Discover page makes for `services=<id>`, so the TV and the page the
// Expand key opens show the same titles in the same order.
//
// Until the title snapshot is loaded the endpoint answers 503; the list then says there is nothing to watch after
// the query's retries, as an empty result does.
//
// None of this is in the page's first view: the hook runs in `ServiceData` (screens/Service.tsx), which arrives
// with the service screen's chunk and reports up to the scene (`TvServiceReport`). The scene imports this file's
// types only.
import { useMemo } from "react"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import type { TitleCard } from "~/server/title-cards.server"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import { tvTitleKey } from "./tv-home"
import type { TvScreen } from "./tv-machine"
import { serviceCards, serviceQuery } from "./tv-service"

/** What the service screen's data component reports up to the scene. */
export type TvServiceReport = {
	/** The service the titles are of, by its TMDB provider id. */
	id: number
	/** The titles to watch there, at most twelve, in Discover's order for the person. */
	cards: readonly TitleCard[]
	/** Their keys on the TV, for the machine's context. */
	titles: readonly string[]
	/** How many titles Discover has for the service; null until it has answered. */
	total: number | null
	/** They are still on their way; else these are all there are. */
	waiting: boolean
}

export function useTvService({
	screen,
	member,
}: {
	screen: TvScreen
	member: boolean
}): TvServiceReport | null {
	const id = screen.name === "service" ? screen.service : null
	// A guest's progress as it is when the screen opens, so what they rated on the TV since counts. The three parts
	// the Discover page sends, no more.
	const guest = useMemo(() => {
		if (member) return null
		const { interactions, country, services } = snapshotGuestProgress()
		return { interactions, country, services }
	}, [member, id])
	const results = useDiscoverResults({
		query: id ? serviceQuery(id) : "",
		guest,
		enabled: id !== null,
	})
	// The hook keeps the last answer while the next loads; on the TV that would be the other service's titles.
	const data = results.isPlaceholderData ? undefined : results.data
	const cards = useMemo(() => serviceCards(data?.cards ?? []), [data])
	const total = data?.total ?? null
	const waiting = !data && !results.isError
	// The same object while nothing changed: every new one is another render of the scene (`useReport`).
	return useMemo(
		() =>
			id === null
				? null
				: { id, cards, titles: cards.map(tvTitleKey), total, waiting },
		[id, cards, total, waiting],
	)
}
