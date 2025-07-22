import type {
	DiscoverSortBy,
	StreamingPreset,
	WatchedType,
} from "~/server/discover.server"
import type { FilterMediaType } from "~/server/search.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { getLocaleFromRequest } from "~/utils/locale"

export const buildDiscoverParams = async (request: Request) => {
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
	const withCastCombinationType =
		url.searchParams.get("withCastCombinationType") || ""
	const withoutCast = url.searchParams.get("withoutCast") || ""
	const withCrew = url.searchParams.get("withCrew") || ""
	const withCrewCombinationType =
		url.searchParams.get("withCrewCombinationType") || ""
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
	const withStreamingTypes =
		url.searchParams.get("withStreamingTypes") || "free,flatrate"
	const similarDNA = url.searchParams.get("similarDNA") || ""
	const similarDNACombinationType =
		url.searchParams.get("similarDNACombinationType") || ""
	const similarTitles = url.searchParams.get("similarTitles") || ""
	const fingerprintConditions = url.searchParams.get("fingerprintConditions") || ""
	const suitabilityFilters = url.searchParams.get("suitabilityFilters") || ""
	const contextFilters = url.searchParams.get("contextFilters") || ""
	const sortBy = (url.searchParams.get("sortBy") ||
		"popularity") as DiscoverSortBy
	const sortDirection = (url.searchParams.get("sortDirection") || "desc") as
		| "asc"
		| "desc"
	const page = Math.max(
		1,
		Number.parseInt(url.searchParams.get("page") || "1", 10),
	)

	return {
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
		withCastCombinationType,
		withoutCast,
		withCrew,
		withCrewCombinationType,
		withoutCrew,
		withGenres,
		withoutGenres,
		withKeywords,
		withoutKeywords,
		withStreamingProviders,
		withStreamingTypes,
		streamingPreset,
		similarDNA,
		similarDNACombinationType,
		similarTitles,
		fingerprintConditions,
		suitabilityFilters,
		contextFilters,
		sortBy,
		sortDirection,
		page,
	}
}
