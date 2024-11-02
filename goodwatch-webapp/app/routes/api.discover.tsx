import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"

import { useQuery } from "@tanstack/react-query"
import {
	type DiscoverFilters,
	type DiscoverParams,
	type DiscoverResult,
	type DiscoverSortBy,
	type StreamingPreset,
	type WatchedType,
	getDiscoverResults,
} from "~/server/discover.server"
import type { FilterMediaType } from "~/server/search.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { getLocaleFromRequest } from "~/utils/locale"

// type definitions

export type GetDiscoverResult = DiscoverResult[]

// API endpoint

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ userId })

	const { locale } = getLocaleFromRequest(request)
	const url = new URL(request.url)
	const type = (url.searchParams.get("type") || "all") as FilterMediaType
	const country =
		url.searchParams.get("country") || userSettings?.country_default || ""
	const language = url.searchParams.get("language") || locale.language
	const minAgeRating = url.searchParams.get("minAgeRating") || ""
	const maxAgeRating = url.searchParams.get("maxAgeRating") || ""
	const minYear = url.searchParams.get("minYear") || ""
	// const maxYear = url.searchParams.get('maxYear') || new Date().getFullYear().toString()
	const maxYear = url.searchParams.get("maxYear") || ""
	const minScore = url.searchParams.get("minScore") || ""
	const maxScore = url.searchParams.get("maxScore") || ""
	const watchedType = (url.searchParams.get("watchedType") as WatchedType) || ""
	const withCast = url.searchParams.get("withCast") || ""
	const withoutCast = url.searchParams.get("withoutCast") || ""
	const withCrew = url.searchParams.get("withCrew") || ""
	const withoutCrew = url.searchParams.get("withoutCrew") || ""
	const withGenres = url.searchParams.get("withGenres") || ""
	const withoutGenres = url.searchParams.get("withoutGenres") || ""
	const withKeywords = url.searchParams.get("withKeywords") || ""
	const withoutKeywords = url.searchParams.get("withoutKeywords") || ""
	const streamingPreset =
		(url.searchParams.get("streamingPreset") as StreamingPreset) || ""
	const withStreamingProviders =
		url.searchParams.get("withStreamingProviders") ||
		(streamingPreset === "mine"
			? userSettings?.streaming_providers_default
			: "") ||
		""
	const sortBy = (url.searchParams.get("sortBy") ||
		"popularity") as DiscoverSortBy
	const sortDirection = (url.searchParams.get("sortDirection") || "desc") as
		| "asc"
		| "desc"

	const params = {
		userId,
		type,
		country,
		language,
		minAgeRating,
		maxAgeRating,
		minYear,
		maxYear,
		minScore,
		maxScore,
		watchedType,
		withCast,
		withoutCast,
		withCrew,
		withoutCrew,
		withGenres,
		withoutGenres,
		withKeywords,
		withoutKeywords,
		streamingPreset,
		withStreamingProviders,
		sortBy,
		sortDirection,
	}

	const results = await getDiscoverResults(params)

	return json<GetDiscoverResult>(results)
}

// Query hook

export const queryKeyDiscover = ["discover"]

export interface UseDiscoverParams {
	params: DiscoverParams
}

export const useDiscover = ({ params }: UseDiscoverParams) => {
	const queryParams = new URLSearchParams(params)
	const queryString = queryParams.toString()

	const url = `/api/discover?${queryString}`
	return useQuery<GetDiscoverResult>({
		queryKey: [...queryKeyDiscover, queryString],
		queryFn: async () => await (await fetch(url)).json(),
	})
}
