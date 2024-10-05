import React from "react"
import type {
	ContentRatingResult,
	MovieDetails,
	ReleaseDate,
	TVDetails,
} from "~/server/details.server"
import AgeRating from "~/ui/AgeRating"
import Genres from "~/ui/Genres"
import { Poster } from "~/ui/Poster"
import Runtime from "~/ui/Runtime"
import ShareButton from "~/ui/ShareButton"
import TrailerOverlay from "~/ui/TrailerOverlay"
import type { SectionIds } from "~/ui/details/common"
import DNAPreview from "~/ui/dna/DNAPreview"
import RatingBlock from "~/ui/ratings/RatingBlock"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingBlock from "~/ui/streaming/StreamingBlock"
import ScoreSelector from "~/ui/user/ScoreSelector"
import WatchStatusBlock from "~/ui/user/WatchStatusBlock"
import { extractRatings } from "~/utils/ratings"
import type { Section, SectionProps } from "~/utils/scroll"

export interface DetailsOverviewProps {
	details: MovieDetails | TVDetails
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

export default function DetailsOverview({
	details,
	country,
	sectionProps,
	navigateToSection,
}: DetailsOverviewProps) {
	const ratings = extractRatings(details)

	const {
		backdrop_path,
		dna,
		genres,
		media_type,
		poster_path,
		release_year,
		streaming_country_codes,
		streaming_links,
		title,
		videos,
	} = details

	let ageRating: ContentRatingResult | ReleaseDate | undefined
	let number_of_episodes: number | undefined
	let number_of_seasons: number | undefined
	let runtime: number | undefined
	if (media_type === "movie") {
		ageRating = (details.certifications || []).find(
			(release) => release.certification,
		)
		runtime = details.runtime
	} else {
		ageRating = (details.certifications || []).find((release) => release.rating)
		number_of_episodes = details.number_of_episodes
		number_of_seasons = details.number_of_seasons
	}

	return (
		<div {...sectionProps.overview}>
			<div
				className="relative mt-0 py-2 sm:py-4 lg:py-8 min-h-64 lg:min-h-96 bg-cover bg-center bg-no-repeat before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.68]"
				style={{
					backgroundImage: `url('https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}')`,
				}}
			>
				<div className="relative m-auto ow-full max-w-7xl z-20">
					<div className="ml-4">
						<h1 className="mb-4 mr-24 text-2xl md:text-3xl lg:text-4xl">
							<span className="font-bold pr-2">{title}</span> (
							<small>{release_year})</small>
						</h1>

						<div className="flex gap-4 items-center mb-4 ml-">
							<AgeRating ageRating={ageRating} />
							{runtime ? (
								<>
									· <Runtime minutes={runtime} />
								</>
							) : null}
							{number_of_episodes && number_of_seasons ? (
								<>
									·{" "}
									<div className="flex gap-1">
										<strong>{number_of_episodes}</strong>
										Episode{number_of_episodes === 1 ? "" : "s"} in
										<strong>{number_of_seasons}</strong>
										Season{number_of_seasons === 1 ? "" : "s"}
									</div>
								</>
							) : null}
							<div className="hidden sm:flex items-center gap-4">
								· <Genres genres={genres} type={media_type} />
							</div>
						</div>

						<div className="sm:hidden flex items-center gap-4 flex-wrap">
							<Genres genres={genres} type={media_type} />
						</div>
					</div>

					<div className="p-3 flex items-start">
						<div className="hidden sm:block w-48 md:w-72">
							<div className="relative flex-none mt-8 w-full">
								<TrailerOverlay videos={videos || []} />
								<RatingOverlay ratings={ratings} />
								<Poster path={poster_path} title={title} />
							</div>
							<div className="hidden md:block mt-4">
								<WatchStatusBlock details={details} />
							</div>
						</div>
						<div className="relative flex-1 mt-2 sm:mt-4 sm:pl-6 lg:pl-8">
							<div className="sm:hidden mt-8 flex flex-wrap justify-center gap-4 w-full">
								<div className="relative flex-none max-w-full sm:w-64">
									<TrailerOverlay videos={videos || []} />
									<RatingOverlay ratings={ratings} />
									<Poster path={poster_path} title={title} />
								</div>
							</div>
							<div className="hidden sm:block mb-4">
								<StreamingBlock
									details={details}
									media_type={media_type}
									links={streaming_links}
									countryCodes={streaming_country_codes}
									currentCountryCode={country}
									navigateToSection={navigateToSection}
								/>
							</div>
							<div className="hidden sm:block mb-4">
								<RatingBlock
									ratings={ratings}
									navigateToSection={navigateToSection}
								/>
							</div>
							<div className="hidden md:block mb-4">
								<ScoreSelector details={details} />
							</div>
							<div className="hidden ml-2 md:flex items-center gap-4">
								<DNAPreview dna={dna} navigateToSection={navigateToSection} />
							</div>
						</div>
					</div>
					<ShareButton />
				</div>
				<div className="flex gap-4 px-3 w-full">
					<div className="relative flex-1 mt-2">
						<div className="sm:hidden mb-4">
							<StreamingBlock
								details={details}
								media_type={media_type}
								links={streaming_links}
								countryCodes={streaming_country_codes}
								currentCountryCode={country}
								navigateToSection={navigateToSection}
							/>
						</div>
						<div className="sm:hidden mb-4">
							<RatingBlock
								ratings={ratings}
								navigateToSection={navigateToSection}
							/>
						</div>
						<div className="md:hidden mb-4">
							<ScoreSelector details={details} />
						</div>
						<div className="md:hidden mb-4">
							<WatchStatusBlock details={details} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
