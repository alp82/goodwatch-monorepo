import type { LoaderFunction, LoaderFunctionArgs } from "@remix-run/node"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { WithSimilar } from "~/routes/api.similar-media"
import {
	type DiscoverParams,
	type DiscoverResults,
	getDiscoverResults,
} from "~/server/discover.server"
import type { MediaType } from "~/server/utils/query-db"
import { sortedDNACategories } from "~/ui/dna/dna_utils"
import { buildDiscoverParams } from "~/utils/discover"
import { SEPARATOR_SECONDARY, SEPARATOR_TERTIARY } from "~/utils/navigation"
import { DISCOVER_PAGE_SIZE } from "~/utils/constants"

// type definitions

export type GetDiscoverResult = DiscoverResults

// API endpoint

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const params = await buildDiscoverParams(request)
	return await getDiscoverResults(params)
}

// Query hook

export const queryKeyDiscover = ["discover"]

export interface UseDiscoverParams {
	params?: Partial<DiscoverParams>
	initialData?: { pages: DiscoverResults[]; pageParams: number[] }
	enabled?: boolean
}

export const useDiscover = ({
	params,
	initialData,
	enabled = true,
}: UseDiscoverParams) => {
	const initialPageParam = params?.page || 1
	if (params?.page) {
		delete params.page
	}
	const queryParams = new URLSearchParams(params as Record<string, string>)
	const queryString = queryParams.toString()
	return useInfiniteQuery<GetDiscoverResult>({
		queryKey: [...queryKeyDiscover, queryString],
		queryFn: async ({ pageParam }) => {
			queryParams.set("page", String(pageParam))
			const queryString = queryParams.toString()
			const url = `/api/discover?${queryString}`

			const response = await fetch(url)
			if (!response.ok) {
				throw new Error(`API request failed with status ${response.status}`)
			}
			const data: DiscoverResults = await response.json()
			if ("error" in data) {
				throw new Error((data.error as string) || "Unknown API error")
			}
			return data
		},
		getNextPageParam: (lastPage, allPages, lastPageParam) => {
			if (lastPage.length === DISCOVER_PAGE_SIZE) {
				return lastPageParam + 1
			}
			return undefined // Returning undefined signals no next page
		},
		initialPageParam,
		initialData,
		enabled,
	})
}

// Utils

export const convertSimilarTitles = (similarTitles: string): WithSimilar[] => {
	return similarTitles
		.split(",")
		.filter(Boolean)
		.map((similarTitle) =>
			(similarTitle || "").split(SEPARATOR_SECONDARY).filter(Boolean),
		)
		.map(([tmdbId, mediaType, categories]) => ({
			tmdbId,
			mediaType: mediaType as MediaType,
			categories: (categories || "")
				.split(SEPARATOR_TERTIARY)
				.filter((category) => sortedDNACategories.includes(category)),
		}))
}
