import type { LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getSmartTitlesForGuest, getSmartTitlesForUser } from "~/server/smart-titles.server"
import { getLocaleFromRequest } from "~/utils/locale"
import { getUserIdFromRequest } from "~/utils/auth"
import type { ScoringMedia } from "~/ui/scoring/types"

export async function loader({ request }: LoaderFunctionArgs) {
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
}: {
	count: number
	excludeIds?: ExcludeItem[]
}): Promise<ScoringMedia[]> {
	const params = new URLSearchParams({
		count: count.toString(),
	})
	
	if (excludeIds.length > 0) {
		params.set('excludeIds', JSON.stringify(excludeIds))
	}
	
	const url = `/api/smart-titles?${params}`
	const response = await fetch(url)
	
	if (!response.ok) {
		throw new Error('Failed to fetch smart titles')
	}
	
	const data: GetSmartTitles = await response.json()
	return data.smartTitles
}

// React Query hook for initial load (used by loader prefetch)
export const useSmartTitles = ({ count, excludeIds = [], enabled = true }: SmartTitlesParams) => {
	const excludeHash = excludeIds.length > 0 
		? JSON.stringify(excludeIds.map(item => `${item.tmdb_id}-${item.media_type}`).sort())
		: 'none'
	
	return useQuery<GetSmartTitles>({
		queryKey: [...queryKeySmartTitles, count, excludeHash],
		queryFn: async () => {
			const smartTitles = await fetchSmartTitles({ count, excludeIds })
			return { smartTitles }
		},
		enabled,
	})
}
