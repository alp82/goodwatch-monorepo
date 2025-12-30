import type { LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getUserRecommendations, type UserRecommendation } from "~/server/user-recommendations.server"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	
	if (!userId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const url = new URL(request.url)
	const mediaType = url.searchParams.get("mediaType") as "movie" | "show" | "all" | null
	const limit = Number.parseInt(url.searchParams.get("limit") || "20", 10)

	const recommendations = await getUserRecommendations({
		userId,
		mediaType: mediaType || "all",
		limit,
	})

	return { recommendations }
}

type GetUserRecommendations = {
	recommendations: UserRecommendation[]
}

export const queryKeyUserRecommendations = ["user-recommendations"]

export interface UseUserRecommendationsParams {
	mediaType?: "movie" | "show" | "all"
	limit?: number
	enabled?: boolean
}

export const useUserRecommendations = ({ 
	mediaType = "all", 
	limit = 20, 
	enabled = true 
}: UseUserRecommendationsParams = {}) => {
	const params = new URLSearchParams({
		mediaType,
		limit: limit.toString(),
	})
	const url = `/api/user-recommendations?${params}`

	return useQuery<GetUserRecommendations>({
		queryKey: [...queryKeyUserRecommendations, mediaType, limit],
		queryFn: async () => {
			const response = await fetch(url)
			if (!response.ok) {
				throw new Error("Failed to fetch user recommendations")
			}
			return response.json()
		},
		enabled,
	})
}
