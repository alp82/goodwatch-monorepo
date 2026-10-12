// My movies (#385) as its route and the development harness draw it: the Watch next page for the Wishlist's movies,
// with the visit that clears what landed on the member's services (#456), the row that lists what landed in the
// last 14 days, and the mark those movies carry on their posters (#489).
import { useMemo } from "react"
import type { LandedTitle } from "~/domain/newly-available-words"
import type { WatchNext } from "~/server/watch-next.server"
import { LandedRow, NewOnSticker } from "~/ui/my-pages/LandedRow"
import { WRAP } from "~/ui/my-pages/bits"
import { NewOnContext, type NewOnMark } from "~/ui/watch-next/WatchNextHero"
import { WatchNextPage } from "~/ui/watch-next/WatchNextPage"
import { MOVIES_PAGE } from "./parts"
import { useMyMoviesVisit } from "./useMyMoviesVisit"

export function MyMoviesPage({
	initial,
	landed,
}: {
	initial: { query: string; data: WatchNext | null }
	/** The movies that landed on the member's services in the last 14 days, the latest first. */
	landed: LandedTitle[]
}) {
	useMyMoviesVisit()
	const movies = useMemo(
		() => ({
			...MOVIES_PAGE,
			head: (data: WatchNext | null) => (
				<>
					{MOVIES_PAGE.head(data)}
					<div className={WRAP}>
						<LandedRow landed={landed} className="mb-4" />
					</div>
				</>
			),
		}),
		[landed],
	)
	const mark = useMemo<NewOnMark>(() => {
		const services = new Map(
			landed.flatMap(({ tmdbId, service }) =>
				service ? [[tmdbId, service] as const] : [],
			),
		)
		return {
			serviceOf: (tmdbId) => services.get(tmdbId)?.id ?? null,
			sticker: (tmdbId, className) => {
				const service = services.get(tmdbId)
				return (
					service && (
						<NewOnSticker service={service} small className={className} />
					)
				)
			},
		}
	}, [landed])
	return (
		<NewOnContext.Provider value={mark}>
			<WatchNextPage initial={initial} movies={movies} />
		</NewOnContext.Provider>
	)
}
