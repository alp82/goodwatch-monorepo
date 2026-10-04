import { Link } from "@remix-run/react"
import type React from "react"
import type { RatingBadge } from "~/domain/age-content"
import { useFeature } from "~/hooks/useFeature"
import { useUserScore, useIsOnWishlist } from "~/hooks/useUserDataAccessors"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { DiscoverResult } from "~/server/discover.server"
import type { OnboardingResult } from "~/server/onboarding-media.server"
import type { TitleCard } from "~/server/title-cards.server"
import { Poster, type PosterProps } from "~/ui/Poster"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import { RatingMark } from "~/ui/title-card/RatingMark"
import { type CardTaste, TasteMatchPill } from "~/ui/title-card/TasteMatchPill"
import UserDataOverlay from "~/ui/user/UserDataOverlay"
import { titleToDashed } from "~/utils/helpers"
import { extractRatings } from "~/utils/ratings"

interface MovieTvCardProps {
	details:
		| MovieDetails
		| TVDetails
		| DiscoverResult
		| OnboardingResult
		| TitleCard
	mediaType: "movie" | "show"
	prefetch?: boolean
	/** The viewer's taste match for the title; the pill shows while taste match is on for the viewer. */
	taste?: CardTaste
	/** The title's age rating for the viewer, shown while an age limit is on. */
	rating?: RatingBadge | null
	/** The poster's displayed widths, when the card isn't in the grid. */
	posterSizes?: PosterProps["sizes"]
	/** Set by a page for the cards it shows without scrolling. Every other poster loads lazily. */
	posterPriority?: PosterProps["priority"]
}

export function MovieTvCard({
	details,
	mediaType,
	prefetch = false,
	taste,
	rating,
	posterSizes,
	posterPriority,
}: MovieTvCardProps) {
	const ratings = extractRatings(details)
	const userScoreData = useUserScore(mediaType, details.tmdb_id)
	const userScore = userScoreData?.score ?? null
	const onWishList = useIsOnWishlist(mediaType, details.tmdb_id)
	const tasteMatch = useFeature("tasteMatch")

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
				<UserDataOverlay score={userScore} onWishList={onWishList} />
				<RatingOverlay ratings={ratings}>
					{tasteMatch && typeof taste?.match === "number" && (
						<TasteMatchPill {...taste} />
					)}
				</RatingOverlay>
				{details.streaming_links && (
					<StreamingOverlay links={details.streaming_links} />
				)}
				<Poster
					path={details.poster_path}
					title={details.title}
					mediaType={mediaType}
					tmdbId={details.tmdb_id}
					sizes={posterSizes}
					priority={posterPriority}
				/>

				{/* The bottom left is the one free corner; a card too narrow for its title keeps the badge there. */}
				{rating && (
					<RatingMark
						rating={rating}
						className="absolute bottom-2 left-2 @6xs:hidden"
					/>
				)}
				<div
					// Without a rating the layout is what it was before the badge existed.
					className={`
						hidden @6xs:flex ${rating ? "flex-col items-start justify-end gap-1.5" : "items-end"}
						absolute bottom-0 w-full min-h-40 px-2 py-2
						bg-linear-to-t from-black/70 to-transparent group-hover:from-black/90 group-hover:via-90%
						overflow-hidden
					`}
				>
					{rating && <RatingMark rating={rating} />}
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
