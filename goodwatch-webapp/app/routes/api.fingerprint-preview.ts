import type { LoaderFunctionArgs } from "@remix-run/node"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
	type FingerprintPreviewResult,
	type FingerprintRecommendation,
	getFingerprintPreview,
	getFingerprintPreviewForUser,
} from "~/server/fingerprint-preview.server"
import { getUserIdFromRequest } from "~/utils/auth"

interface LikedItem {
	tmdb_id: number
	media_type: "movie" | "show"
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const likedItemsParam = url.searchParams.get("likedItems")
	const scoredItemsParam = url.searchParams.get("scoredItems")
	const excludeIdsParam = url.searchParams.get("excludeIds")
	const userId = await getUserIdFromRequest({ request })

	// If authenticated user and no liked items provided, fetch from DB
	if (userId && !likedItemsParam) {
		const result = await getFingerprintPreviewForUser({
			userId,
		})
		
		return result
	}

	// Otherwise use guest flow with provided liked items
	if (!likedItemsParam) {
		throw new Response("Missing likedItems parameter for guests", { status: 400 })
	}

	const likedItems: LikedItem[] = JSON.parse(likedItemsParam)
	const scoredItems: LikedItem[] = scoredItemsParam ? JSON.parse(scoredItemsParam) : likedItems
	const excludeIds: LikedItem[] = excludeIdsParam ? JSON.parse(excludeIdsParam) : []

	if (likedItems.length === 0) {
		return { topKeys: [], recommendations: {} }
	}

	const result = await getFingerprintPreview({
		likedItems,
		scoredItems,
		excludeIds,
	})

	return result
}

export const queryKeyFingerprintPreview = ["fingerprint-preview"]

export interface UseFingerprintPreviewParams {
	likedItems?: LikedItem[]
	scoredItems?: LikedItem[]
	excludeIds?: LikedItem[]
	userId?: string
	enabled?: boolean
}

export const useFingerprintPreview = ({
	likedItems,
	scoredItems,
	excludeIds = [],
	userId,
	enabled = true,
}: UseFingerprintPreviewParams) => {
	// For authenticated users, we don't need likedItems or excludeIds in the URL
	// as they're fetched from the database
	const isGuestMode = !userId && likedItems
	
	const likedItemsHash = useMemo(
		() => likedItems ? JSON.stringify(likedItems.map(i => `${i.media_type}-${i.tmdb_id}`).sort()) : "",
		[likedItems]
	)
	const scoredItemsHash = useMemo(
		() => scoredItems ? JSON.stringify(scoredItems.map(i => `${i.media_type}-${i.tmdb_id}`).sort()) : "",
		[scoredItems]
	)
	const excludeIdsHash = useMemo(
		() => excludeIds ? JSON.stringify(excludeIds.map(i => `${i.media_type}-${i.tmdb_id}`).sort()) : "",
		[excludeIds]
	)

	// Build URL based on authentication mode
	let url: string
	if (userId) {
		// Authenticated mode - fetch from DB
		url = `/api/fingerprint-preview`
	} else {
		// Guest mode - pass liked items and exclude IDs
		if (!likedItems || likedItems.length === 0) {
			// Return disabled query if no liked items
			return useQuery<FingerprintPreviewResult>({
				queryKey: [...queryKeyFingerprintPreview, "guest", "empty"],
				queryFn: () => Promise.resolve({ topKeys: [], recommendations: {} }),
				enabled: false,
			})
		}
		const params = new URLSearchParams({
			likedItems: JSON.stringify(likedItems),
		})
		if (scoredItems && scoredItems.length > 0) {
			params.set("scoredItems", JSON.stringify(scoredItems))
		}
		if (excludeIds.length > 0) {
			params.set("excludeIds", JSON.stringify(excludeIds))
		}
		url = `/api/fingerprint-preview?${params}`
	}

	// Build query key based on authentication mode
	const queryKey = userId
		? [...queryKeyFingerprintPreview, "user", userId]
		: [...queryKeyFingerprintPreview, "guest", likedItemsHash, scoredItemsHash, excludeIdsHash]

	return useQuery<FingerprintPreviewResult>({
		queryKey,
		queryFn: async () => await (await fetch(url)).json(),
		enabled: enabled && (userId ? true : likedItems && likedItems.length >= 3),
	})
}
