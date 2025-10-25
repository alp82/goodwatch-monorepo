import { BookmarkIcon } from "@heroicons/react/20/solid"
import type React from "react"
import type { Score } from "~/server/scores.server"

interface UserDataOverlayProps {
	score: Score | null
	onWishList: boolean
}

export default function UserDataOverlay({
	score,
	onWishList,
}: UserDataOverlayProps) {
	const hasScore = typeof score === "number"
	const vibeColorIndex = hasScore ? Math.floor(score * 10) : null

	const showOverlay = hasScore || onWishList

	if (!showOverlay) {
		return null
	}

	return (
		<div className="absolute top-0 left-0 p-2 flex flex-col gap-2">
			{hasScore && (
				<div
					className={`${vibeColorIndex == null ? "bg-gray-700" : `bg-vibe-${vibeColorIndex}`} rounded-lg flex items-center justify-center text-white w-10 h-10`}
				>
					<span className="text-lg font-bold">{score}</span>
				</div>
			)}
			{onWishList && (
				<div className="bg-gray-700/90 rounded-lg flex items-center justify-center w-10 h-10">
					<BookmarkIcon className="h-6 w-6 text-amber-500" title="On Wishlist" />
				</div>
			)}
		</div>
	)
}
