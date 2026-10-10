import { fetchJsonWithBackendTimeout, timeoutSetting, TMDB_TIMEOUT_DEFAULT_MS } from "../utils/backend-timeout.ts";
import { cached } from "~/utils/cache";

export interface Keyword {
	id: number;
	name: string;
}

export interface KeywordsResults {
	page: number;
	results: Keyword[];
	total_pages: number;
	total_results: number;
}

export interface KeywordSearchParams {
	query: string;
}

export interface KeywordsParams {
	keywordIds: string[];
}

export const getKeywordSearchResults = async (
	params: KeywordSearchParams,
): Promise<KeywordsResults> => {
	return await cached<KeywordSearchParams, KeywordsResults>({
		name: "keywords",
		target: _getKeywordSearchResults,
		params,
		ttlMinutes: 60 * 2,
	});
};

export async function _getKeywordSearchResults({
	query,
}: KeywordSearchParams): Promise<KeywordsResults> {
	return await fetchJsonWithBackendTimeout(
		"TMDB", timeoutSetting("TMDB_TIMEOUT_MS", TMDB_TIMEOUT_DEFAULT_MS),
		`https://api.themoviedb.org/3/search/keyword?api_key=${process.env.TMDB_API_KEY}&query=${query}`,
	);
}

export const getKeywords = async ({
	keywordIds,
}: KeywordsParams): Promise<Keyword[]> => {
	// TODO keywords
	const response = {};

	return (response.data || []) as Keyword[];
};
