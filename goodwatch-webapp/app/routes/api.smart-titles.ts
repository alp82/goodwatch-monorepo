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
	const count = Number.parseInt(url.searchParams.get('count') || '20', 10)
	const excludeIdsParam = url.searchParams.get('excludeIds')
	const excludeIds = excludeIdsParam ? JSON.parse(excludeIdsParam) as Array<{ tmdb_id: number; media_type: string }> : []
	
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
	const response = await fetch(url)
	
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
