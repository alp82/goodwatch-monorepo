import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import { Poster } from "~/ui/Poster"
import TrailerOverlay from "~/ui/TrailerOverlay"
import type { SectionIds } from "~/ui/details/common"
import type { SectionProps } from "~/utils/scroll"
import PlanToWatchButton from "~/ui/user/PlanToWatchButton"
import WatchHistoryButton from "~/ui/user/WatchHistoryButton"
import FavoriteButton from "~/ui/user/FavoriteButton"

export interface DetailsOverviewProps {
	details: MovieDetails | TVDetails
	sectionProps: SectionProps<SectionIds>
}

export default function DetailsMain({
	details,
	sectionProps,
}: DetailsOverviewProps) {
	const { backdrop_path, poster_path, title, videos } = details

	const backdropUrl = `https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}`

	return (
		<div className="relative max-w-7xl mx-2 xl:mx-auto mt-4 mb-8 py-4 px-4 rounded-xl bg-gray-700/0">
			<div {...sectionProps.overview}>
				{/* Poster and Trailer */}
				<div className="flex justify-center gap-2">
					<div className="relative w-[calc(21.8%-0.125rem)] min-w-[3.8rem] flex-shrink-0">
						<Poster path={poster_path} title={title} />
					</div>
					<div className="relative flex-grow min-w-[220px] flex items-center justify-center">
						<div className="aspect-video w-full max-h-full relative rounded-md overflow-hidden">
							<img
								src={backdropUrl}
								alt="Backdrop"
								className="w-full h-full object-cover object-center brightness-70 select-none pointer-events-none"
							/>
							<div className="absolute inset-0 flex items-center justify-center">
								<TrailerOverlay videos={videos} />
							</div>
						</div>
					</div>
				</div>

				{/* User Actions */}
				<div className="overflow-hidden pt-2">
					<div className="flex items-center justify-evenly gap-2">
						<PlanToWatchButton details={details} />
						<WatchHistoryButton details={details} />
						{/*<span className="hidden md:inline">*/}
						{/*	<FavoriteButton details={details} />*/}
						{/*</span>*/}
					</div>
				</div>
			</div>
		</div>
	)
}
