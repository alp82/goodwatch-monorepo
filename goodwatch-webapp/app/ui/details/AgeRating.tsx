import React from "react"
import type { ContentRatingResult, ReleaseDate } from "~/server/details.server"

export interface AgeRatingProps {
	ageRating?: ReleaseDate | ContentRatingResult
}

export default function AgeRating({ ageRating }: AgeRatingProps) {
	return (
		<>
			{ageRating && (
				<span className="px-1.5 py-0.5 bg-gray-700/50 rounded text-[80%] text-white font-medium">
					{ageRating.certification || ageRating.rating}
				</span>
			)}
		</>
	)
}
