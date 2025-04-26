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
import CountrySelector from "~/ui/streaming/CountrySelector"
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
				<div className="relative m-auto w-full max-w-7xl z-20">
					<div className="ml-4">
						<div className="flex gap-4 items-center flex-wrap mb-4">
							{ageRating && (
								<>
									<AgeRating ageRating={ageRating} /> &middot;
								</>
							)}
							{runtime ? (
								<>
									<Runtime minutes={runtime} /> &middot;
								</>
							) : null}
							{number_of_episodes && number_of_seasons ? (
								<>
									<span className="flex gap-1">
										<strong>{number_of_episodes}</strong>
										Episode{number_of_episodes === 1 ? "" : "s"} in
										<strong>{number_of_seasons}</strong>
										Season{number_of_seasons === 1 ? "" : "s"}
									</span>
									<span className="hidden sm:inline">&middot;</span>
								</>
							) : null}
							<div className="hidden sm:flex items-center gap-4">
								<Genres
									genres={genres}
									subgenres={getDNAForCategory(dna, "Sub-Genres")}
									type={media_type}
								/>
							</div>
						</div>

						<div className="sm:hidden flex items-center gap-4 flex-wrap">
							<Genres
								genres={genres}
								subgenres={getDNAForCategory(dna, "Sub-Genres")}
								type={media_type}
							/>
						</div>

						<div className="sm:hidden flex items-center gap-4 flex-wrap mt-6">
							<DNAPreview dna={dna} navigateToSection={navigateToSection} />
						</div>
					</div>

					<div className="p-3 flex items-center sm:items-start">
						<div className="w-24 xs:w-36 sm:w-48 md:w-60 lg:w-72">
							<div className="relative flex-none mt-8 w-full">
								<TrailerOverlay videos={videos || []} />
								<RatingOverlay ratings={ratings} />
								<Poster path={poster_path} title={title} />
							</div>
							<div className="hidden sm:block mt-4">
								<WatchStatusBlock details={details} />
							</div>
						</div>
						<div className="relative flex-1 mt-2 sm:mt-4 sm:pl-6 lg:pl-8">
							<div className="hidden sm:flex items-center gap-4 ml-2 mt-3 mb-4">
								<DNAPreview dna={dna} navigateToSection={navigateToSection} />
							</div>
							<div className="sm:hidden mt-5 ml-2">
								<WatchStatusBlock details={details} />
							</div>
							<div className="hidden sm:block mb-4">
								<CountrySelector
									media_type={media_type}
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
						</div>
					</div>
					<div className="flex gap-4 px-3 w-full">
						<div className="relative flex-1 mt-2">
							<div className="sm:hidden mb-4">
								<CountrySelector
									media_type={media_type}
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
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
