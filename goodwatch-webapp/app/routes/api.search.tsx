import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type SearchParams,
	type SearchResults,
	getSearchResults,
} from "~/server/search.server"

type GetSearchResults = {
	searchResults: Awaited<SearchResults>
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const language = url.searchParams.get("language") || "en_US"
	const query = url.searchParams.get("query") || ""
	const rawResults = await getSearchResults({
		language,
		query,
	})
	const sortedResults = rawResults.sort((a, b) => {
		return a.popularity < b.popularity ? 1 : -1
	})

	return json<GetSearchResults>({
		searchResults: sortedResults,
	})
}

// Query hook

export const queryKeySearch = ["search"]

export const useSearch = ({ language, query }: SearchParams) => {
	const url = `/api/search?language=${language}&query=${query}`
	return useQuery<GetSearchResults>({
		queryKey: [...queryKeySearch, language, query],
		queryFn: async () => await (await fetch(url)).json(),
		placeholderData: (previousData) => previousData,
	})
}
