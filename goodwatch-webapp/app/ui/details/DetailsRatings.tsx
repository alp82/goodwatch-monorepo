import React, { useState } from "react"
import RatingBadges from "~/ui/ratings/RatingBadges"
import { extractRatings } from "~/utils/ratings"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { SectionProps } from "~/utils/scroll"
import type { SectionIds } from "~/ui/details/common"
import ScoreSelector from "~/ui/user/ScoreSelector"
import Appear from "~/ui/fx/Appear"
import { StarIcon } from "@heroicons/react/20/solid"
import Drawer from "~/ui/modal/Drawer"

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
	const [drawerOpen, setDrawerOpen] = useState(false)
	const handleToggleRate = () => {
		setRatingVisible((prev) => !prev)
		setDrawerOpen((prev) => !prev)
	}

	return (
		<div {...sectionProps.ratings}>
			<div className="relative max-w-7xl mx-2 xl:mx-auto my-8">
				<div className="flex items-center justify-between gap-6 mb-2">
					<h2 className="ml-4 flex items-center gap-2 text-2xl font-bold">
						Ratings
					</h2>
					<button
						className="
							flex items-center gap-2 px-3 py-1.5
							text-gray-300 hover:text-gray-100 bg-black/20 hover:bg-black/30 rounded-lg border-2 border-gray-700
							font-semibold  text-xs md:text-sm shadow-sm transition-all duration-100 cursor-pointer
						"
						type="button"
						aria-label="Rate This"
						onClick={handleToggleRate}
					>
						<StarIcon className="w-4 h-4 text-yellow-400" />
						Rate This
					</button>
				</div>
				<div className="rounded-xl bg-gray-700/50">
					<div className="flex flex-col">
						<div className="py-3 px-4 flex-1 flex flex-col items-center md:items-start">
							<RatingBadges
								details={details}
								ratings={ratings}
								onToggleRate={handleToggleRate}
							/>
						</div>

						{/* Desktop: show ScoreSelector inline, mobile: use Drawer */}
						<div className="hidden md:block">
							<Appear isVisible={ratingVisible}>
								<div className="py-2 px-4 bg-gray-900/50 border-t-[1px] border-gray-700">
									<div>
										<ScoreSelector details={details} />
									</div>
								</div>
							</Appear>
						</div>

						{/* Mobile Drawer */}
						<div className="md:hidden">
							<Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
								<ScoreSelector
									details={details}
									onCancel={() => setDrawerOpen(false)}
								/>
							</Drawer>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
