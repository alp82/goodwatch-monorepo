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
	const country = url.searchParams.get("country") ?? "US"
	const language = url.searchParams.get("language") ?? "en"

	if (!mediaType || !id) {
		throw new Response("Missing required parameters: mediaType and id", {
			status: 400,
		})
	}

	if (mediaType !== "movie" && mediaType !== "show") {
		throw new Response("Invalid media type. Must be 'movie' or 'show'", {
			status: 400,
		})
	}

	const details =
		mediaType === "movie"
			? await getDetailsForMovie({ movieId: id, country, language })
			: await getDetailsForShow({ showId: id, country, language })

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
	})

	return json<GetRelatedByCategoryResult>(relatedByCategory)
}

export const queryKeyRelatedByCategory = ["related-by-category"]

export interface UseRelatedByCategoryParams {
	mediaType: MediaType
	id: number
	country?: string
	language?: string
}

export const useRelatedByCategory = ({
	mediaType,
	id,
	country = "US",
	language = "en",
}: UseRelatedByCategoryParams) => {
	const url = new URL("/api/related-by-category", "https://goodwatch.app")
	url.searchParams.append("mediaType", mediaType)
	url.searchParams.append("id", id.toString())
	url.searchParams.append("country", country)
	url.searchParams.append("language", language)

	return useQuery<GetRelatedByCategoryResult>({
		queryKey: queryKeyRelatedByCategory.concat([
			mediaType,
			id.toString(),
			country,
			language,
		]),
		queryFn: async () => await (await fetch(url.pathname + url.search)).json(),
		placeholderData: (previousData) => previousData,
	})
}
