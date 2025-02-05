import type { LoaderFunction, LoaderFunctionArgs } from "@remix-run/node"

import { useQuery } from "@tanstack/react-query"
import type { WithSimilar } from "~/routes/api.similar-media"
import {
	type DiscoverParams,
	type DiscoverResult,
	getDiscoverResults,
} from "~/server/discover.server"
import type { MediaType } from "~/server/utils/query-db"
import { sortedDNACategories } from "~/ui/dna/dna_utils"
import { buildDiscoverParams } from "~/utils/discover"
import { SEPARATOR_SECONDARY, SEPARATOR_TERTIARY } from "~/utils/navigation"

// type definitions

export type GetDiscoverResult = DiscoverResult[]

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
	enabled?: boolean
}

export const useDiscover = ({ params, enabled = true }: UseDiscoverParams) => {
	const queryParams = new URLSearchParams(params)
	const queryString = queryParams.toString()

	const url = `/api/discover?${queryString}`
	return useQuery<GetDiscoverResult>({
		queryKey: [...queryKeyDiscover, queryString],
		queryFn: async () => await (await fetch(url)).json(),
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
