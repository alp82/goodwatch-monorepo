// The quiz picks: unseen movies and shows closest to the person's scores, best match first. New scores change the
// query, so the picks re-rank while the person keeps rating; the previous picks stay on screen meanwhile.
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
import { MAX_PICK_PAGES, PICKS_PER_PAGE } from "./quiz-flow"

export type QuizPick = GuestRecommendation

const PICKS_PER_TYPE = MAX_PICK_PAGES * PICKS_PER_PAGE

export function useQuizPicks({
	scored,
	exclude,
	enabled,
}: {
	scored: ScoredItem[]
	exclude: ExcludeItem[]
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
			.filter((p) => !done.has(`${p.media_type}-${p.tmdb_id}`))
			.sort((a, b) => b.match_percentage - a.match_percentage)
			.slice(0, PICKS_PER_TYPE)
	}, [movies.data, shows.data, scored, exclude])

	return {
		picks,
		isLoading: !picks.length && (movies.isFetching || shows.isFetching),
	}
}
