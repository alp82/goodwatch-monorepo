import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getDetailsForMovie, getDetailsForShow } from "~/server/details.server"
import {
	type RelatedByCategory,
	getRelatedByCategory,
} from "~/server/related.server"
import type { MediaType } from "~/server/utils/query-db"

export type GetRelatedByCategoryResult = RelatedByCategory

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const mediaType = url.searchParams.get("mediaType") as MediaType
	const id = url.searchParams.get("id")
	const countries = url.searchParams.get("countries")
	const streamingIds = url.searchParams.get("streaming_ids")
	const language = url.searchParams.get("language") ?? "en"

	if (!mediaType || !id || !countries) {
		throw new Response("Missing required parameters: mediaType, id, and countries", {
			status: 400,
		})
	}

	if (mediaType !== "movie" && mediaType !== "show") {
		throw new Response("Invalid media type. Must be 'movie' or 'show'", {
			status: 400,
		})
	}

	// Parse countries and streaming_ids
	const countryList = countries.split(",").map(c => c.trim().toUpperCase())
	const streamingIdList = streamingIds 
		? streamingIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id))
		: undefined

	const details =
		mediaType === "movie"
			? await getDetailsForMovie({ movieId: id, country: countryList[0], language })
			: await getDetailsForShow({ showId: id, country: countryList[0], language })

	if (!details?.fingerprint) {
		throw new Response("No fingerprint data available for this title", {
			status: 404,
		})
	}

	const { highlightKeys, scores } = details.fingerprint

	const relatedByCategory = await getRelatedByCategory({
		tmdb_id: parseInt(id),
		media_type: mediaType,
		highlight_keys: highlightKeys,
		fingerprint_scores: scores,
		countries: countryList,
		streaming_ids: streamingIdList,
	})

	return json<GetRelatedByCategoryResult>(relatedByCategory)
}

export const queryKeyRelatedByCategory = ["related-by-category"]

export interface UseRelatedByCategoryParams {
	mediaType: MediaType
	id: number
	countries: string
	streaming_ids?: string
	language?: string
}

export const useRelatedByCategory = ({
	mediaType,
	id,
	countries,
	streaming_ids,
	language = "en",
}: UseRelatedByCategoryParams) => {
	const url = new URL("/api/related-by-category", "https://goodwatch.app")
	url.searchParams.append("mediaType", mediaType)
	url.searchParams.append("id", id.toString())
	url.searchParams.append("countries", countries)
	if (streaming_ids) {
		url.searchParams.append("streaming_ids", streaming_ids)
	}
	url.searchParams.append("language", language)

	return useQuery<GetRelatedByCategoryResult>({
		queryKey: queryKeyRelatedByCategory.concat([
			mediaType,
			id.toString(),
			countries,
			streaming_ids ?? '',
			language,
		]),
		queryFn: async () => await (await fetch(url.pathname + url.search)).json(),
		placeholderData: (previousData) => previousData,
	})
}
