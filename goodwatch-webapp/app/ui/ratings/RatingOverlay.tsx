import React from "react"
import gwLogo from "~/img/goodwatch-logo.png"
import type { AllRatings } from "~/utils/ratings"

export interface RatingsOverlayProps {
	ratings?: AllRatings
	title?: string
	compact?: boolean
}

export default function RatingOverlay({ ratings }: RatingsOverlayProps) {
	const hasScore =
		typeof ratings?.goodwatch_overall_score_normalized_percent === "number"
	const score = hasScore
		? Math.floor(ratings.goodwatch_overall_score_normalized_percent)
		: null
	const vibeColorIndex = hasScore
		? Math.floor(ratings.goodwatch_overall_score_normalized_percent / 10) * 10
		: null

	return (
		<div className="absolute top-0 left-0 rounded-t-full p-2">
			{hasScore && (
				<div
					className={`${vibeColorIndex == null ? "bg-gray-700" : `bg-vibe-${vibeColorIndex}`} rounded-t-full flex flex-col items-center text-white px-3 pt-2`}
				>
					<img className="h-5 w-auto" src={gwLogo} alt="GoodWatch" />
					<span className="text-lg font-bold">{score}</span>
				</div>
			)}
		</div>
	)
}
