import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { presentCatalogLoader } from "~/server/media-payload.server"
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

// PROTOTYPE (start page lab): the offline lab answers the intro quiz from fixtures. Only titles in the captured intro
// pool can become intro cards there (api.intro.ts), so the pool's titles after the quiz's twelve are ranked by how
// often guest.json's `similar` lists them for the tapped titles, then by score.
async function startLabRecommendations(url: URL) {
	const { loadStartLab, startLabIntro } = await import("~/server/prototype-start-lab.server")
	const mediaType = url.searchParams.get("mediaType")
	const scored = JSON.parse(url.searchParams.get("scoredItems") || "[]") as ScoredItem[]
	const id = (c: { media_type: string; tmdb_id: number }) => `${c.media_type}:${c.tmdb_id}`
	const tapped = new Set(scored.map(id))
	const pool = ((startLabIntro() as { pool?: GuestRecommendation[] } | null)?.pool ?? []).slice(13)
	const similar = loadStartLab().guest.similar
	const votes = new Map<string, number>()
	for (const t of scored) {
		const key = String((t.media_type === "movie" ? 1e12 : 2e12) + t.tmdb_id)
		for (const c of similar[key] ?? []) votes.set(id(c), (votes.get(id(c)) ?? 0) + 1)
	}
	const recommendations = pool
		.filter((c) => c.media_type === mediaType && !tapped.has(id(c)))
		.map((c) => ({
			...c,
			match_percentage: Math.min(98, 70 + 6 * (votes.get(id(c)) ?? 0) + (c.goodwatch_overall_score_normalized_percent ?? 0) / 10),
		}))
		.sort((a, b) => b.match_percentage - a.match_percentage)
		.slice(0, Number.parseInt(url.searchParams.get("limit") || "8", 10))
	return { recommendations }
}

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	if (process.env.START_LAB_FIXTURES) return startLabRecommendations(url)
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
	const { locale } = useLocale()
	const url = mediaLanguageUrl(`/api/guest-recommendations?${params}`, locale.language)

	return useQuery<GetGuestRecommendations>({
		queryKey: [...queryKeyGuestMovieRecommendations, preparedItems, excludeIds, limit, locale.language],
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
	const { locale } = useLocale()
	const url = mediaLanguageUrl(`/api/guest-recommendations?${params}`, locale.language)

	return useQuery<GetGuestRecommendations>({
		queryKey: [...queryKeyGuestShowRecommendations, preparedItems, excludeIds, limit, locale.language],
		queryFn: async () => await (await fetch(url)).json(),
		enabled: enabled && scoredItems.length > 0,
		placeholderData: (previousData) => previousData,
	})
}

export const loader = presentCatalogLoader(canonicalLoader, {})
