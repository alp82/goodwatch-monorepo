import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import FavoriteButton from "~/ui/user/FavoriteButton"
import ToWatchButton from "~/ui/user/ToWatchButton"
import WatchHistoryButton from "~/ui/user/WatchHistoryButton"

export interface WatchStatusBlockProps {
	details: MovieDetails | TVDetails
}

export default function WatchStatusBlock({ details }: WatchStatusBlockProps) {
	return (
		<div className="overflow-hidden py-2 rounded-lg bg-gray-900 bg-opacity-50 shadow">
			<div className="flex flex-col gap-4 items-center justify-evenly px-4 py-2 md:py-4">
				<ToWatchButton details={details} />
				<WatchHistoryButton details={details} />
				<FavoriteButton details={details} />
			</div>
		</div>
	)
}
