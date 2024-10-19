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
	getDiscoverResults,
} from "~/server/discover.server"
import type { FilterMediaType } from "~/server/search.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { getLocaleFromRequest } from "~/utils/locale"

// type definitions

export type GetDiscoverResult = {
	type: FilterMediaType
	results: DiscoverResult[]
	filters: DiscoverFilters
}

// API endpoint

export const loader: LoaderFunction = async ({
	params: { type },
	request,
}: LoaderFunctionArgs) => {
	const paramsType = (type || "all") as FilterMediaType

	const user_id = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ user_id })

	const { locale } = getLocaleFromRequest(request)
	const url = new URL(request.url)
	const mode = (url.searchParams.get("mode") || "advanced") as "advanced"
	const country =
		userSettings?.country_default || url.searchParams.get("country") || ""
	const language = url.searchParams.get("language") || locale.language
	const minAgeRating = url.searchParams.get("minAgeRating") || ""
	const maxAgeRating = url.searchParams.get("maxAgeRating") || ""
	const minYear = url.searchParams.get("minYear") || ""
	// const maxYear = url.searchParams.get('maxYear') || new Date().getFullYear().toString()
	const maxYear = url.searchParams.get("maxYear") || ""
	const minScore = url.searchParams.get("minScore") || ""
	const withCast = url.searchParams.get("withCast") || ""
	const withCrew = url.searchParams.get("withCrew") || ""
	const withKeywords = url.searchParams.get("withKeywords") || ""
	const withoutKeywords = url.searchParams.get("withoutKeywords") || ""
	const withGenres = url.searchParams.get("withGenres") || ""
	const withoutGenres = url.searchParams.get("withoutGenres") || ""
	const withStreamingProviders =
		url.searchParams.get("withStreamingProviders") ||
		userSettings?.streaming_providers_default ||
		""
	const sortBy = (url.searchParams.get("sortBy") ||
		"popularity") as DiscoverSortBy
	const sortDirection = (url.searchParams.get("sortDirection") || "desc") as
		| "asc"
		| "desc"

	const params = {
		type: paramsType,
		mode,
		country,
		language,
		minAgeRating,
		maxAgeRating,
		minYear,
		maxYear,
		minScore,
		withCast,
		withCrew,
		withKeywords,
		withoutKeywords,
		withGenres,
		withoutGenres,
		withStreamingProviders,
		sortBy,
		sortDirection,
	}

	const { results, filters } = await getDiscoverResults(params)

	return json<GetDiscoverResult>({
		type,
		results,
		filters,
	})
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
