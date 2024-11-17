import {
	increasePriorityForMovies,
	increasePriorityForTVs,
} from "~/server/utils/priority";
import { cached } from "~/utils/cache";
import { executeQuery } from "~/utils/postgres";
import { type AllRatings, getRatingKeys } from "~/utils/ratings";
import { duplicateProviders } from "~/utils/streaming-links";

export interface Collection {
	id: number;
	name: string;
	overview: string;
	poster_path: string;
	backdrop_path: string;
	movie_ids: number[];
}

export type DNA = Record<string, string[]>;

export interface BaseDetails extends AllRatings {
	dna: DNA;
	genres: string[];
	keywords: string[];
	release_year: string;
	streaming_links: StreamingLink[];
	streaming_country_codes: string[];
	title_dashed: string;
	title_underscored: string;
}

export interface ProviderData {
	logo_path: string;
	provider_id: number;
	provider_name: string;
	display_priority: number;
}

export interface StreamingProviders {
	buy: ProviderData[];
	flatrate: ProviderData[];
	flatrate_and_buy: ProviderData[];
	rent: ProviderData[];
}

export interface StreamingLink {
	provider_id: number;
	provider_name: string;
	provider_logo_path: string;
	tmdb_url: string;
	stream_type:
		| "ads"
		| "buy"
		| "flatrate"
		| "flatrate_and_buy"
		| "free"
		| "rent";
	stream_url: string;
	price_dollar: number;
	quality: string;
	display_priority: number;
}

export interface Genre {
	id: number;
	name: string;
}

export interface ProductionCompany {
	id: number;
	logo_path: string;
	name: string;
	origin_country: string;
}

export interface ProductionCountry {
	iso_3166_1: string;
	name: string;
}

export interface SpokenLanguage {
	english_name: string;
	iso_639_1: string;
	name: string;
}

export interface ContentRatingResult {
	descriptors: any[];
	iso_3166_1: string;
	rating: string;
}

export enum Department {
	Acting = "Acting",
	Art = "Art",
	Camera = "Camera",
	CostumeMakeUp = "Costume & Make-Up",
	Directing = "Directing",
	Editing = "Editing",
	Lighting = "Lighting",
	Production = "Production",
	Sound = "Sound",
	Writing = "Writing",
}

export interface Cast {
	adult: boolean;
	gender: number;
	id: number;
	known_for_department: Department;
	name: string;
	original_name: string;
	popularity: number;
	profile_path: null | string;
	cast_id?: number;
	character?: string;
	credit_id: string;
	order?: number;
	department?: Department;
	job?: string;
}

export interface RecommendationResult {
	adult: boolean;
	backdrop_path: string;
	id: number;
	name: string;
	original_language: string;
	original_name: string;
	overview: string;
	poster_path: string;
	media_type: string;
	genre_ids: number[];
	popularity: number;
	first_air_date: string;
	vote_average: number;
	vote_count: number;
	origin_country: string[];
}

export interface Recommendations {
	page: number;
	results: RecommendationResult[];
	total_pages: number;
	total_results: number;
}

export interface ReleaseDate {
	certification: string;
	descriptors: any[];
	iso_639_1: string;
	note: string;
	release_date: string | Date;
	type: number;
}

export interface VideoResult {
	iso_639_1: string;
	iso_3166_1: string;
	name: string;
	key: string;
	published_at: string | Date;
	site: string;
	size: number;
	type: string;
	official: boolean;
	id: string;
}

export interface Videos {
	clips: VideoResult[];
	featurettes: VideoResult[];
	trailers: VideoResult[];
}

export interface MovieDetails extends BaseDetails {
	media_type: "movie";
	tmdb_id: number;
	adult: boolean;
	backdrop_path: string;
	budget: number;
	cast: Cast[];
	certifications?: ReleaseDate[];
	collection?: Collection;
	crew: Cast[];
	homepage: string;
	imdb_id: string;
	original_language: string;
	original_title: string;
	popularity: number;
	poster_path: string;
	production_companies: ProductionCompany[];
	production_countries: ProductionCountry[];
	release_date: string;
	revenue: number;
	runtime: number;
	spoken_languages: SpokenLanguage[];
	status: string;
	synopsis: string;
	tagline: string;
	title: string;
	video: boolean;
	vote_average: number;
	vote_count: number;
	recommendations: Recommendations;
	videos: Videos;
	streaming_providers: StreamingProviders;
}

