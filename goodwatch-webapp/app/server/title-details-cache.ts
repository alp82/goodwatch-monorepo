import type {
	DetailsMovieParams,
	DetailsShowParams,
} from "~/server/types/details-types"
import { cached, readCacheMarker, writeCacheMarker } from "~/utils/cache"
import { canonicalTitleId } from "~/utils/title-identity"
import { type RawTitleDetails, trimTitleDetails } from "./title-details-shape"

// The names are part of the cache keys. These versions select exact crew jobs before department
// fallback, so entries holding the previous department-wide selection must never be reused. Movie v4
// adds the Letterboxd score fields. Show v5 adds the show's status (the title page's status chip): a v4
// entry has none, so the chip would be missing for up to a day after a deploy.
export const DETAILS_MOVIE_CACHE_NAME = "details-movie-v8"
export const DETAILS_SHOW_CACHE_NAME = "details-show-v9"
// Movie v8 and show v9 add every reported award result (award_results) for the title page's awards link and At a
// glance's Awards row. Movie v7 and show v8 read the combined TVDB and Wikidata award view.
// Movie v6 and show v7 include bounded, partial TVDB title award observations.
// Movie v5 and show v6 prefer the primary TVDB actor photo, keeping TMDB as fallback.
// Title data may be up to 24 hours old. A value is fresh for 12 hours, and for 12 more hours it is
// served while one refresh runs. So a title that is requested often is at most 12 hours behind, the
// data cache keeps every value for 24 hours, and nothing older than that is served. The value holds
// the country's streaming offers and the scores: this is how far behind the imports they can be.
export const DETAILS_TTL_MINUTES = 12 * 60
export const DETAILS_STALE_MINUTES = 12 * 60
// The award read is optional with a 200 ms budget inside the fill. A title whose awards were late is stored all the
// same (the page needs no second Crate round trip), but it is fresh for this long only: the next request after that
// serves it and one background refresh reads the title again, awards included. Its physical lifetime is unchanged.
export const DETAILS_AWARDS_LATE_MINUTES = 10

// A title that doesn't exist gets a marker under its own cache name, so that a burst of requests
// for one dead link sends one statement to Crate per minute instead of one per request. The
// marker is per title, not per country or language. It is written only when the statement ran
// and returned no row: a failed or timed-out statement throws and stores nothing. A title that
// the pipelines add later answers 404 for at most this long after its first failed lookup, and
// a marker is never served stale.
export const DETAILS_MISSING_CACHE_NAME = "details-missing-v1"
export const DETAILS_MISSING_TTL_SECONDS = 60

// Crosses the data cache as a plain error, so that all callers of one shared run can share it.
// Each caller gets its own 404 Response from the getters below.
class TitleNotFound extends Error {
	constructor() {
		super("title not found")
	}
}
const notFound = (error: unknown): never => {
	throw error instanceof TitleNotFound
		? new Response("Not Found", { status: 404 })
		: error
}

/** Resolves with null when the title doesn't exist, and rejects when the lookup itself failed. */
type FetchDetails = (
	mediaType: "movie" | "show",
	id: string,
	country: string,
	language: string,
) => Promise<RawTitleDetails | null>
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
	// The marker is read only after the details cache missed, so a stored title costs one lookup.
	const fetchExisting = async (
		mediaType: "movie" | "show",
		id: string,
		country: string,
		language: string,
		useMarker: boolean,
	) => {
		const marker = { mediaType, id }
		if (
			useMarker &&
			(await readCacheMarker(
				DETAILS_MISSING_CACHE_NAME,
				marker,
				DETAILS_MISSING_TTL_SECONDS,
			))
		)
			throw new TitleNotFound()
		const details = await fetchDetails(mediaType, id, country, language)
		if (details === null) {
			if (useMarker)
				await writeCacheMarker(
					DETAILS_MISSING_CACHE_NAME,
					marker,
					DETAILS_MISSING_TTL_SECONDS,
				)
			throw new TitleNotFound()
		}
		return details
	}
	// The trimmed values whose award read was late; the cache keeps them fresh for less than the lifetime.
	const awardsLate = new WeakSet<object>()
	const freshMinutes = (value: object) =>
		awardsLate.has(value) ? DETAILS_AWARDS_LATE_MINUTES : undefined
	const movieTarget = async (
		{ movieId, country, language }: DetailsMovieParams,
		useMarker = true,
	) => {
		const raw = await fetchExisting("movie", movieId, country, language, useMarker)
		const value = { ...trimTitleDetails(raw, "movie", country) }
		if (raw.awards_late) awardsLate.add(value)
		return value
	}
	const showTarget = async (
		{ showId, country, language }: DetailsShowParams,
		useMarker = true,
	) => {
		const raw = await fetchExisting("show", showId, country, language, useMarker)
		const value = { ...trimTitleDetails(raw, "show", country) }
		if (raw.awards_late) awardsLate.add(value)
		return value
	}
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
			return (
				options?.bypassCache
					? movieTarget(clean, false)
					: cached({
							name: DETAILS_MOVIE_CACHE_NAME,
							target: movieTarget,
							params: clean,
							ttlMinutes: DETAILS_TTL_MINUTES,
							staleMinutes: DETAILS_STALE_MINUTES,
							freshMinutes,
						})
			).catch(notFound)
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
			return (
				options?.bypassCache
					? showTarget(clean, false)
					: cached({
							name: DETAILS_SHOW_CACHE_NAME,
							target: showTarget,
							params: clean,
							ttlMinutes: DETAILS_TTL_MINUTES,
							staleMinutes: DETAILS_STALE_MINUTES,
							freshMinutes,
						})
			).catch(notFound)
		},
	}
}
