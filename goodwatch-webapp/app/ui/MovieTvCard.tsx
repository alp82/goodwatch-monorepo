import { Link } from "@remix-run/react"
import type React from "react"
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
		<Link
			className="
				@container
				flex flex-col w-full
				bg-gray-900 hover:bg-gray-800
				border-4 rounded-lg border-gray-800 hover:border-amber-700/50
				transition-transform duration-100 transform scale-95 hover:scale-100
				group
			"
			to={`/${mediaType}/${details.tmdb_id}-${titleToDashed(details.title)}`}
			prefetch={prefetch ? "viewport" : "intent"}
			draggable="false"
		>
			<div className="relative">
				<RatingOverlay ratings={ratings} />
				{details.streaming_links && (
					<StreamingOverlay links={details.streaming_links} />
				)}
				<Poster path={details.poster_path} title={details.title} />

				<div
					className="
						hidden @6xs:flex items-end
						absolute bottom-0 w-full min-h-40 px-2 py-2
						bg-linear-to-t from-black/70 to-transparent group-hover:from-black/90 group-hover:via-90%
						overflow-hidden
					"
				>
					<span
						className="
							text-sm font-bold text-white
							transition-transform duration-200 group-hover:-translate-y-1
						"
					>
						{details.title}
						{details.release_year ? ` (${details.release_year})` : ""}
					</span>
				</div>
			</div>
		</Link>
	)
}
