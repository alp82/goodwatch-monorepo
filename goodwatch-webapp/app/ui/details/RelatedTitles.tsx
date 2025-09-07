import React, { useMemo } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useRelatedMovies, useRelatedShows } from "~/routes/api.related"
import MovieTvSwiper from "~/ui/explore/MovieTvSwiper"
import { FilmIcon, TvIcon } from "@heroicons/react/24/solid"

export interface RelatedTitlesProps {
    media: MovieResult | ShowResult
	fingerprintKey: string
}

// Fixed height skeleton for loading state to avoid layout shifts
function RelatedSkeleton() {
	return (
		<div className="h-[135px]">
			<div className="flex gap-4 overflow-hidden">
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="flex-shrink-0">
						<div className="rounded-md bg-gray-800 animate-pulse w-[85px] h-[127px]" />
					</div>
				))}
			</div>
		</div>
	)
}

// Empty state with consistent height
function EmptyRelatedState() {
	return (
		<div className="h-[135px] flex items-center justify-center">
			{/* Empty state - could add message if needed */}
		</div>
	)
}

function RelatedSwiper({
	icon: Icon,
	heading,
	results,
	isLoading,
}: {
	icon: React.ElementType
	heading: string
	results: any[]
	isLoading: boolean
}) {
	const hasResults = !isLoading && results.length > 0
	const isEmpty = !isLoading && results.length === 0

	return (
		<>
			<h2 className="my-6 flex items-center gap-2 text-2xl font-bold">
				<Icon className="h-7 p-0.5 w-auto" />
				{heading}
			</h2>
			<div className="mt-4">
				{isLoading && <RelatedSkeleton />}
				{isEmpty && <EmptyRelatedState />}
				{hasResults && <MovieTvSwiper results={results} />}
			</div>
		</>
	)
}

export default function RelatedTitles({ media, fingerprintKey }: RelatedTitlesProps) {
	const { details } = media
    
    const relatedMovies = useRelatedMovies({
		tmdbId: details.tmdb_id,
		fingerprintKey,
		sourceMediaType: details.media_type,
	})

	const relatedShows = useRelatedShows({
		tmdbId: details.tmdb_id,
		fingerprintKey,
		sourceMediaType: details.media_type,
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

	// Format fingerprint key for display (capitalize and replace underscores)
	const displayKey = fingerprintKey
		.split('_')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')

	return (
		<div className="flex flex-col gap-8">
			<RelatedSwiper
				icon={FilmIcon}
				heading={`Related Movies: ${displayKey}`}
				results={movieResults}
				isLoading={relatedMovies.isLoading || relatedMovies.isFetching}
			/>
			<RelatedSwiper
				icon={TvIcon}
				heading={`Related Shows: ${displayKey}`}
				results={showResults}
				isLoading={relatedShows.isLoading || relatedShows.isFetching}
			/>
		</div>
	)
}
