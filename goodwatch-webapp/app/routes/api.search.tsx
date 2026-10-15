import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { presentCatalogLoader } from "~/server/media-payload.server"
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

const canonicalLoader: LoaderFunction = async ({
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
		searchResults: sortedResults.map(row => ({ ...row, ...(!/^en(?:[-_]|$)/i.test(language) ? { canonical_language: "und" } : {}) })),
	})
}

// Query hook

export const queryKeySearch = ["search"]

export const useSearch = ({ language, query }: SearchParams) => {
	const { locale } = useLocale()
	const url = mediaLanguageUrl(`/api/search?language=${language}&query=${encodeURIComponent(query)}`, locale.language)
	return useQuery<GetSearchResults>({
		queryKey: [...queryKeySearch, language, query, locale.language],
		queryFn: async () => await (await fetch(url)).json(),
		placeholderData: (previousData) => previousData,
	})
}

export const loader = presentCatalogLoader(canonicalLoader, {})
