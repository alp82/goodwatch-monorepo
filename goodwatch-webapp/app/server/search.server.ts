import { cached } from "~/utils/cache";

export type MediaType = "movie" | "tv";

export interface KnownFor {
	adult: boolean;
	backdrop_path: string;
	id: number;
	title: string;
	original_language: string;
	original_title: string;
	overview: string;
	poster_path: string;
	media_type: string;
	genre_ids: number[];
	popularity: number;
	release_date: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
}

export interface SearchResult {
	adult: boolean;
	backdrop_path: string;
	id: number;
	title: string;
	original_language: string;
	original_title: string;
	overview: string;
	poster_path: string;
	media_type: MediaType;
	genre_ids: number[];
	popularity: number;
	release_date: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
	name: string;
	original_name: string;
	gender?: number;
	known_for_department: string;
	profile_path?: any;
	known_for: KnownFor[];
	first_air_date: string;
	origin_country: string[];
}

export type SearchResults = SearchResult[];

export interface SearchParams {
	language: string;
	query: string;
}

export const getSearchResults = async (params: SearchParams) => {
	return await cached<SearchParams, SearchResults>({
		name: "search",
		target: _getSearchResults,
		params,
		ttlMinutes: 60 * 2,
	});
};

async function _getSearchResults({
	language,
	query,
}: SearchParams): Promise<SearchResults> {
	const response = await fetch(
		`https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&language=${language}&query=${query}`,
	).then((res) => res.json());

	return response.results.filter((result: SearchResult) =>
		["movie", "tv"].includes(result.media_type),
	);
}
