import type { MediaType } from "~/server/utils/query-db"

// Shared by the client hooks in api.related and the SSR prefetch in
// related.server, so server-hydrated data lands under the key the hook reads.

export const queryKeyRelatedMovies = ["related-movies"]
export const queryKeyRelatedShows = ["related-shows"]

export interface RelatedQueryKeyParams {
	tmdbId: number
	fingerprintKey?: string
	sourceFingerprintScore?: number
	sourceMediaType: MediaType
}

const relatedQueryKeySuffix = ({
	tmdbId,
	fingerprintKey,
	sourceFingerprintScore,
	sourceMediaType,
}: RelatedQueryKeyParams) => [
	tmdbId.toString(),
	fingerprintKey ?? "overall",
	sourceFingerprintScore?.toString() ?? "none",
	sourceMediaType,
]

export const getQueryKeyRelatedMovies = (params: RelatedQueryKeyParams) =>
	queryKeyRelatedMovies.concat(relatedQueryKeySuffix(params))

export const getQueryKeyRelatedShows = (params: RelatedQueryKeyParams) =>
	queryKeyRelatedShows.concat(relatedQueryKeySuffix(params))
