import React from "react"
import type {
	ContentRatingResult,
	MovieDetails,
	ReleaseDate,
	TVDetails,
} from "~/server/details.server"
import { Poster } from "~/ui/Poster"
import TrailerOverlay from "~/ui/TrailerOverlay"
import AgeRating from "~/ui/details/AgeRating"
import DetailsHeader from "~/ui/details/DetailsHeader"
import Genres from "~/ui/details/Genres"
import Runtime from "~/ui/details/Runtime"
import type { SectionIds } from "~/ui/details/common"
import DNAPreview from "~/ui/dna/DNAPreview"
import { getDNAForCategory } from "~/ui/dna/dna_utils"
import RatingBlock from "~/ui/ratings/RatingBlock"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingBlock from "~/ui/streaming/StreamingBlock"
import ScoreSelector from "~/ui/user/ScoreSelector"
import WatchStatusBlock from "~/ui/user/WatchStatusBlock"
import { extractRatings } from "~/utils/ratings"
import type { Section, SectionProps } from "~/utils/scroll"
import PlanToWatchButton from "~/ui/user/PlanToWatchButton"
import WatchHistoryButton from "~/ui/user/WatchHistoryButton"
import FavoriteButton from "~/ui/user/FavoriteButton"

export interface DetailsOverviewProps {
	details: MovieDetails | TVDetails
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

export default function DetailsMain({
	details,
	country,
	sectionProps,
	navigateToSection,
}: DetailsOverviewProps) {
	const ratings = extractRatings(details)

	const { backdrop_path, poster_path, title, videos } = details

	const backdropUrl = `https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}`

	return (
		<div className="relative isolate">
			{backdrop_path && (
				<div
					className="pointer-events-none fixed inset-0 z-0 w-full h-full"
					aria-hidden="true"
					style={{
						backgroundImage: `url(${backdropUrl})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
						filter: "blur(32px) brightness(0.15)",
					}}
				/>
			)}
			<div className="relative z-10">
				<div {...sectionProps.overview}>
					<div className="relative m-auto w-full max-w-7xl">
						<div className="overflow-hidden py-2">
							<div className="px-4 mt-4 flex items-center justify-evenly gap-2">
								<PlanToWatchButton details={details} />
								<WatchHistoryButton details={details} />
								<span className="hidden md:inline">
									<FavoriteButton details={details} />
								</span>
							</div>
						</div>
					</div>

					<div className="relative m-auto px-4 max-w-7xl flex justify-center gap-2">
						<div className="relative w-[calc(21.8%-0.125rem)] min-w-[3.8rem] flex-shrink-0">
							<Poster path={poster_path} title={title} />
						</div>
						<div className="relative flex-grow min-w-[220px] flex items-center justify-center">
							<div className="aspect-video w-full max-h-full relative overflow-hidden rounded-lg shadow-lg">
								<img
									src={backdropUrl}
									alt="Backdrop"
									className="iw-full h-full object-cover object-center brightness-50 select-none pointer-events-none"
								/>
								<div className="absolute inset-0 flex items-center justify-center">
									<TrailerOverlay videos={videos} />
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
