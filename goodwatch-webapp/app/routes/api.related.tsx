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
	getRelatedShows,
} from "~/server/related.server"
import type { MediaType } from "~/server/utils/query-db"
import { isValidFingerprintKey } from "~/server/utils/fingerprint"

export type GetRelatedMoviesResult = RelatedMovie[]
export type GetRelatedShowsResult = RelatedShow[]

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const tmdbId = url.searchParams.get("tmdbId")
	const fingerprintKey = url.searchParams.get("fingerprintKey")
	const sourceFingerprintScore = url.searchParams.get("sourceFingerprintScore")
	const mediaType = url.searchParams.get("mediaType") as MediaType
	const sourceMediaType = url.searchParams.get("sourceMediaType") as MediaType

	if (!tmdbId || !mediaType || !sourceMediaType) {
		throw new Response("Missing required parameters", { status: 400 })
	}

	if (fingerprintKey && !isValidFingerprintKey(fingerprintKey)) {
		throw new Response("Invalid fingerprint key", { status: 400 })
	}

	const params = {
		tmdb_id: parseInt(tmdbId),
		fingerprint_key: fingerprintKey || undefined,
		source_fingerprint_score: sourceFingerprintScore ? parseFloat(sourceFingerprintScore) : undefined,
		source_media_type: sourceMediaType,
	}

	if (mediaType === "movie") {
		const movies = await getRelatedMovies(params)
		return json<GetRelatedMoviesResult>(movies)
	} else if (mediaType === "show") {
		const shows = await getRelatedShows(params)
		return json<GetRelatedShowsResult>(shows)
	} else {
		throw new Response("Invalid media type", { status: 400 })
	}
}

// Query hooks

export const queryKeyRelatedMovies = ["related-movies"]
export const queryKeyRelatedShows = ["related-shows"]

export interface UseRelatedMoviesParams {
	tmdbId: number
	fingerprintKey?: string
	sourceFingerprintScore?: number
	sourceMediaType: MediaType
}

export interface UseRelatedShowsParams {
	tmdbId: number
	fingerprintKey?: string
	sourceFingerprintScore?: number
	sourceMediaType: MediaType
}

export const useRelatedMovies = ({
	tmdbId,
	fingerprintKey,
	sourceFingerprintScore,
	sourceMediaType,
}: UseRelatedMoviesParams) => {
	const url = new URL("/api/related", "https://goodwatch.app")
	url.searchParams.append("tmdbId", tmdbId.toString())
	if (fingerprintKey) url.searchParams.append("fingerprintKey", fingerprintKey)
	if (sourceFingerprintScore !== undefined) url.searchParams.append("sourceFingerprintScore", sourceFingerprintScore.toString())
	url.searchParams.append("mediaType", "movie")
	url.searchParams.append("sourceMediaType", sourceMediaType)

	return useQuery<GetRelatedMoviesResult>({
		queryKey: queryKeyRelatedMovies.concat([tmdbId.toString(), fingerprintKey ?? "overall", sourceFingerprintScore?.toString() ?? "none", sourceMediaType]),
		queryFn: async () => await (await fetch(url.pathname + url.search)).json(),
		placeholderData: (previousData) => previousData,
	})
}

export const useRelatedShows = ({
	tmdbId,
	fingerprintKey,
	sourceFingerprintScore,
	sourceMediaType,
}: UseRelatedShowsParams) => {
	const url = new URL("/api/related", "https://goodwatch.app")
	url.searchParams.append("tmdbId", tmdbId.toString())
	if (fingerprintKey) url.searchParams.append("fingerprintKey", fingerprintKey)
	if (sourceFingerprintScore !== undefined) url.searchParams.append("sourceFingerprintScore", sourceFingerprintScore.toString())
	url.searchParams.append("mediaType", "show")
	url.searchParams.append("sourceMediaType", sourceMediaType)

	return useQuery<GetRelatedShowsResult>({
		queryKey: queryKeyRelatedShows.concat([tmdbId.toString(), fingerprintKey ?? "overall", sourceFingerprintScore?.toString() ?? "none", sourceMediaType]),
		queryFn: async () => await (await fetch(url.pathname + url.search)).json(),
		placeholderData: (previousData) => previousData,
	})
}
