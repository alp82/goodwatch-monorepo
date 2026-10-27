import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { presentCatalogLoader } from "~/server/media-payload.server"
import type { LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getSmartTitlesForGuest, getSmartTitlesForUser } from "~/server/smart-titles.server"
import { getLocaleFromRequest } from "~/server/cache-identity.server"
import { getUserIdFromRequest } from "~/utils/auth"
import type { ScoringMedia } from "~/ui/scoring/types"

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const { locale } = getLocaleFromRequest(request)
	const userId = await getUserIdFromRequest({ request })
	
	// Parse query parameters
	let input: { count?: unknown; excludeIds?: unknown }
	try {
		input = request.method === "POST"
			? await request.json()
			: { count: url.searchParams.get("count") ?? 20, excludeIds: JSON.parse(url.searchParams.get("excludeIds") || "[]") }
	} catch {
		throw new Response("Invalid smart titles request", { status: 400 })
	}
	const count = Number(input?.count ?? 20)
	const items = input?.excludeIds ?? []
	if (!Number.isInteger(count) || count < 1 || count > 300 || !Array.isArray(items) ||
		items.some((item) => !item || !Number.isSafeInteger(item.tmdb_id) || item.tmdb_id < 1 ||
			(item.media_type !== "movie" && item.media_type !== "show"))) {
		throw new Response("Invalid smart titles request", { status: 400 })
	}
	const excludeIds = items as ExcludeItem[]
	
	// For authenticated users, fetch from DB
	if (userId) {
		const smartTitles = await getSmartTitlesForUser({
			userId,
			count,
			locale,
			excludeIds,
		})
		
		return { smartTitles }
	}
	
	// For guests, use passed params
	const smartTitles = await getSmartTitlesForGuest({
		count,
		locale,
		ratingsCount: 0,
		excludeIds,
	})
	
	return { smartTitles }
}

type ExcludeItem = {
	tmdb_id: number
	media_type: string
}

type SmartTitlesParams = {
	count: number
	excludeIds?: ExcludeItem[]
	enabled?: boolean
}

type GetSmartTitles = {
	smartTitles: ScoringMedia[]
}

export const queryKeySmartTitles = ["smartTitles"]

// Fetch smart titles - works for both guests and authenticated users
// The server determines which query to use based on auth status
export async function fetchSmartTitles({
	count,
	excludeIds = [],
	language = "en",
}: {
	language?: string
	count: number
	excludeIds?: ExcludeItem[]
}): Promise<ScoringMedia[]> {
	const params = new URLSearchParams({
		count: count.toString(),
	})
	
	if (excludeIds.length > 0) {
		params.set('excludeIds', JSON.stringify(excludeIds))
	}
	
	const url = mediaLanguageUrl(`/api/smart-titles?${params}`, language)
	// A long queue/history must not exceed proxy/browser request-target limits. Keep GET for small reads,
	// and send the same read parameters in a POST body once the encoded URL approaches 2 KB.
	const response = url.length <= 1800
		? await fetch(url)
		: await fetch(mediaLanguageUrl("/api/smart-titles", language), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ count, excludeIds }),
		})
	
	if (!response.ok) {
		throw new Error('Failed to fetch smart titles')
	}
	
	const data: GetSmartTitles = await response.json()
	return data.smartTitles
}

// React Query hook for initial load (used by loader prefetch)
export const useSmartTitles = ({ count, excludeIds = [], enabled = true }: SmartTitlesParams) => {
	const { locale } = useLocale()
	const excludeHash = excludeIds.length > 0 
		? JSON.stringify(excludeIds.map(item => `${item.tmdb_id}-${item.media_type}`).sort())
		: 'none'
	
	return useQuery<GetSmartTitles>({
		queryKey: [...queryKeySmartTitles, count, excludeHash, locale.language],
		queryFn: async () => {
			const smartTitles = await fetchSmartTitles({ count, excludeIds, language: locale.language })
			return { smartTitles }
		},
		enabled,
	})
}

export const loader = presentCatalogLoader(canonicalLoader, {})

// POST is a read-only fallback for long exclusion lists.
export const action = presentCatalogLoader(canonicalLoader, {})
