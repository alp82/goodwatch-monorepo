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
		typeof ratings?.aggregated_overall_score_normalized_percent === "number"
	const score = hasScore
		? Math.floor(ratings.aggregated_overall_score_normalized_percent)
		: null
	const vibeColorIndex = hasScore
		? Math.floor(ratings.aggregated_overall_score_normalized_percent / 10) * 10
		: null
	const progressPosition = typeof score === "number" ? score : 50

	return (
		<div className="hidden @5xs:block absolute -top-1 w-full rounded-t-md bg-gray-800 h-5">
			{hasScore && (
				<>
					<div
						className={`${vibeColorIndex == null ? "bg-gray-700" : `bg-vibe-${vibeColorIndex}`} absolute -top-1 h-7 px-4 rounded-md flex items-center justify-center gap-1 text-gray-100 text-lg`}
						style={{
							left: `${progressPosition}%`,
							transform: `translateX(-${progressPosition}%)`,
						}}
					>
						<img className="h-4" src={gwLogo} alt="GoodWatch Score" />
						<span className="hidden xs:inline text-sm mt-0.5">Score:</span>
						<span className="font-bold">{score}</span>
					</div>
					<div
						className={`${vibeColorIndex == null ? "bg-gray-700" : `bg-vibe-${vibeColorIndex}`} h-full rounded-tl-md`}
						style={{ width: `${progressPosition}%` }}
					/>
				</>
			)}
		</div>
	)
}
