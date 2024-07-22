import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"

import {
	type ExploreParams,
	type ExploreResult,
	getExploreResults,
} from "~/server/explore.server"

export type LoaderData = {
	type: "movies" | "tv"
	results: ExploreResult[]
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const type = (url.searchParams.get("type") ||
		"movies") as ExploreParams["type"]
	const category = (url.searchParams.get("category") ||
		"dna") as ExploreParams["category"]
	const query = (url.searchParams.get("query") || "") as ExploreParams["query"]
	const params = {
		type,
		category,
		query,
	}

	const { results } = await getExploreResults(params)

	return json<LoaderData>({
		type,
		results,
	})
}
