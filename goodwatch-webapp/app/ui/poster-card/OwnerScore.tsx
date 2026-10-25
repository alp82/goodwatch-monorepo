// Another member's score for a title, on their pages (their profile, their lists): a square filled in the score's
// colour, as tall as the score pill beside it, the number only (no avatar, no initial). The viewer's own pages have
// none; the pill's "you" says it there.
import type { Score } from "~/server/scores.server"
import { getVibeColorValue } from "~/utils/ratings"
import type { PartSize } from "./size"

// The pill's outer height per size (its segment height and 2 px padding each side), and its number size.
const BOX: Record<PartSize, string> = {
	S: "h-6 min-w-6 text-[12px]",
	M: "h-7 min-w-7 text-[14px]",
	L: "h-8 min-w-8 text-[16px]",
	// A poster card's pill never takes the L look: S under 6.5rem, M from there.
	auto: "h-6 min-w-6 text-[12px] @min-[6.5rem]/card:h-7 @min-[6.5rem]/card:min-w-7 @min-[6.5rem]/card:text-[14px]",
}

export interface OwnerScoreProps {
	score: Score
	/** The member whose score it is, for the tooltip and screen readers ("Mia scored it 8"). */
	name?: string | null
	/** Matches the ScorePill beside it; "auto" follows the nearest `@container/card`. */
	size?: PartSize
	className?: string
}

export function OwnerScore({
	score,
	name,
	size = "M",
	className = "",
}: OwnerScoreProps) {
	const who = name?.trim()
	return (
		<span
			data-owner-score=""
			title={who ? `${who} scored it ${score}` : `Their score: ${score}`}
			className={`inline-flex shrink-0 items-center justify-center rounded-md px-1 font-black tabular-nums text-gray-950 shadow-md shadow-black/50 ring-1 ring-black/30 ${BOX[size]} ${className}`}
			style={{
				background: getVibeColorValue(
					Math.max(1, Math.min(10, Math.round(score))) as Score,
				),
			}}
		>
			<span className="sr-only">
				{who ? `${who}'s score ` : "Their score "}
			</span>
			{score}
		</span>
	)
}
