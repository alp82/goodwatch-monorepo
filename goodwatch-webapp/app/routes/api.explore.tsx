import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"

import { useQuery } from "@tanstack/react-query"
import {
	type ExploreParams,
	type ExploreResult,
	getExploreResults,
} from "~/server/explore.server"
import type { FilterMediaType } from "~/server/search.server"
import { mapCategoryToVectorName } from "~/ui/dna/dna_utils"

// type definitions

export type GetExploreResult = {
	type: FilterMediaType
	results: ExploreResult[]
}

// API endpoint

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const type = (url.searchParams.get("type") || "all") as ExploreParams["type"]
	const category = (url.searchParams.get("category") ||
		"dna") as ExploreParams["category"]
	const text = (url.searchParams.get("text") || "") as ExploreParams["text"]
	const country = (url.searchParams.get("country") ||
		"US") as ExploreParams["country"]
	const params = {
		type,
		category,
		text,
		country,
	}

	const { results } = await getExploreResults(params)

	return json<GetExploreResult>({
		type,
		results,
	})
}

// Query hook

export const queryKeyUserData = ["explore"]

export interface UseExploreParams {
	type?: FilterMediaType
	category: ExploreParams["category"]
	text: ExploreParams["text"]
	isInView: boolean
}

export const useExplore = ({
	type = "all",
	category,
	text,
	isInView,
}: UseExploreParams) => {
	const vectorCategory = mapCategoryToVectorName(category)
	const url = `/api/explore?type=${type}&category=${vectorCategory}&text=${text}`
	return useQuery<GetExploreResult>({
		queryKey: [...queryKeyUserData, type, vectorCategory, text],
		queryFn: async () => await (await fetch(url)).json(),
		enabled: isInView,
	})
}
