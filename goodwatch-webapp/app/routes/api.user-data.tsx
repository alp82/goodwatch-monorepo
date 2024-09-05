import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import type { StreamingLink } from "~/server/details.server"
import type { Score } from "~/server/scores.server"
import { getUserData } from "~/server/userData.server"
import { getUserIdFromRequest } from "~/utils/auth"

// type definitions

export type GetUserDataResult = {
	[media_type: string]: {
		[tmdb_id: string]: {
			onWishList: boolean
			onWatchHistory: boolean
			onFavorites: boolean
			onSkipped: boolean
			score: Score | null
			review: string | null
			onWishListSince: Date | null
			onWatchHistorySince: Date | null
			onFavoritesSince: Date | null
			onScoresSince: Date | null
			onSkippedSince: Date | null
			title: string
			release_year: number
			poster_path: string
			backdrop_path: string
			aggregated_overall_score_normalized_percent: number | null
			streaming_links: StreamingLink[]
		}
	}
}

// API endpoint

export const loader: LoaderFunction = async ({ request }) => {
	const userId = await getUserIdFromRequest({ request })
	const userData = await getUserData({ user_id: userId })

	return json<GetUserDataResult>(userData)
}

// Query hook

export const queryKeyUserData = ["user-data"]

export const useUserData = () => {
	const url = "/api/user-data"
	return useQuery<GetUserDataResult>({
		queryKey: queryKeyUserData,
		queryFn: async () => await (await fetch(url)).json(),
	})
}
