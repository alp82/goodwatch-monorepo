// My movies (#385) as its route and the development harness draw it: the Watch next page for the Wishlist's movies,
// with the visit that clears what landed on the member's services, and the line that says it on arrival (#456).
import { useMemo } from "react"
import type { LandedLine } from "~/domain/newly-available-signal"
import type { WatchNext } from "~/server/watch-next.server"
import { LandedNote } from "~/ui/my-pages/LandedNote"
import { WRAP } from "~/ui/my-pages/bits"
import { WatchNextPage } from "~/ui/watch-next/WatchNextPage"
import { MOVIES_PAGE } from "./parts"
import { useMyMoviesVisit } from "./useMyMoviesVisit"

export function MyMoviesPage({
	initial,
	landed,
}: {
	initial: { query: string; data: WatchNext | null }
	/** The movies that landed on the member's services since their last visit; null when none did. */
	landed: LandedLine | null
}) {
	useMyMoviesVisit()
	const movies = useMemo(
		() => ({
			...MOVIES_PAGE,
			head: (data: WatchNext | null) => (
				<>
					{MOVIES_PAGE.head(data)}
					<div className={WRAP}>
						<LandedNote kind="movie" landed={landed} className="-mt-2 pb-4" />
					</div>
				</>
			),
		}),
		[landed],
	)
	return <WatchNextPage initial={initial} movies={movies} />
}
