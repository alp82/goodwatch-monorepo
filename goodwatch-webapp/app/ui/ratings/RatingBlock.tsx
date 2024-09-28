import React from "react"
import { sections } from "~/ui/details/common"
import RatingBadges from "~/ui/ratings/RatingBadges"
import type { AllRatings } from "~/utils/ratings"
import type { Section } from "~/utils/scroll"

export interface RatingBlockProps {
	ratings?: AllRatings
	title?: string
	compact?: boolean
	navigateToSection: (section: Section) => void
}

export default function RatingBlock({
	ratings,
	navigateToSection,
}: RatingBlockProps) {
	return (
		<div className="divide-y divide-gray-600 overflow-hidden rounded-lg bg-gray-900 bg-opacity-50 shadow">
			<div className="px-4 py-2 sm:px-6 font-bold">
				<button
					type="button"
					className="text-indigo-400 hover:underline"
					onClick={() => navigateToSection(sections.ratings)}
					onKeyDown={() => null}
				>
					Ratings
				</button>
			</div>
			<div className="px-4 py-2 sm:p-6">
				<RatingBadges ratings={ratings} />
			</div>
		</div>
	)
}
