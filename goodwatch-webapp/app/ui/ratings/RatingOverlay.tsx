import type { ReactNode } from "react"
import gwLogo from "~/img/goodwatch-logo.webp?no-inline"
import {
	type AllRatings,
	goodwatchScoreDisplay,
	goodwatchVibeIndex,
} from "~/utils/ratings"

export interface RatingsOverlayProps {
	ratings?: AllRatings
	title?: string
	compact?: boolean
	/** Shown under the score tab (the taste-match pill). */
	children?: ReactNode
}

export default function RatingOverlay({
	ratings,
	children,
}: RatingsOverlayProps) {
	const hasScore =
		typeof ratings?.goodwatch_overall_score_normalized_percent === "number"
	const score = hasScore
		? goodwatchScoreDisplay(ratings.goodwatch_overall_score_normalized_percent)
		: null
	const vibeColorIndex = hasScore
		? goodwatchVibeIndex(ratings.goodwatch_overall_score_normalized_percent)
		: null

	return (
		// Above the title's gradient while it holds the pill, so the pill's reasons aren't covered.
		<div
			className={`absolute top-0 right-0 flex flex-col items-center rounded-t-full p-2 ${children ? "z-10" : ""}`}
		>
			{hasScore && (
				<div
					className={`${vibeColorIndex == null ? "bg-gray-700" : `bg-vibe-${vibeColorIndex}`} rounded-t-full flex flex-col items-center text-white px-3 pt-2`}
				>
					<img className="h-5 w-auto" src={gwLogo} alt="GoodWatch" />
					<span className="text-lg font-bold">{score}</span>
				</div>
			)}
			{children}
		</div>
	)
}
