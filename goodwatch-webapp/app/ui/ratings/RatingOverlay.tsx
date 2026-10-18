import { assetUrl } from "~/utils/asset-url"
import type { ReactNode } from "react"
import { useSmallBadges } from "~/ui/title-card/small-badges"
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
	/** "lazy" for a card whose poster loads lazily, so its badge doesn't load ahead of it. */
	logoLoading?: "lazy" | "eager"
}

export default function RatingOverlay({
	ratings,
	children,
	logoLoading,
}: RatingsOverlayProps) {
	const small = useSmallBadges()
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
			className={`absolute top-0 right-0 flex flex-col items-center rounded-t-full p-2 ${small ? "max-lg:p-1" : ""} ${children ? "z-10" : ""}`}
		>
			{hasScore && (
				<div
					className={`${vibeColorIndex == null ? "bg-gray-700" : `bg-vibe-${vibeColorIndex}`} rounded-t-full flex flex-col items-center text-white px-3 pt-2 ${small ? "max-lg:px-1.5 max-lg:pt-1" : ""}`}
				>
					<img className={`h-5 w-auto ${small ? "max-lg:h-3" : ""}`} src={assetUrl(gwLogo)} alt="GoodWatch" loading={logoLoading} />
					<span className={`text-lg font-bold ${small ? "max-lg:text-[13px] max-lg:leading-[1.1rem]" : ""}`}>
						{score}
					</span>
				</div>
			)}
			{children}
		</div>
	)
}
