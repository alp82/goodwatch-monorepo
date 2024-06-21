import React from "react";
import type { AllRatings } from "~/utils/ratings";
import RatingBadges from "~/ui/ratings/RatingBadges";
import { useDetailsTab } from "~/utils/navigation";

export interface RatingBlockProps {
	ratings?: AllRatings;
	title?: string;
	compact?: boolean;
}

export default function RatingBlock({ ratings }: RatingBlockProps) {
	const { handleRatingsTab } = useDetailsTab();

	return (
		<div className="divide-y divide-gray-600 overflow-hidden rounded-lg bg-gray-900 bg-opacity-50 shadow">
			<div className="px-4 py-2 sm:px-6 font-bold">
				<a
					className="text-indigo-400 hover:underline"
					onClick={handleRatingsTab}
				>
					Ratings
				</a>
			</div>
			<div className="px-4 py-2 sm:p-6">
				<RatingBadges ratings={ratings} />
			</div>
		</div>
	);
}
