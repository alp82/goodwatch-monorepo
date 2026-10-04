import type {
	DetailsMovieParams,
	DetailsShowParams,
} from "~/server/types/details-types"
import { cached } from "~/utils/cache"
import { canonicalTitleId } from "~/utils/title-identity"
import { type RawTitleDetails, trimTitleDetails } from "./title-details-shape"

// The names are part of the cache keys. v2 holds the trimmed shape (see title-details-shape): code
// that expects the full statement result (the unversioned names) must never read these values.
export const DETAILS_MOVIE_CACHE_NAME = "details-movie-v2"
export const DETAILS_SHOW_CACHE_NAME = "details-show-v2"
export const DETAILS_TTL_MINUTES = 30
export const DETAILS_STALE_MINUTES = 30

type FetchDetails = (
	mediaType: "movie" | "show",
	id: string,
	country: string,
	language: string,
) => Promise<RawTitleDetails>
function normalized(
	id: string,
	country: string,
	language: string,
	mediaType: "movie" | "show",
) {
	if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)))
		throw new Response("Not Found", { status: 404 })
	return {
		id:
			mediaType === "movie"
				? String(canonicalTitleId(mediaType, Number(id)))
				: id,
		country: /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : "",
		language: /^[a-z]{2}$/i.test(language) ? language.toLowerCase() : "en",
	}
}
/** The production cache wiring with an injectable raw fetch for offline tests. */
export function createTitleDetailsGetters(fetchDetails: FetchDetails) {
	const movieTarget = async ({
		movieId,
		country,
		language,
	}: DetailsMovieParams) => ({
		...trimTitleDetails(
			await fetchDetails("movie", movieId, country, language),
			"movie",
			country,
		),
	})
	const showTarget = async ({
		showId,
		country,
		language,
	}: DetailsShowParams) => ({
		...trimTitleDetails(
			await fetchDetails("show", showId, country, language),
			"show",
			country,
		),
	})
	return {
		async getDetailsForMovie(
			params: DetailsMovieParams,
			options?: { bypassCache: boolean },
		) {
			const {
				id: movieId,
				country,
				language,
			} = normalized(params.movieId, params.country, params.language, "movie")
			const clean = { movieId, country, language }
			return options?.bypassCache
				? movieTarget(clean)
				: cached({
						name: DETAILS_MOVIE_CACHE_NAME,
						target: movieTarget,
						params: clean,
						ttlMinutes: DETAILS_TTL_MINUTES,
						staleMinutes: DETAILS_STALE_MINUTES,
					})
		},
		async getDetailsForShow(
			params: DetailsShowParams,
			options?: { bypassCache: boolean },
		) {
			const {
				id: showId,
				country,
				language,
			} = normalized(params.showId, params.country, params.language, "show")
			const clean = { showId, country, language }
			return options?.bypassCache
				? showTarget(clean)
				: cached({
						name: DETAILS_SHOW_CACHE_NAME,
						target: showTarget,
						params: clean,
						ttlMinutes: DETAILS_TTL_MINUTES,
						staleMinutes: DETAILS_STALE_MINUTES,
					})
		},
	}
}
