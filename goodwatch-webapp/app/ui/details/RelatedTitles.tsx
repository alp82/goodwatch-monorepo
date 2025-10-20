import React, { useMemo } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useRelatedMovies, useRelatedShows } from "~/routes/api.related"
import MovieTvSwiper from "~/ui/explore/MovieTvSwiper"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import ListSwiperSkeleton from "~/ui/ListSwiperSkeleton"

export interface RelatedTitlesProps {
    media: MovieResult | ShowResult
	fingerprintKey?: string
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

    // Meta for fingerprint key (fallback to overall when undefined)
    const meta = getFingerprintMeta(fingerprintKey ?? "overall")

    // Reorder so that top 4 by voting_count come first, rest keep original order
    const reorderTopByVotes = <T extends { tmdb_id: number; goodwatch_overall_score_voting_count?: number }>(items: T[]): T[] => {
        if (!items?.length) return items
        const sortedByVotesDesc = [...items].sort(
            (a, b) => (b.goodwatch_overall_score_voting_count ?? 0) - (a.goodwatch_overall_score_voting_count ?? 0),
        )
        const top = sortedByVotesDesc.slice(0, 4)
        const topIds = new Set(top.map((x) => x.tmdb_id))
        const rest = items.filter((x) => !topIds.has(x.tmdb_id))
        return [...top, ...rest]
    }

    const movieResultsReordered = useMemo(() => reorderTopByVotes(movieResults), [movieResults])
    const showResultsReordered = useMemo(() => reorderTopByVotes(showResults), [showResults])

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
                results={movieResultsReordered}
                isLoading={relatedMovies.isLoading || relatedMovies.isFetching}
            />
            <RelatedSwiper
                title="Shows"
                results={showResultsReordered}
                isLoading={relatedShows.isLoading || relatedShows.isFetching}
            />
        </div>
    )
}
