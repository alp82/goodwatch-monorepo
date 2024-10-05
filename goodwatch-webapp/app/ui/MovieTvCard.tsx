import { PrefetchPageLinks } from "@remix-run/react"
import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { DiscoverResult } from "~/server/discover.server"
import type { ExploreResult } from "~/server/explore.server"
import type { OnboardingResult } from "~/server/onboarding-media.server"
import { Poster } from "~/ui/Poster"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import { titleToDashed } from "~/utils/helpers"
import { extractRatings } from "~/utils/ratings"

interface MovieTvCardProps {
	details:
		| MovieDetails
		| TVDetails
		| DiscoverResult
		| ExploreResult
		| OnboardingResult
	mediaType: "movie" | "tv"
	prefetch?: boolean
}

export function MovieTvCard({
	details,
	mediaType,
	prefetch = false,
}: MovieTvCardProps) {
	const ratings = extractRatings(details)
	return (
		<a
			className="flex flex-col w-full bg-gray-900 hover:bg-gray-800 border-4 rounded-md border-gray-800 hover:border-indigo-700"
			href={`/${mediaType}/${details.tmdb_id}-${titleToDashed(details.title)}`}
		>
			<div className="relative">
				<RatingOverlay ratings={ratings} />
				{details.streaming_links && (
					<StreamingOverlay links={details.streaming_links} />
				)}
				<Poster path={details.poster_path} title={details.title} />

				<div className="absolute bottom-0 w-full min-h-40 flex items-end bg-gradient-to-t from-black/70 to-transparent px-2 py-2 overflow-hidden">
					<span className="text-sm font-bold text-white">
						{details.title}
						{details.release_year ? ` (${details.release_year})` : ""}
					</span>
				</div>
			</div>

			{prefetch && (
				<PrefetchPageLinks
					page={`/${mediaType}/${details.tmdb_id}-${titleToDashed(details.title)}`}
				/>
			)}
		</a>
	)
}