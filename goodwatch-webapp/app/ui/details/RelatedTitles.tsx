import React, { useMemo } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useRelatedMovies, useRelatedShows } from "~/routes/api.related"
import MovieTvSwiper from "~/ui/explore/MovieTvSwiper"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import ListSwiperSkeleton from "~/ui/ListSwiperSkeleton"

export interface RelatedTitlesProps {
    media: MovieResult | ShowResult
	fingerprintKey: string
}

// Skeleton now mirrors ListSwiper dimensions

// Empty state with consistent height
function EmptyRelatedState() {
	return (
		<div className="h-[135px] flex items-center justify-center">
			{/* Empty state - could add message if needed */}
		</div>
	)
}

function RelatedSwiper({
    title,
    results,
    isLoading,
}: {
    title: string
    results: any[]
    isLoading: boolean
}) {
    const hasResults = !isLoading && results.length > 0
    const isEmpty = !isLoading && results.length === 0

    return (
        <div className="mt-6">
            <h3 className="flex items-center gap-2 text-xl font-bold">
                {title}
            </h3>
            <div>
                {isLoading && <ListSwiperSkeleton />}
                {isEmpty && <EmptyRelatedState />}
                {hasResults && <MovieTvSwiper results={results} />}
            </div>
        </div>
    )
}

export default function RelatedTitles({ media, fingerprintKey }: RelatedTitlesProps) {
	const { mediaType, details } = media
    
    const relatedMovies = useRelatedMovies({
		tmdbId: details.tmdb_id,
		fingerprintKey,
		sourceMediaType: mediaType,
	})

	const relatedShows = useRelatedShows({
		tmdbId: details.tmdb_id,
		fingerprintKey,
		sourceMediaType: mediaType,
	})

	// Transform related results to match MovieTvSwiper expected format
	const movieResults = useMemo(() => {
		return relatedMovies.data?.map(movie => ({
			...movie,
			media_type: "movie" as const,
		})) ?? []
	}, [relatedMovies.data])

	const showResults = useMemo(() => {
		return relatedShows.data?.map(show => ({
			...show,
			media_type: "show" as const,
		})) ?? []
	}, [relatedShows.data])

    // Meta for fingerprint key
    const meta = getFingerprintMeta(fingerprintKey)

    return (
        <div className="flex flex-col gap-4">
            <div className="my-4">
                <h3 className="flex items-center gap-2 text-xl font-bold">
                    <span aria-hidden>{meta.emoji}</span>
                    <span>{meta.label}</span>
                </h3>
                {meta.description && (
                    <p className="mt-2 text-lg text-gray-300">{meta.description}</p>
                )}
            </div>
            <RelatedSwiper
                title="Movies"
                results={movieResults}
                isLoading={relatedMovies.isLoading || relatedMovies.isFetching}
            />
            <RelatedSwiper
                title="Shows"
                results={showResults}
                isLoading={relatedShows.isLoading || relatedShows.isFetching}
            />
        </div>
    )
}
