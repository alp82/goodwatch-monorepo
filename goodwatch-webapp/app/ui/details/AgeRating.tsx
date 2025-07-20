import React from "react"
import type { ContentRatingResult, Release } from "~/server/details.server"

export interface AgeRatingProps {
	ageRating?: string
}

export default function AgeRating({ ageRating }: AgeRatingProps) {
	return (
		<>
			{ageRating && (
				<span className="px-1.5 py-0.5 bg-gray-700/50 rounded-sm text-[80%] text-white font-medium">
					{ageRating}
				</span>
			)}
		</>
	)
}
