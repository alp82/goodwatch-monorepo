import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type SimilarMovie,
	type SimilarTV,
	getSimilarMedia,
} from "~/server/similar-media.server"
import type { MediaType } from "~/server/utils/query-db"
import type { sortedDNACategories } from "~/ui/dna/dna_utils"
import { getUserIdFromRequest } from "~/utils/auth"

export type GetSimilarMediaResult = {
	movies: SimilarMovie[]
	shows: SimilarTV[]
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const searchTerm = url.searchParams.get("searchTerm") || ""
	const withSimilarJson = url.searchParams.get("withSimilarJson") || ""

	const params = {
		searchTerm,
		withSimilarJson,
	}
	const { movies, shows } = await getSimilarMedia(params)

	return json<GetSimilarMediaResult>({
		movies,
		shows,
	})
}

// Query hook

export const queryKeySimilarMedia = ["similar-media"]

export interface WithSimilar {
	tmdbId: string
	mediaType: MediaType
	categories: (typeof sortedDNACategories)[number][]
}

export interface UseSimilarMediaParams {
	searchTerm: string
	withSimilar: WithSimilar[]
}

export const useSimilarMedia = ({
	searchTerm = "",
	withSimilar,
}: UseSimilarMediaParams) => {
	const withSimilarJson = JSON.stringify(withSimilar)

	const url = new URL("/api/similar-media", "https://goodwatch.app")
	url.searchParams.append("searchTerm", searchTerm)
	url.searchParams.append("withSimilarJson", withSimilarJson)

	return useQuery<GetSimilarMediaResult>({
		queryKey: queryKeySimilarMedia.concat([searchTerm, withSimilarJson]),
		queryFn: async () => await (await fetch(url.pathname + url.search)).json(),
		placeholderData: (previousData) => previousData,
	})
}
