import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node";
import { type SearchResults, getSearchResults } from "~/server/search.server";

type LoaderData = {
	searchResults: Awaited<SearchResults>;
};

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url);
	const language = url.searchParams.get("language") || "en_US";
	const query = url.searchParams.get("query") || "";
	const rawResults = await getSearchResults({
		language,
		query,
	});
	const sortedResults = rawResults.sort((a, b) => {
		return a.popularity < b.popularity ? 1 : -1;
	});

	return json<LoaderData>({
		searchResults: sortedResults,
	});
};
