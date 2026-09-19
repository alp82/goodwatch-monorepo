import {
	useUserScore,
	useIsOnWishlist,
	useIsSkipped,
} from "~/hooks/useUserDataAccessors"
import { useEffect, useState } from "react"
import ClickScorer from "./ClickScorer"
import SwipeScorer from "./SwipeScorer"
import type { ScoringMedia, LastRatedItem } from "./types"
import type { Score } from "~/server/scores.server"

interface SingleItemScorerProps {
	media: ScoringMedia
	nextMedia?: ScoringMedia | null
	onScore: (score: Score) => void
	onSkip: () => void
	onPlanToWatch: () => void
	lastRated?: LastRatedItem[]
	ratingsCount?: number
	mode?: "mobile" | "desktop"
	isGuest?: boolean
}

export default function SingleItemScorer({
	media,
	nextMedia,
	onScore,
	onSkip,
	onPlanToWatch,
	lastRated = [],
	ratingsCount = 0,
	mode,
	isGuest = false,
}: SingleItemScorerProps) {
	const score = useUserScore(media.media_type, media.tmdb_id)
	const onWishlist = useIsOnWishlist(media.media_type, media.tmdb_id)
	const skipped = useIsSkipped(media.media_type, media.tmdb_id)
	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768)
		}
		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	const effectiveMode = mode || (isMobile ? "mobile" : "desktop")

	return (
		<div className="relative w-full flex flex-col">
			{(score || onWishlist || skipped) && (
				<p className="text-sm text-center text-gray-300">
					{score
						? `Your rating: ${score.score}/10`
						: onWishlist
							? "On your Wishlist"
							: "Skipped"}
				</p>
			)}
			{/* Main Scoring Area */}
			<div className="flex items-center justify-center px-3 py-1 md:px-4 md:py-4">
				{effectiveMode === "mobile" ? (
					<SwipeScorer
						key={`${media.media_type}-${media.tmdb_id}`}
						media={media}
						nextMedia={nextMedia}
						onScore={onScore}
						onSkip={onSkip}
						onPlanToWatch={onPlanToWatch}
						isGuest={isGuest}
						isFirstItem={ratingsCount === 0}
					/>
				) : (
					<ClickScorer
						media={media}
						onScore={onScore}
						onSkip={onSkip}
						onPlanToWatch={onPlanToWatch}
						isGuest={isGuest}
					/>
				)}
			</div>
		</div>
	)
}
