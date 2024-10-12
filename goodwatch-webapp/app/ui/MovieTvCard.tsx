import { Link, PrefetchPageLinks } from "@remix-run/react"
import type React from "react"
import { useState } from "react"
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

	const [isDragging, setIsDragging] = useState(false)
	const handleTouchStart = (
		e:
			| React.MouseEvent<HTMLAnchorElement>
			| React.TouchEvent<HTMLAnchorElement>,
	) => {
		setIsDragging(false) // Start by assuming no drag
	}
	const handleTouchMove = (
		e:
			| React.MouseEvent<HTMLAnchorElement>
			| React.TouchEvent<HTMLAnchorElement>,
	) => {
		setIsDragging(true) // If they move, we know it's a drag
	}
	const handleClick = (
		e:
			| React.MouseEvent<HTMLAnchorElement>
			| React.TouchEvent<HTMLAnchorElement>,
	) => {
		if (isDragging) {
			e.preventDefault() // Prevent navigation if it was a drag
		}
	}

	return (
		<Link
			className="flex flex-col w-full bg-gray-900 hover:bg-gray-800 border-4 rounded-md border-gray-800 hover:border-indigo-700"
			to={`/${mediaType}/${details.tmdb_id}-${titleToDashed(details.title)}`}
			prefetch={prefetch ? "viewport" : "intent"}
			draggable="false"
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onMouseDown={handleTouchStart}
			onMouseMove={handleTouchMove}
			onClick={handleClick}
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
		</Link>
	)
}
