import React from "react"
import type { ContentRatingResult, ReleaseDate } from "~/server/details.server"

export interface AgeRatingProps {
	ageRating?: ReleaseDate | ContentRatingResult
}

export default function AgeRating({ ageRating }: AgeRatingProps) {
	return (
		<>
			{ageRating && (
				<>
					<div className="inline-block md:py-1 px-1 md:px-2 leading-4 md:leading-4 border-2 text-xs md:text-md font-bold text-center">
						{ageRating.certification || ageRating.rating}
					</div>
				</>
			)}
		</>
	)
}
