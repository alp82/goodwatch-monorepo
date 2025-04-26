import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import { Poster } from "~/ui/Poster"
import TrailerOverlay from "~/ui/TrailerOverlay"
import type { SectionIds } from "~/ui/details/common"
import type { Section, SectionProps } from "~/utils/scroll"
import PlanToWatchButton from "~/ui/user/PlanToWatchButton"
import WatchHistoryButton from "~/ui/user/WatchHistoryButton"
import FavoriteButton from "~/ui/user/FavoriteButton"
import StreamingBadges from "~/ui/streaming/StreamingBadges"
import CountrySelector from "~/ui/streaming/CountrySelector"

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
	const {
		backdrop_path,
		media_type,
		poster_path,
		streaming_country_codes,
		streaming_links,
		title,
		videos,
	} = details

	const backdropUrl = `https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}`

	return (
		<div className="relative max-w-7xl mx-auto my-4 py-2 px-4 rounded-2xl bg-gray-700/50">
			<div {...sectionProps.overview}>
				{/* User Actions */}
				<div className="overflow-hidden py-2">
					<div className="flex items-center justify-evenly gap-2">
						<PlanToWatchButton details={details} />
						<WatchHistoryButton details={details} />
						<span className="hidden md:inline">
							<FavoriteButton details={details} />
						</span>
					</div>
				</div>

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

				{/* Streaming Availability */}
				<div className="my-2 flex items-center justify-between flex-wrap">
					<StreamingBadges
						details={details}
						country={country}
						media_type={media_type}
						links={streaming_links}
						countryCodes={streaming_country_codes}
						streamTypes={["flatrate", "free"]}
						navigateToSection={navigateToSection}
					/>

					<div className="py-2">
						<CountrySelector
							media_type={media_type}
							countryCodes={streaming_country_codes}
							currentCountryCode={country}
							navigateToSection={navigateToSection}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