export interface CreatedBy {
	id: number;
	credit_id: string;
	name: string;
	gender: number;
	profile_path: string;
}

export interface LastEpisodeToAir {
	id: number;
	name: string;
	overview: string;
	vote_average: number;
	vote_count: number;
	air_date: string;
	episode_number: number;
	production_code: string;
	runtime: number;
	season_number: number;
	show_id: number;
	still_path: string;
}

export interface Network {
	id: number;
	logo_path: string;
	name: string;
	origin_country: string;
}

export interface Season {
	air_date: string;
	episode_count: number;
	id: number;
	name: string;
	overview: string;
	poster_path: string;
	season_number: number;
}

export interface ExternalIds {
	imdb_id: string;
	freebase_mid: string;
	freebase_id: string;
	tvdb_id: number;
	tvrage_id: number;
	wikidata_id: string;
	facebook_id: string;
	instagram_id: string;
	twitter_id: string;
}

export interface TVDetails extends BaseDetails {
	media_type: "tv";
	tmdb_id: number;
	adult: boolean;
	backdrop_path: string;
	cast: Cast[];
	certifications?: ContentRatingResult[];
	created_by: CreatedBy[];
	crew: Cast[];
	episode_run_time: number[];
	external_ids: ExternalIds;
	first_air_date: string;
	homepage: string;
	in_production: boolean;
	languages: string[];
	last_air_date: string;
	last_episode_to_air: LastEpisodeToAir;
	title: string;
	next_episode_to_air?: any;
	networks: Network[];
	number_of_episodes: number;
	number_of_seasons: number;
	origin_country: string[];
	original_language: string;
	original_title: string;
	popularity: number;
	poster_path: string;
	production_companies: ProductionCompany[];
	production_countries: ProductionCountry[];
	recommendations: Recommendations;
	seasons: Season[];
	spoken_languages: SpokenLanguage[];
	streaming_providers: StreamingProviders;
	status: string;
	synopsis: string;
	tagline: string;
	type: string;
	videos: Videos;
	vote_average: number;
	vote_count: number;
}

export interface DetailsMovieParams {
	movieId: string;
	country: string;
	language: string;
}

export interface DetailsTVParams {
	tvId: string;
	country: string;
	language: string;
}

export const getCountrySpecificDetails = (
	details: any,
	country: string,
	language: string,
) => {
	const alternative_titles = (details.alternative_titles || []).filter(
		(title: Record<string, string>) => title.iso_3166_1 === country,
	);
	details.alternative_title = alternative_titles.length
		? alternative_titles[0].title
		: null;
	details.alternative_titles = undefined;

	if (Array.isArray(details.certifications)) {
		const certifications = (details.certifications || []).filter(
			(certification: Record<string, string>) =>
				certification.iso_3166_1 === country,
		);
		details.certifications = certifications.length
			? certifications[0].release_dates
			: null;
	} else {
		const certifications = details.certifications?.[country.toUpperCase()];
		details.certifications = certifications || null;
	}

	const streaming_providers =
		details.streaming_providers?.[country.toUpperCase()];
	details.streaming_providers = streaming_providers || null;

	const translations = (details.translations || []).filter(
		(translation: Record<string, string>) =>
			translation.iso_3166_1 === country || translation.iso_639_1 === language,
	);
	details.translations = translations.length ? translations : null;
	return details;
};

export const getDetailsForMovie = async (params: DetailsMovieParams) => {
	return await cached<DetailsMovieParams, MovieDetails>({
		name: "details-movie",
		target: _getDetailsForMovie,
		params,
		ttlMinutes: 20,
		// ttlMinutes: 0,
	});
};

export const getDetailsForTV = async (params: DetailsTVParams) => {
	return await cached<DetailsTVParams, TVDetails>({
		name: "details-tv",
		target: _getDetailsForTV,
		params,
		ttlMinutes: 20,
		// ttlMinutes: 0,
	});
};

