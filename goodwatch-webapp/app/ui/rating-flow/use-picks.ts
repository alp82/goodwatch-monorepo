// The rating flow's picks: unseen movies and shows closest to the person's scores, best match first. New scores change
// the query, so the picks re-rank while the person keeps rating; the previous picks stay on screen meanwhile.
import { useMemo } from "react"
import {
	useGuestMovieRecommendations,
	useGuestShowRecommendations,
} from "~/routes/api.guest-recommendations"
import type {
	ExcludeItem,
	GuestRecommendation,
	ScoredItem,
} from "~/server/guest-recommendations.server"

export type FlowPick = GuestRecommendation

/** Picks asked for of each kind (movies, shows); the merged list keeps as many. */
export const PICKS_PER_TYPE = 12

export function usePicks({
	scored,
	exclude,
	hide,
	enabled,
}: {
	scored: ScoredItem[]
	exclude: ExcludeItem[]
	/**
	 * More titles never to show as picks, left out here only, not sent: a member's whole account (scored, skipped,
	 * Want to See, Not interested, watched), which the recommendations can't see and which can be long.
	 */
	hide?: ReadonlySet<string>
	enabled: boolean
}) {
	const params = {
		scoredItems: scored,
		excludeIds: exclude,
		limit: PICKS_PER_TYPE,
		enabled,
	}
	const movies = useGuestMovieRecommendations(params)
	const shows = useGuestShowRecommendations(params)

	const picks = useMemo(() => {
		const done = new Set(
			[...scored, ...exclude].map((i) => `${i.media_type}-${i.tmdb_id}`),
		)
		return [
			...(movies.data?.recommendations ?? []),
			...(shows.data?.recommendations ?? []),
		]
			.filter((p) => {
				const key = `${p.media_type}-${p.tmdb_id}`
				return !done.has(key) && !hide?.has(key)
			})
			.sort((a, b) => b.match_percentage - a.match_percentage)
			.slice(0, PICKS_PER_TYPE)
	}, [movies.data, shows.data, scored, exclude, hide])

	return {
		picks,
		isLoading: !picks.length && (movies.isFetching || shows.isFetching),
	}
}
