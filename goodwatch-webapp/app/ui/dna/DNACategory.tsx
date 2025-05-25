import React, { useMemo } from "react"
import { Spoiler } from "spoiled"
import { DNATag } from "~/ui/dna/DNATag"
import { spoilerCategories } from "~/ui/dna/dna_utils"
import type { DNA, MovieDetails, TVDetails } from "~/server/details.server"
import { useDiscover } from "~/routes/api.discover"
import { SEPARATOR_SECONDARY } from "~/utils/navigation"
import MovieTvSwiper from "~/ui/explore/MovieTvSwiper"

export interface DNACategoryProps {
	details: MovieDetails | TVDetails
	category: string
	dnaItems: DNA[]
	spoilerVisible: boolean
	onRevealSpoiler: () => void
}

// Fixed height skeleton for loading state to avoid layout shifts
function DiscoverSkeleton() {
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
function EmptyDiscoverState() {
	return (
		<div className="h-[135px] flex items-center justify-center">
			{/*<div className="p-4">*/}
			{/*	<p className="text-gray-500">*/}
			{/*		No recommendations found for this category*/}
			{/*	</p>*/}
			{/*</div>*/}
		</div>
	)
}

export function DNACategory({
	details,
	category,
	dnaItems,
	spoilerVisible,
	onRevealSpoiler,
}: DNACategoryProps) {
	// TODO spoiler sometimes causes errors
	// const isSpoiler = spoilerCategories.includes(category)
	const isSpoiler = false

	const discover = useDiscover({
		params: {
			type: "all",
			minScore: "50",
			similarTitles: `${details.tmdb_id}${SEPARATOR_SECONDARY}${details.media_type}${SEPARATOR_SECONDARY}${category}`,
			sortBy: "aggregated_score",
		},
	})

	const discoverResults = useMemo(() => {
		return discover.data?.pages.flat() ?? []
	}, [discover.data, details.tmdb_id, details.media_type])

	// Determine content state (loading, empty, or has results)
	const isLoading = discover.isLoading || discover.isFetching
	const hasResults = !isLoading && discoverResults.length > 0
	const isEmpty = !isLoading && discoverResults.length === 0

	return (
		<div className="flex flex-col gap-4">
			{isSpoiler && !spoilerVisible && (
				<span className="text-base text-gray-500 font-semibold">
					Click below to reveal spoilers
				</span>
			)}
			<div
				className={`
          mt-1 text-gray-400 sm:col-span-2 sm:mt-0 flex flex-wrap gap-2 
          ${isSpoiler && !spoilerVisible ? "cursor-pointer" : ""}
        `}
				onClick={isSpoiler ? onRevealSpoiler : undefined}
				onKeyDown={() => null}
			>
				{dnaItems.map((dnaItem) => (
					<Spoiler
						key={dnaItem.id}
						hidden={isSpoiler && !spoilerVisible}
						theme="dark"
						accentColor={"#55c8f7"}
						density={0.15}
					>
						<DNATag
							id={dnaItem.id}
							category={dnaItem.category}
							label={dnaItem.label}
							linkDisabled={isSpoiler && !spoilerVisible}
						/>
					</Spoiler>
				))}
			</div>

			{/* Discover Section with fixed height container to prevent layout shifts */}
			<div className="mt-4">
				{/* Show appropriate content based on state */}
				{isLoading && <DiscoverSkeleton />}
				{isEmpty && <EmptyDiscoverState />}
				{hasResults && <MovieTvSwiper results={discoverResults} />}
			</div>
		</div>
	)
}
