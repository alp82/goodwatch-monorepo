import type { LoaderFunctionArgs } from "@remix-run/node"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
	type GuestRecommendation,
	type ScoredItem,
	type ExcludeItem,
	getGuestMovieRecommendations,
	getGuestShowRecommendations,
} from "~/server/guest-recommendations.server"

const MAX_SCORED_ITEMS = 20

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const mediaType = url.searchParams.get("mediaType")
	const scoredItemsParam = url.searchParams.get("scoredItems")
	const excludeIdsParam = url.searchParams.get("excludeIds")
	const limit = Number.parseInt(url.searchParams.get("limit") || "20", 10)

	if (!mediaType || !scoredItemsParam) {
		throw new Response("Missing required parameters", { status: 400 })
	}

	const scoredItems: ScoredItem[] = JSON.parse(scoredItemsParam)
	const excludeIds: ExcludeItem[] = excludeIdsParam ? JSON.parse(excludeIdsParam) : []

	// Reject if too many items
	if (scoredItems.length > MAX_SCORED_ITEMS) {
		throw new Response(`Too many scored items. Maximum ${MAX_SCORED_ITEMS} allowed.`, { status: 400 })
	}

	if (mediaType === "movie") {
		const recommendations = await getGuestMovieRecommendations({
			scored_items: scoredItems,
			exclude_ids: excludeIds,
			limit,
		})
		return { recommendations }
	}
	
	if (mediaType === "show") {
		const recommendations = await getGuestShowRecommendations({
			scored_items: scoredItems,
			exclude_ids: excludeIds,
			limit,
		})
		return { recommendations }
	}

	throw new Response("Invalid media type", { status: 400 })
}

type GetGuestRecommendations = {
	recommendations: GuestRecommendation[]
}

export const queryKeyGuestMovieRecommendations = ["guest-recommendations-movies"]
export const queryKeyGuestShowRecommendations = ["guest-recommendations-shows"]

export interface UseGuestRecommendationsParams {
	scoredItems: ScoredItem[]
	excludeIds?: ExcludeItem[]
	limit?: number
	enabled?: boolean
}

const prepareTopScoredItems = (scoredItems: ScoredItem[], maxItems: number = MAX_SCORED_ITEMS): ScoredItem[] => {
	if (scoredItems.length <= maxItems) {
		return scoredItems
	}

	// Sort by score to get highest and lowest
	const sorted = [...scoredItems].sort((a, b) => b.score - a.score)
	
	// Take half from highest scores and half from lowest scores
	const halfMax = Math.floor(maxItems / 2)
	const highest = sorted.slice(0, halfMax)
	const lowest = sorted.slice(-halfMax)
	
	return [...highest, ...lowest]
}

export const useGuestMovieRecommendations = ({
	scoredItems,
	excludeIds = [],
	limit = 20,
	enabled = true,
}: UseGuestRecommendationsParams) => {
	// Prepare scored items: prioritize highest and lowest scores
	const preparedItems = useMemo(
		() => prepareTopScoredItems(scoredItems),
		[scoredItems]
	)

	const params = new URLSearchParams({
		mediaType: "movie",
		scoredItems: JSON.stringify(preparedItems),
		limit: limit.toString(),
	})
	if (excludeIds.length > 0) {
		params.set("excludeIds", JSON.stringify(excludeIds))
	}
	const url = `/api/guest-recommendations?${params}`

	return useQuery<GetGuestRecommendations>({
		queryKey: [...queryKeyGuestMovieRecommendations, preparedItems, excludeIds, limit],
		queryFn: async () => await (await fetch(url)).json(),
		enabled: enabled && scoredItems.length > 0,
		placeholderData: (previousData) => previousData,
	})
}

export const useGuestShowRecommendations = ({
	scoredItems,
	excludeIds = [],
	limit = 20,
	enabled = true,
}: UseGuestRecommendationsParams) => {
	// Prepare scored items: prioritize highest and lowest scores
	const preparedItems = useMemo(
		() => prepareTopScoredItems(scoredItems),
		[scoredItems]
	)

	const params = new URLSearchParams({
		mediaType: "show",
		scoredItems: JSON.stringify(preparedItems),
		limit: limit.toString(),
	})
	if (excludeIds.length > 0) {
		params.set("excludeIds", JSON.stringify(excludeIds))
	}
	const url = `/api/guest-recommendations?${params}`

	return useQuery<GetGuestRecommendations>({
		queryKey: [...queryKeyGuestShowRecommendations, preparedItems, excludeIds, limit],
		queryFn: async () => await (await fetch(url)).json(),
		enabled: enabled && scoredItems.length > 0,
		placeholderData: (previousData) => previousData,
	})
}
