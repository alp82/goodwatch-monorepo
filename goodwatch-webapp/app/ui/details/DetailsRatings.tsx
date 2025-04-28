import React, { useState } from "react"
import RatingBadges from "~/ui/ratings/RatingBadges"
import { extractRatings } from "~/utils/ratings"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { SectionProps } from "~/utils/scroll"
import type { SectionIds } from "~/ui/details/common"
import ScoreSelector from "~/ui/user/ScoreSelector"
import Appear from "~/ui/fx/Appear"

interface DetailsRatingsProps {
	details: MovieDetails | TVDetails
	sectionProps: SectionProps<SectionIds>
}

export default function DetailsRatings({
	details,
	sectionProps,
}: DetailsRatingsProps) {
	const ratings = extractRatings(details)

	const [ratingVisible, setRatingVisible] = useState(false)
	const handleToggleRate = () => {
		setRatingVisible((prev) => !prev)
	}

	return (
		<div {...sectionProps.ratings}>
			<div className="relative max-w-7xl mx-2 xl:mx-auto my-8">
				<h2 className="ml-4 mb-2 flex items-center gap-2 text-2xl font-bold">
					Ratings
				</h2>
				<div className="rounded-xl bg-gray-700/50">
					<div className="flex flex-col divide-y divide-gray-700 ">
						<div className="py-3 px-4 flex-1 flex flex-col items-center md:items-start">
							<RatingBadges ratings={ratings} onToggleRate={handleToggleRate} />
						</div>
						<Appear isVisible={ratingVisible}>
							<div className="py-2 px-4 bg-gray-900/50">
								<div>
									<ScoreSelector details={details} />
								</div>
							</div>
						</Appear>
					</div>
				</div>
			</div>
		</div>
	)
}