const movieFields = [
	"tmdb_id",
	"backdrop_path",
	"cast",
	"certifications",
	"crew",
	"collection",
	"dna",
	"keywords",
	"genres",
	"poster_path",
	"release_year",
	"runtime",
	"streaming_country_codes",
	"synopsis",
	"tagline",
	"title",
	"videos",
	...getRatingKeys(),
];

const tvFields = [
	"tmdb_id",
	"backdrop_path",
	"cast",
	"certifications",
	"crew",
	"dna",
	"keywords",
	"genres",
	"number_of_episodes",
	"number_of_seasons",
	"poster_path",
	"release_year",
	"streaming_country_codes",
	"synopsis",
	"tagline",
	"title",
	"videos",
	...getRatingKeys(),
];

// TODO language
export async function _getDetailsForMovie({
	movieId,
	country,
	language,
}: DetailsMovieParams): Promise<MovieDetails> {
	const query = `
    SELECT
      ${movieFields.map((field) => `m.${field}`).join(", ")},
      json_agg(
        json_build_object(
          'provider_id', spl.provider_id,
          'provider_name', sp.name,
          'provider_logo_path', sp.logo_path,
          'tmdb_url', spl.tmdb_url,
          'stream_type', spl.stream_type,
          'stream_url', spl.stream_url,
          'price_dollar', spl.price_dollar,
          'quality', spl.quality,
          'display_priority', spl.display_priority
        )
      ) AS streaming_links
    FROM
      movies m
    LEFT JOIN
      streaming_provider_links spl
    ON
      spl.tmdb_id = m.tmdb_id
      AND spl.media_type = 'movie'
      AND spl.country_code = $1
      AND spl.provider_id NOT IN (${duplicateProviders.join(",")})
    LEFT JOIN
      streaming_providers sp
    ON
      spl.provider_id = sp.id
    WHERE
      m.tmdb_id = $2
    GROUP BY
      m.tmdb_id
    ORDER BY
      MIN(sp.display_priority);
  `;
	const result = await executeQuery(query, [country, movieId]);

	if (!result.rows.length) {
		// TODO fallback page
		increasePriorityForMovies([movieId], 100);
		throw Error(`movie with ID "${movieId}" not found`);
	}

	const movie = {
		...result.rows[0],
		media_type: "movie",
	};
	increasePriorityForMovies([movie.tmdb_id]);

	return getCountrySpecificDetails(movie, country, language);
}

// TODO language
export async function _getDetailsForTV({
	tvId,
	country,
	language,
}: DetailsTVParams): Promise<TVDetails> {
	const query = `
    SELECT
      ${tvFields.map((field) => `t.${field}`).join(", ")},
      json_agg(
        json_build_object(
          'provider_id', spl.provider_id,
          'provider_name', sp.name,
          'provider_logo_path', sp.logo_path,
          'stream_type', spl.stream_type,
          'stream_url', spl.stream_url,
          'price_dollar', spl.price_dollar,
          'quality', spl.quality,
          'display_priority', spl.display_priority
        )
      ) AS streaming_links
    FROM
      tv t
    LEFT JOIN
      streaming_provider_links spl
    ON
      spl.tmdb_id = t.tmdb_id
      AND spl.media_type = 'tv'
      AND spl.country_code = $1
      AND spl.provider_id NOT IN (${duplicateProviders.join(",")})
    LEFT JOIN
      streaming_providers sp
    ON
      spl.provider_id = sp.id
    WHERE
      t.tmdb_id = $2
    GROUP BY
      t.tmdb_id
    ORDER BY
      MIN(sp.display_priority);
  `;
	const result = await executeQuery(query, [country, tvId]);

	if (!result.rows.length) {
		// TODO fallback page
		increasePriorityForTVs([tvId], 100);
		throw Error(`tv show with ID "${tvId}" not found`);
	}

	const tv = {
		...result.rows[0],
		media_type: "tv",
	};
	increasePriorityForTVs([tv.tmdb_id]);

	return getCountrySpecificDetails(tv, country, language);
}
