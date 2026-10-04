import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type RelatedMovie,
	type RelatedShow,
	getRelatedMovies,
	getRelatedPanel,
	getRelatedShows,
} from "~/server/related.server"
import { isValidFingerprintKey } from "~/server/utils/fingerprint"
import type { MediaType } from "~/server/utils/query-db"
import {
	type RelatedPanel,
	type RelatedPanelParams,
	relatedPanelQueryOptions,
} from "~/utils/related-panel"

export type GetRelatedMoviesResult = RelatedMovie[]
export type GetRelatedShowsResult = RelatedShow[]
export type GetRelatedPanelResult = RelatedPanel

const isMediaType = (value: string | null): value is MediaType =>
	value === "movie" || value === "show"

// Without `mediaType`, the answer is one panel of a title page's related titles section: the
// movies and the shows as cards, in one request. With `mediaType`, it is the full list of that
// type, which pages rendered before the panel request existed still ask for.
export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const tmdbId = url.searchParams.get("tmdbId")
	const fingerprintKey = url.searchParams.get("fingerprintKey")
	const sourceFingerprintScore = url.searchParams.get("sourceFingerprintScore")
	const mediaType = url.searchParams.get("mediaType")
	const sourceMediaType = url.searchParams.get("sourceMediaType")

	if (!tmdbId || !sourceMediaType) {
		throw new Response("Missing required parameters", { status: 400 })
	}

	if (fingerprintKey && !isValidFingerprintKey(fingerprintKey)) {
		throw new Response("Invalid fingerprint key", { status: 400 })
	}

	if (!mediaType) {
		if (!isMediaType(sourceMediaType) || !/^\d+$/.test(tmdbId)) {
			throw new Response("Invalid parameters", { status: 400 })
		}
		const panel = await getRelatedPanel({
			tmdbId: Number.parseInt(tmdbId),
			sourceMediaType,
			fingerprintKey: fingerprintKey || undefined,
			sourceFingerprintScore: sourceFingerprintScore
				? Number.parseFloat(sourceFingerprintScore)
				: undefined,
		})
		return json<GetRelatedPanelResult>(panel)
	}

	const params = {
		tmdb_id: Number.parseInt(tmdbId),
		fingerprint_key: fingerprintKey || undefined,
		source_fingerprint_score: sourceFingerprintScore
			? Number.parseFloat(sourceFingerprintScore)
			: undefined,
		source_media_type: sourceMediaType as MediaType,
	}

	if (mediaType === "movie") {
		const movies = await getRelatedMovies(params)
		return json<GetRelatedMoviesResult>(movies)
	}
	if (mediaType === "show") {
		const shows = await getRelatedShows(params)
		return json<GetRelatedShowsResult>(shows)
	}
	throw new Response("Invalid media type", { status: 400 })
}

// Query hook

/** One panel of related titles. The default panel's data comes with the document. */
export const useRelatedPanel = (params: RelatedPanelParams) =>
	useQuery<GetRelatedPanelResult>(relatedPanelQueryOptions(params))
